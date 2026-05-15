# OpenRouter as the mddb.dev base source

Date: 2026-05-14

This note captures the local new-api investigation and OpenRouter API-reference review that motivated switching mddb.dev's first-pass model catalog source from models.dev to OpenRouter.

## Why switch the base source

models.dev's flattened local index is useful, but its provider rows and model IDs require too much inference before mddb.dev can present stable model identities. OpenRouter's `GET /api/v1/models` response has a cleaner first-pass shape for mddb.dev:

- provider/vendor namespace in `id`, e.g. `anthropic/claude-opus-4.7-fast`;
- human display name in `name`, commonly `<Brand>: <Model>`;
- `canonical_slug` containing OpenRouter's internal release slug, often with a dated marker;
- rich model metadata: description, context length, modalities, tokenizer group, supported parameters, max output tokens, knowledge cutoff, expiration;
- richer pricing than the models.dev flattened flags/cost subset.

models.dev should be disabled as the primary source for now. It can later become a secondary enrichment source, especially for icons/provider metadata, after the OpenRouter pipeline is stable.

## new-api implementation findings

Reference files from the upstream new-api project reviewed during implementation:

- `controller/ratio_sync.go`
- `dto/ratio_sync.go`
- `web/default/src/features/system-settings/models/upstream-ratio-sync.tsx`
- `web/default/src/features/system-settings/models/constants.ts`

new-api's upstream-price sync treats OpenRouter as a special endpoint marker, not a normal `/api/pricing` endpoint.

Frontend constants:

```ts
export const OPENROUTER_ENDPOINT = 'openrouter'
export const OPENROUTER_CHANNEL_TYPE = 20
```

When a syncable channel has OpenRouter channel type, the frontend sends `endpoint: 'openrouter'`. Backend logic then calls:

```text
{base_url}/v1/models
```

For the default OpenRouter base URL (`https://openrouter.ai/api`), this becomes:

```text
https://openrouter.ai/api/v1/models
```

new-api requires a real channel ID for OpenRouter because it retrieves a channel key and sends:

```http
Authorization: Bearer <channel-key>
```

In practice, the public model list currently returns without a token, but mddb.dev should support an optional local key to avoid future breakage or rate-limit issues.

### new-api OpenRouter converter

Function:

```go
convertOpenRouterToRatioData(reader io.Reader) (map[string]any, error)
```

It only parses:

```go
Data []struct {
  ID string `json:"id"`
  Pricing struct {
    Prompt         string `json:"prompt"`
    Completion     string `json:"completion"`
    InputCacheRead string `json:"input_cache_read"`
  } `json:"pricing"`
} `json:"data"`
```

It does not preserve `canonical_slug`, `name`, `description`, `context_length`, `architecture`, `top_provider`, `supported_parameters`, `input_cache_write`, image/audio/request/web-search pricing, or endpoint/provider detail links.

### new-api conversion rules

OpenRouter prices are string USD values per token.

new-api converts prompt price to its internal `model_ratio`:

```text
model_ratio = prompt_price_per_token * 1000 * ratio_setting.USD
```

With `ratio_setting.USD = 500`, this is:

```text
model_ratio = prompt_price_per_token * 500000
```

Equivalently:

```text
input_price_per_1m_usd = prompt_price_per_token * 1_000_000
model_ratio = input_price_per_1m_usd / 2
```

Other derived ratios:

```text
completion_ratio = completion_price_per_token / prompt_price_per_token
cache_ratio = input_cache_read_price_per_token / prompt_price_per_token
```

Filtering behavior:

1. If both prompt and completion fail to parse, skip the model.
2. If only one fails to parse, treat the failed value as `0`.
3. If either parsed price is negative, skip; negative values are sentinel values for dynamic/variable pricing.
4. If prompt and completion are both zero, keep `model_ratio = 0` as a free model and do not emit `completion_ratio`.
5. If prompt is zero but completion is positive, skip because there is no input baseline for ratios.
6. If prompt is positive, emit model/completion ratios and optional cache ratio.

mddb.dev should borrow the numeric conversion and sentinel handling, but not the lossy field subset.

## OpenRouter official API-reference findings

Docs reviewed: https://openrouter.ai/docs/api/api-reference/models/get-models

