# mddb.dev Architecture

Date: 2026-05-14

## Purpose

mddb.dev is an open LLM model registry. Its central job is to turn scattered model strings from providers, aggregators, pricing presets, and gateway projects into a stable model identity graph that can be consumed by both humans and machines.

The first engineering phase is intentionally OpenRouter-first: import `GET https://openrouter.ai/api/v1/models`, normalize the observations into canonical model entities, render the website from that registry, and publish machine-readable JSON surfaces that new-api, sub2api, and similar gateways can consume.

Later phases add local `models.dev` and BaseLLM data as enrichment and pricing-authority sources. The architecture below is designed so those sources can be added without replacing the identity model.

## Product constraints

- The GitHub repository is public and open-source. Keep generated data reviewable, deterministic, and easy to diff.
- Canonical model pages stay at `/models/<model-name-tag>/`. Provider, brand, region, route, and snapshot information are attached records, not URL path parents.
- Downstream consumers need stable JSON files, not only a rendered website.
- Source imports must be lossless enough to explain where every canonical fact came from.
- Current reference inputs are public APIs or checked-in source snapshots:
  - OpenRouter model catalog: `https://openrouter.ai/api/v1/models`
  - models.dev API snapshot: `https://models.dev/api.json`
  - BaseLLM / NewAPI metadata: `https://basellm.github.io/llm-metadata/`
- Current source priority for the first usable registry:
  1. OpenRouter: base catalog and first imported dataset.
  2. models.dev: later metadata, provider, logo, capability, and price enrichment.
  3. BaseLLM: later New API-native pricing/ratio authority.

## Architecture layers

```text
Source acquisition
  OpenRouter /api/v1/models
  Local models.dev reference/API
  BaseLLM ratio_config
  Manual override files
        ↓
Raw snapshots
  data/raw/<source>/<observed-at>.json
        ↓
Source adapters
  parse source shape, validate fields, preserve raw records
        ↓
Identity normalization
  canonical tags, aliases, snapshots, variants, deployments
        ↓
Registry merge
  conflict policy, source priority, provenance, QA checks
        ↓
Canonical registry artifacts
  data/registry/*.json
        ↓
Projection builders
  website gallery/detail objects
  public machine API JSON
  new-api ratio_config projection
  sub2api-compatible projection
        ↓
Published surfaces
  /models/
  /models/<tag>/
  /api/models.json
  /api/models/<tag>.json
  /api/aliases.json
  /api/newapi/ratio_config-v1-base.json
  /api/sub2api/models.json
```

The important separation is between canonical registry artifacts and projections. The website, new-api export, and sub2api export should all be generated from the same canonical registry instead of each importer writing directly to a UI-specific shape.

## Repository layout

Target layout:

```text
data/
  openrouter-models.json              # current checked-in OpenRouter source snapshot
  raw/
    openrouter/<date>.json             # future immutable source snapshots
    models-dev/<date>.json
    basellm/<date>.json
  registry/
    models.json                        # canonical model entities
    aliases.json                       # alias → model tag records
    snapshots.json                     # dated/versioned releases
    variants.json                      # behavior/limit/price variants
    deployments.json                   # provider/channel/route observations
    prices.json                        # source-specific price facts
    source-records.json                # lossless provenance records
    brands.json                        # brand metadata
    providers.json                     # provider/platform metadata
  public-api/
    models.json                        # generated website/API list projection
    aliases.json                       # generated alias lookup projection
    newapi/ratio_config-v1-base.json   # generated New API-compatible ratio config
    sub2api/models.json                # generated sub2api-oriented projection
src/
  lib/
    openrouter-importer.ts             # OpenRouter source adapter
    source-importers.ts                # models.dev/BaseLLM adapters
    model-normalization.ts             # identity helpers
    registry-schema.ts                 # canonical registry TypeScript types
    registry-builder.ts                # merge source observations into registry
    registry-projections.ts            # public/API/export projections
    site-renderer.ts                   # HTML rendering from projections
  scripts/
    build-registry.ts                  # raw/imported data → registry artifacts
    build-site.ts                      # registry projections → public site/docs
scripts/
  fetch-openrouter-models.mjs
docs/
  architecture.md
  model-identity-normalization.md
  research/
```

The current code already has `openrouter-importer.ts`, `openrouter-gallery.ts`, `source-importers.ts`, and `model-normalization.ts`. The next refactor is to introduce `registry-schema.ts` and `registry-builder.ts`, then make `openrouter-gallery.ts` a projection consumer instead of the registry itself.

## Canonical data model

### `RegistryMetadata`

Dataset-level metadata for reproducibility.

```ts
type RegistryMetadata = {
  schemaVersion: string
  generatedAt: string
  sources: Array<{
    source: SourceName
    sourceUrl: string
    observedAt: string
    recordCount: number
    skippedCount: number
  }>
}
```

### `Model`

A logical model entity. This is the primary object behind `/models/<tag>/`.

```ts
type Model = {
  tag: string
  displayName: string
  brandSlug: string
  family: string | null
  status: 'current' | 'deprecated' | 'sunset' | 'unknown'
  description: string | null
  longDescription: string | null
  contextWindowTokens: number | null
  maxOutputTokens: number | null
  inputModalities: string[]
  outputModalities: string[]
  capabilities: ModelCapabilities
  primarySource: SourceName
  firstSeenAt: string | null
  lastObservedAt: string
  confidence: number
}
```

Rules:

- `tag` is a lowercase hyphen-only logical model ID, e.g. `claude-haiku-4-5`.
- `tag` excludes date snapshots, provider namespaces, cloud wrappers, deployment regions, and OpenRouter route variants.
- `displayName` can preserve human punctuation, e.g. `Claude Haiku 4.5`.
- A model is not duplicated just because OpenRouter, models.dev, BaseLLM, new-api, or sub2api uses a different string.

### `ModelAlias`

Lookup and explanation records for external names.

```ts
type ModelAlias = {
  alias: string
  normalizedAlias: string
  modelTag: string
  source: SourceName | 'official' | 'manual'
  aliasType: 'official' | 'snapshot' | 'provider_route' | 'third_party' | 'colloquial' | 'generated'
  confidence: number
  observedAt: string
}
```

Examples that must resolve to one model:

```text
claude-haiku-4-5-20251001  → claude-haiku-4-5  snapshot alias
claude-4-5-haiku           → claude-haiku-4-5  third-party/order alias
claude-haiku-4-5           → claude-haiku-4-5  official/canonical alias
```

### `ModelSnapshot`

A dated or versioned release under a logical model.

```ts
type ModelSnapshot = {
  snapshotId: string
  modelTag: string
  source: SourceName | 'manual'
  sourceModelKey: string
  marker: string
  releasedAt: string | null
  status: 'current' | 'deprecated' | 'sunset' | 'unknown'
  successorSnapshotId: string | null
  observedAt: string
}
```

Do not strip `20251001` and discard it. Move it here and create a snapshot alias.

### `ModelVariant`

A meaningful behavior, limit, price, or routing variant under the same logical model.

```ts
type ModelVariant = {
  variantId: string
  modelTag: string
  marker: string
  kind: 'free' | 'fast' | 'online' | 'thinking' | 'preview' | 'experimental' | 'turbo' | 'mini' | 'lite' | 'max' | 'high' | 'low' | 'deployment' | 'other'
  displayName: string
  summary: string | null
  source: SourceName | 'manual'
  observedAt: string
}
```

MVP treats OpenRouter suffixes such as `:free`, `-fast`, `-online`, and `-thinking` as variants when they are suffix markers. It must not blindly strip size/generation terms such as `8b`, `70b`, `235b-a22b`, `r1`, `v3`, or `qwen3`.

### `ProviderDeployment`

A provider, aggregator, cloud, route, or channel observation serving a model.

```ts
type ProviderDeployment = {
  deploymentId: string
  modelTag: string
  providerSlug: string
  providerName: string
  source: SourceName
  sourceNamespace: string | null
  sourceModelKey: string
  routeId: string
  variantId: string | null
  snapshotId: string | null
  region: string | null
  endpointDetailsUrl: string | null
  contextWindowTokens: number | null
  maxOutputTokens: number | null
  supportedParameters: string[]
  moderation: 'moderated' | 'unmoderated' | 'unknown'
  observedAt: string
}
```