Endpoint:

```http
GET https://openrouter.ai/api/v1/models
Authorization: Bearer <token>
```

Query parameters:

- `category`: programming, roleplay, marketing, marketing/seo, technology, science, translation, legal, finance, health, trivia, academia.
- `supported_parameters`: comma-separated supported parameter filter.
- `output_modalities`: comma-separated `text`, `image`, `audio`, `embeddings`, or `all`; defaults to `text`.
- `use_rss`, `use_rss_chat_links`: RSS feed options.

Response shape:

```ts
type OpenRouterModelsResponse = {
  data: OpenRouterModel[]
}
```

Important `OpenRouterModel` fields:

```ts
type OpenRouterModel = {
  id: string
  canonical_slug: string
  name: string
  created: number
  description?: string
  context_length: number | null
  architecture: {
    input_modalities: string[]
    output_modalities: string[]
    modality: string | null
    tokenizer?: string
    instruct_type?: string | null
  }
  pricing: {
    prompt: string
    completion: string
    request?: string
    image?: string
    image_output?: string
    image_token?: string
    audio?: string
    audio_output?: string
    input_audio_cache?: string
    input_cache_read?: string
    input_cache_write?: string
    internal_reasoning?: string
    web_search?: string
    discount?: number
  }
  top_provider: {
    context_length: number | null
    max_completion_tokens: number | null
    is_moderated: boolean
  }
  supported_parameters: string[]
  default_parameters: Record<string, unknown> | null
  supported_voices: string[] | null
  knowledge_cutoff: string | null
  expiration_date: string | null
  hugging_face_id: string | null
  links: { details: string }
  per_request_limits: {
    prompt_tokens: number
    completion_tokens: number
  } | null
}
```

Live sample observed:

```json
{
  "id": "anthropic/claude-opus-4.7-fast",
  "canonical_slug": "anthropic/claude-4.7-opus-fast-20260512",
  "name": "Anthropic: Claude Opus 4.7 (Fast)",
  "created": 1778613011,
  "context_length": 1000000,
  "architecture": {
    "modality": "text+image+file->text",
    "input_modalities": ["text", "image", "file"],
    "output_modalities": ["text"],
    "tokenizer": "Claude"
  },
  "pricing": {
    "prompt": "0.00003",
    "completion": "0.00015",
    "web_search": "0.01",
    "input_cache_read": "0.000003",
    "input_cache_write": "0.0000375"
  },
  "top_provider": {
    "context_length": 1000000,
    "max_completion_tokens": 128000,
    "is_moderated": true
  },
  "links": {
    "details": "/api/v1/models/anthropic/claude-4.7-opus-fast-20260512/endpoints"
  }
}
```

## Proposed mddb.dev importer design

### Data-source policy

1. Use OpenRouter `/api/v1/models` as the first base catalog source.
2. Disable/clear current models.dev-derived rendered catalog while OpenRouter importer is being built.
3. Preserve models.dev only as a later optional enrichment source, especially for icons.
4. Never commit OpenRouter API keys; read them from local environment or an ignored local file.

### Raw source preservation

The importer should emit an intermediate source record per model with at least:

- `source: 'openrouter'`
- `sourceModelId`
- `sourceCanonicalSlug`
- `rawName`
- `rawDescription`
- `rawCreated`
- `rawArchitecture`
- `rawPricing`
- `rawTopProvider`
- `rawSupportedParameters`
- `rawDefaultParameters`
- `rawSupportedVoices`
- `rawKnowledgeCutoff`
- `rawExpirationDate`
- `rawHuggingFaceId`
- `rawLinks`
- `rawPerRequestLimits`
- `rawRecord`

### Initial identity policy

OpenRouter IDs are namespaced:

```text
<namespace>/<model-id>
```

Example:

```text
anthropic/claude-opus-4.7-fast
```

Extract:

- `source_namespace = anthropic`
- `source_model_id = claude-opus-4.7-fast`
- brand display: prefer `name` prefix before `:`, otherwise namespace mapping.

Do not use OpenRouter `canonical_slug` directly as the mddb.dev canonical tag because it may include OpenRouter-specific release/date ordering:

```text
source id:           anthropic/claude-opus-4.7-fast
source canonical:    anthropic/claude-4.7-opus-fast-20260512
mddb canonical tag:  claude-opus-4-7
variant:             fast
snapshot/release:    20260512
brand:               Anthropic
source alias:         anthropic/claude-opus-4.7-fast
```

### Canonical tag policy

Keep the existing mddb.dev convention: canonical URLs should represent logical model identity, not provider namespace.

Examples:

```text
OpenRouter id                         mddb canonical tag
--------------------------------------------------------
anthropic/claude-opus-4.7-fast        claude-opus-4-7
openai/gpt-4o                         gpt-4o
openai/gpt-4o-2024-08-06              gpt-4o
inclusionai/ring-2.6-1t:free          ring-2-6-1t
qwen/qwen3-235b-a22b                  qwen3-235b-a22b
```

Collision policy:

- Default: omit namespace from canonical tag.
- If two unrelated brands collide under the same tag, keep both observations and flag for manual review.
- Only add brand namespace to canonical tag as a manual disambiguation fallback.

### Variant and snapshot policy

Clear variant candidates:

- `free`
- `fast`
- `online`
- `thinking`
- `preview`
- `experimental`
- `turbo`
- `mini`
- `lite`
- `max`
- `high`
- `low`

Clear snapshot candidates:

- `YYYY-MM-DD`
- `YYYYMMDD`
- date marker at the end of OpenRouter `canonical_slug`, e.g. `-20260512`

Be conservative with identity-bearing suffixes. Do not blindly strip:

- model sizes: `8b`, `70b`, `235b-a22b`;
- architecture generations: `r1`, `v3`, `qwen3`;
- important open-model forms such as `instruct`, unless family-specific logic says it is a non-identity variant.

### Metadata mapping

Map OpenRouter fields into mddb.dev fields:

- `name` → display name, with optional brand prefix removed after preserving brand.
- `description` → model description / longDescription.
- `created` → release/created date if no better release date exists.
- `context_length` / `top_provider.context_length` → context window.
- `top_provider.max_completion_tokens` → max output tokens.
- `architecture.input_modalities` and `output_modalities` → modalities.
- `architecture.tokenizer` → model family hint.
- `supported_parameters` → capabilities such as tools, structured outputs, reasoning, verbosity.
- `knowledge_cutoff`, `expiration_date`, `hugging_face_id` → detail-page metadata/source facts.
- `links.details` → future endpoint/provider enrichment path.

### Pricing mapping

Store both human-readable USD prices and new-api-compatible ratios.

Raw token prices should be retained exactly as strings under source records.

Derived USD per 1M:

```text
prompt_per_1m_usd = prompt * 1_000_000
completion_per_1m_usd = completion * 1_000_000
cache_read_per_1m_usd = input_cache_read * 1_000_000
cache_write_per_1m_usd = input_cache_write * 1_000_000
```

New API-compatible ratios:

```text
model_ratio = prompt * 500000
completion_ratio = completion / prompt
cache_ratio = input_cache_read / prompt
create_cache_ratio = input_cache_write / prompt
```

Use new-api's sentinel handling:

- Skip negative prompt/completion pricing as dynamic/variable sentinel values.
- Free prompt+completion models produce zero input/output display prices and `model_ratio = 0`.
- If prompt is zero but completion is positive, retain raw pricing but do not derive ratios that need prompt baseline.

### Implementation plan

1. Add this memo under `docs/research/openrouter-base-source.md`.
2. Put `OPENROUTER_API_KEY` in local ignored env only; never commit it.
3. Disable current models.dev gallery generation, producing an empty catalog or clearly empty placeholder until OpenRouter data lands.
4. Add `src/lib/openrouter-importer.test.ts` first with representative fixtures:
   - `anthropic/claude-opus-4.7-fast`
   - `openai/gpt-4o`
   - `openai/gpt-4o-2024-08-06`
   - `inclusionai/ring-2.6-1t:free`
   - `qwen/qwen3-235b-a22b`
5. Implement `src/lib/openrouter-importer.ts` producing an intermediate structure, not a final renderer-specific object.
6. Only after the intermediate structure is verified, wire the OpenRouter importer into the static site gallery.
7. Later: evaluate OpenRouter endpoint details (`links.details`) and models.dev icon enrichment.