OpenRouter `id` maps naturally into deployment data:

```text
id: anthropic/claude-haiku-4.5-20251001
sourceNamespace: anthropic
sourceModelKey: claude-haiku-4.5-20251001
routeId: anthropic/claude-haiku-4.5-20251001
modelTag: claude-haiku-4-5
snapshot marker: 20251001
```

### `ModelPriceFact`

A source-specific pricing observation. These facts are not collapsed too early, because BaseLLM, models.dev, and OpenRouter can disagree.

```ts
type ModelPriceFact = {
  priceId: string
  modelTag: string
  deploymentId: string | null
  variantId: string | null
  snapshotId: string | null
  source: 'openrouter' | 'models.dev' | 'basellm' | 'manual'
  sourceModelKey: string
  sourceProvider: string | null
  currency: 'USD'
  unit: 'token' | '1m_tokens' | 'request' | 'image' | 'audio' | 'other'
  inputPricePer1mUsd: number | null
  outputPricePer1mUsd: number | null
  cacheReadPricePer1mUsd: number | null
  cacheWritePricePer1mUsd: number | null
  requestPriceUsd: number | null
  imagePriceUsd: number | null
  audioPriceUsd: number | null
  rawPricing: Record<string, unknown>
  newApiRatios: {
    modelRatio: number | null
    completionRatio: number | null
    cacheRatio: number | null
    createCacheRatio: number | null
    modelPrice: number | null
    billingMode: string | null
    billingExpr: string | null
  }
  ratioStatus: 'ok' | 'free' | 'missing-prompt-baseline' | 'dynamic-sentinel' | 'unsupported'
  rawSourceUrl: string
  observedAt: string
}
```

Priority when selecting a default display price after all sources exist:

1. Manual curated override.
2. BaseLLM for New API-compatible default ratios.
3. models.dev for official/basic token prices and capabilities.
4. OpenRouter for route/deployment prices and broad coverage.

During the OpenRouter-first stage, OpenRouter is the only populated source and therefore the display default.

### `SourceRecord`

A lossless provenance record for every upstream observation.

```ts
type SourceRecord = {
  sourceRecordId: string
  modelTag: string
  source: SourceName
  sourceUrl: string
  sourceNamespace: string | null
  sourceModelKey: string
  observedAt: string
  rawRecord: Record<string, unknown>
  normalized: Record<string, unknown>
  lossyFields: Record<string, unknown>
  warnings: string[]
}
```

Rule: if the importer or merge logic drops fidelity, that fact goes into `lossyFields` or `warnings`. Public contributors should be able to inspect why a model page says what it says.

### `Brand` and `Provider`

Keep brand ownership separate from serving platform.

```ts
type Brand = {
  slug: string
  displayName: string
  websiteUrl: string | null
  logoUrl: string | null
  description: string | null
}

type Provider = {
  slug: string
  displayName: string
  providerType: 'official' | 'aggregator' | 'cloud' | 'gateway' | 'unknown'
  websiteUrl: string | null
  logoUrl: string | null
}
```

For example, `Anthropic` can be the model brand, while `OpenRouter`, `Amazon Bedrock`, and `Google Vertex` can be deployments/providers.

## Identity normalization policy

Resolution order:

1. Apply manual override if present.
2. Normalize exact canonical tag.
3. Match exact normalized alias.
4. Detect family-specific aliases, currently including Claude family/version order.
5. Strip date or semantic snapshot suffix into `ModelSnapshot` only if the remaining tag is known or deterministically generated from a trusted source.
6. Extract known variant suffixes into `ModelVariant`.
7. If collision occurs, keep source records and flag for manual review; do not silently namespace unless curated.

### Canonicalization output contract

The normalizer must return a structured result, not just a string. Every source model key should be decomposed into these slots:

```ts
type IdentityParts = {
  canonicalTag: string
  displayNameCandidate: string
  aliases: Array<{ alias: string; aliasType: RegistryAlias['aliasType'] }>
  snapshot: { marker: string; sourceAlias: string } | null
  variant: { marker: string; kind: RegistryVariant['kind'] } | null
  deployment: {
    providerNamespace: string | null
    routeId: string
    sourceModelKey: string
  }
  confidence: number
  warnings: string[]
}
```

For a source row, the importer should preserve both the normalized identity parts and the original raw record. This makes normalization explainable and prevents lossy cleanup.

### Claude family-order rule

Claude order normalization is a first-class rule. Anthropic and downstream providers commonly use both family-first and version-first order. mddb.dev canonicalizes Claude major/minor releases to:

```text
claude-<family>-<major>-<minor>
```

where `<family>` is currently `haiku`, `sonnet`, or `opus`.

The following inputs are the same logical model:

```text
input                           canonical tag        secondary record
--------------------------------------------------------------------------------
claude-haiku-4-5-20251001       claude-haiku-4-5     snapshot marker 20251001
claude-4-5-haiku                claude-haiku-4-5     alias, no snapshot
claude-haiku-4-5                claude-haiku-4-5     canonical/official alias
```

Detailed decomposition:

```text
Source id: anthropic/claude-haiku-4-5-20251001
- providerNamespace: anthropic
- sourceModelKey: claude-haiku-4-5-20251001
- canonicalTag: claude-haiku-4-5
- displayNameCandidate: Claude Haiku 4.5
- alias records:
  - anthropic/claude-haiku-4-5-20251001, provider_route
  - claude-haiku-4-5-20251001, snapshot
  - claude-haiku-4-5, official/generated
  - claude-4-5-haiku, third_party/generated
- snapshot record:
  - snapshotId: claude-haiku-4-5-20251001
  - marker: 20251001
  - modelTag: claude-haiku-4-5
- variant: null unless an additional suffix such as fast/free/online is present
```

```text
Source id: anthropic/claude-4-5-haiku
- providerNamespace: anthropic
- sourceModelKey: claude-4-5-haiku
- canonicalTag: claude-haiku-4-5
- displayNameCandidate: Claude Haiku 4.5
- alias records:
  - anthropic/claude-4-5-haiku, provider_route
  - claude-4-5-haiku, third_party
  - claude-haiku-4-5, official/generated
- snapshot: null
- variant: null
```

```text
Source id: anthropic/claude-haiku-4-5
- providerNamespace: anthropic
- sourceModelKey: claude-haiku-4-5
- canonicalTag: claude-haiku-4-5
- displayNameCandidate: Claude Haiku 4.5
- alias records:
  - anthropic/claude-haiku-4-5, provider_route
  - claude-haiku-4-5, official
  - claude-4-5-haiku, third_party/generated
- snapshot: null
- variant: null
```

Important edge rules:

- A dated Claude ID creates a snapshot record and a snapshot alias; it does not create a second model entity.
- Version-first Claude aliases (`claude-4-5-haiku`) are lookup aliases; they do not create snapshots.
- Canonical Claude tags never use periods: `claude-haiku-4-5`, not `claude-haiku-4.5`.
- The rule only applies when the tokens match `claude`, known family, and numeric major/minor. Do not apply it to unrelated names that merely contain those words.
- If a future Anthropic naming convention introduces an identity-bearing suffix beyond family/major/minor, do not strip it until a manual rule exists.

### Variant and snapshot ordering

Apply Claude family-order normalization before snapshot/variant extraction for version-first Claude strings, but preserve the original source alias. Recommended order for a source model key:

1. Normalize separators and punctuation.
2. Remove provider route wrapper into deployment metadata.
3. Detect Claude family/version order and rewrite to canonical family-first order.
4. Extract trailing snapshot markers: `YYYYMMDD`, `YYYY-MM-DD`, or semantic `vN` where documented.
5. Extract trailing route variants such as `free`, `fast`, `online`, `thinking`, `preview`, `experimental`, `turbo`, `mini`, `lite`, `max`, `high`, `low`.
6. Re-run family-order normalization if the variant/snapshot removal exposed a Claude order pattern.
7. Emit aliases for original route, source model key, canonical tag, and generated family-order equivalent.

Do not extract identity-bearing suffixes as variants. Examples that stay in the canonical tag unless a manual family rule says otherwise:

```text
qwen3-235b-a22b
llama-3-1-405b-instruct
deepseek-r1
deepseek-v3
gemini-2-5-pro
```

## Source adapter responsibilities

### OpenRouter adapter

Input: `data/openrouter-models.json` or fetched API response.

Responsibilities:

- Parse `data[]` records.
- Preserve `id`, `canonical_slug`, `name`, `description`, `created`, `context_length`, `architecture`, `pricing`, `top_provider`, `supported_parameters`, `default_parameters`, `supported_voices`, `knowledge_cutoff`, `expiration_date`, `hugging_face_id`, `links`, and `per_request_limits` in source records.
- Split `id` into namespace and model key.
- Infer brand from `name` prefix before `:` when present, otherwise namespace.
- Normalize source model key to canonical tag.
- Use `canonical_slug` primarily as snapshot/release evidence, not as the canonical mddb tag.
- Derive USD-per-1M token prices and New API-compatible ratios.
- Skip negative prompt/completion sentinel values from default price output, while retaining skipped facts in import diagnostics or source records.

### models.dev adapter

Input: local reference repo/API JSON.

Responsibilities for later phase:

- Import provider/model metadata and cost fields.
- Prefer models.dev for broad capability/cost enrichment where it is clearer than OpenRouter.
- Import logos/provider metadata where licensing/source shape permits.
- Attach provider namespace as deployment/source metadata, not canonical identity.
- Preserve fields not represented in canonical columns under `SourceRecord.lossyFields`.

### BaseLLM adapter

Input: New API-native `ratio_config`.

Responsibilities for later phase:

- Import `model_ratio`, `completion_ratio`, `cache_ratio`, `create_cache_ratio`, `model_price`, `image_ratio`, `audio_ratio`, `audio_completion_ratio`, `billing_mode`, and `billing_expr` where present.
- Convert ratios into human USD-per-1M display prices using New API's default USD ratio convention when possible.
- Preserve native ratio config fields exactly for New API export.
- Treat BaseLLM as the default New API pricing authority once imported.

### Manual overrides

Open-source registry needs curated corrections in plain files.

Suggested files:

```text
data/manual/models.json
data/manual/aliases.json
data/manual/merge-overrides.json
data/manual/price-overrides.json
```

Manual overrides should be small, reviewed, and carry comments/source URLs where possible.

## Registry merge policy

Merge should be deterministic:

- Sort source records by source priority, model tag, provider namespace, source key.
- Build canonical model rows by tag.
- Union aliases and deployments.
- Keep separate price facts per source and deployment.
- Select display/default fields through explicit priority rules.
- Emit warnings for collisions, missing prices, invalid ratios, duplicate aliases pointing to different tags, and source records that cannot be matched.

Recommended source priority by field after all three sources are available:

- Identity: manual > deterministic alias rules > OpenRouter/model route evidence > models.dev/BaseLLM keys.
- Display name: manual > OpenRouter `name` without brand prefix > models.dev display/name > normalized tag title-case.
- Capabilities/context: manual > models.dev > OpenRouter.
- Route/deployment availability: OpenRouter > models.dev > manual.
- New API ratio export: manual > BaseLLM > models.dev converted > OpenRouter converted.
- Website display price: manual > BaseLLM > models.dev > OpenRouter.

## Public machine surfaces

### General registry API

Generate static JSON files under `public/api/` first. A dynamic service can come later.

```text
/api/models.json
/api/models/<tag>.json
/api/aliases.json
/api/snapshots.json
/api/prices.json
/api/providers.json
/api/sources.json
```

`/api/models.json` should be a compact list suitable for search/autocomplete. `/api/models/<tag>.json` should include full detail: aliases, snapshots, variants, deployments, selected prices, source summaries, and warnings.

### new-api export

Expose a New API-compatible ratio config projection:

```text
/api/newapi/ratio_config-v1-base.json
```

Shape:

```json
{
  "success": true,
  "message": "mddb.dev generated ratio config",
  "data": {
    "model_ratio": {},
    "completion_ratio": {},
    "cache_ratio": {},
    "create_cache_ratio": {},
    "model_price": {},
    "billing_mode": {},
    "billing_expr": {}
  }
}
```

Only emit fields backed by supported ratio facts. Do not invent `billing_expr` from OpenRouter token prices.

### sub2api export

Because sub2api's exact consume shape is less clear than New API's ratio config, provide a neutral model registry projection first:

```text
/api/sub2api/models.json
```

Initial shape should be easy for sub2api to adapt:

```ts
type Sub2ApiModelProjection = {
  tag: string
  displayName: string
  aliases: string[]
  providers: Array<{
    provider: string
    routeId: string
    inputModalities: string[]
    outputModalities: string[]
    contextWindowTokens: number | null
    maxOutputTokens: number | null
    pricing: {
      inputPricePer1mUsd: number | null
      outputPricePer1mUsd: number | null
      cacheReadPricePer1mUsd: number | null
      cacheWritePricePer1mUsd: number | null
    }
  }>
  capabilities: ModelCapabilities
  source: {
    generatedAt: string
    primarySource: SourceName
  }
}
```

If sub2api later adopts a native schema, add a second projection rather than changing the stable neutral one destructively.

## Website surfaces

The human website is a projection of the registry:

- `/models/`: model plaza, filters by brand, provider, modality, capability, price, and context.
- `/models/<tag>/`: canonical model page with summary, aliases, snapshots, variants, deployments, prices, source provenance, and related feed items later.
- Future `/brands/<slug>/` and `/providers/<slug>/`: aggregation pages generated from canonical records.

The model page should make source provenance visible: "OpenRouter observed this route", "models.dev supplied this capability", "BaseLLM supplied this New API ratio".

## OpenRouter-first implementation route

Current stage goal: populate the registry from OpenRouter and make the result inspectable and consumable.

1. Keep `data/openrouter-models.json` as the checked-in source snapshot for now.
2. Add canonical registry types in `src/lib/registry-schema.ts`.
3. Add a registry builder that converts `OpenRouterCatalog.records` into `models`, `aliases`, `snapshots`, `variants`, `deployments`, `prices`, and `sourceRecords`.
4. Add tests using the representative fixtures already in `openrouter-importer.test.ts`, especially:
   - `anthropic/claude-opus-4.7-fast`
   - `openai/gpt-4o`
   - `openai/gpt-4o-2024-08-06`
   - `inclusionai/ring-2.6-1t:free`
   - `qwen/qwen3-235b-a22b`
   - Claude order aliases such as `claude-haiku-4-5-20251001`, `claude-4-5-haiku`, and `claude-haiku-4-5`
5. Generate `data/registry/*.json` deterministically.
6. Generate `public/api/*.json` and `public/api/newapi/ratio_config-v1-base.json` from the registry.
7. Refactor site rendering to consume registry projections rather than `OpenRouterModelRecord` directly.
8. Run `npm test`, `npm run typecheck`, `npm run build`, and deploy after committing.

## Quality gates

Before publishing or committing registry changes:

- Every model tag matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- No duplicate model tags.
- No alias points to more than one model tag.
- Snapshot suffixes are not present in canonical tags when they match known date/version patterns.
- Claude family-order aliases resolve consistently.
- Every deployment points to an existing model tag.
- Every price fact points to an existing model tag.
- Every source record has `rawRecord`, `normalized`, and `observedAt`.
- New API ratio export excludes unsupported/dynamic sentinel pricing.
- Build output includes both website pages and machine JSON files.

## Non-goals for this phase

- Dynamic backend database service.
- User accounts, comments, submissions, or admin UI.
- Live channel verification or anti-spoofing.
- Paid API plans.
- Deep industry feed ingestion.
- Complex provider health metrics.

Those can be added after the static registry + JSON projection loop is trustworthy.
