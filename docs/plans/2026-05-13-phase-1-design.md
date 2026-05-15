# mddb.dev Phase 1 Design

Date: 2026-05-13

## Goal

Build the first usable version of mddb.dev as an LLM Model Registry focused on two things:

1. canonical, URL-friendly model name tag normalization;
2. a human-facing web site for lookup, search, and model detail pages.

The first phase deliberately excludes dynamic news feeds, user accounts, paid features, channel verification, and complex hosted variants. It should prove that `Model` can become a first-class entity rather than a string.

## Core URL decision

Use a globally unique model tag as the only model URL segment:

```text
mddb.dev/models/<model-name-tag>
```

Examples:

```text
mddb.dev/models/claude-sonnet-4
mddb.dev/models/gpt-4o
mddb.dev/models/gemini-2-5-pro
mddb.dev/models/deepseek-r1
```

Do **not** include provider or brand in the canonical model URL:

```text
# Avoid
mddb.dev/models/anthropic/claude-sonnet-4
mddb.dev/models/openai/gpt-4o
```

Rationale:

- the tag is the canonical identity and should be globally unique;
- provider/brand is an attribute, not part of identity;
- aliases, snapshots, and routed names may cross provider/platform namespaces;
- brand lists can be generated dynamically from model metadata;
- short URLs are easier to share, cite, and expose as REST resources.

Brand/provider aggregation remains available as query/filter/list surfaces:

```text
mddb.dev/models?brand=anthropic
mddb.dev/brands/anthropic
mddb.dev/api/models?brand=anthropic
```

## Canonical tag rules

A canonical model tag is:

- lowercase ASCII;
- URL-safe: `a-z`, `0-9`, and `-` only;
- stable across snapshots;
- based on the vendor's logical model name with date suffixes removed;
- unique across the registry;
- never reused for a different logical model.

Normalization rules:

1. Lowercase.
2. Trim whitespace.
3. Replace separators (`_`, `.`, `/`, spaces, repeated punctuation) with `-`.
4. Normalize common version notation:
   - `2.5` → `2-5`
   - `4o` stays `4o`
   - `r1` stays `r1`
5. Strip snapshot/date suffixes into the snapshot table, not the canonical tag:
   - `claude-sonnet-4-20250514` → tag `claude-sonnet-4`, snapshot `20250514`
   - `gpt-4o-2024-08-06` → tag `gpt-4o`, snapshot `2024-08-06`
6. Preserve meaningful family/version suffixes:
   - `deepseek-r1` is not reduced to `deepseek`
   - `gemini-2-5-pro` is not reduced to `gemini-2-5`
7. If two vendors use the same logical model string for different entities, resolve by explicit registry override before publishing.

## Data model MVP

### `brands`

Represents the model owner or major brand used for aggregation.

Fields:

- `id`: internal ID
- `slug`: URL-safe brand slug, e.g. `anthropic`, `openai`, `google`, `deepseek`
- `display_name`: human-readable name
- `website_url`

### `models`

Canonical logical model entity.

Fields:

- `tag`: primary key, globally unique URL tag
- `brand_slug`: foreign key to `brands.slug`
- `display_name`: e.g. `Claude Sonnet 4`
- `family`: e.g. `claude`, `gpt`, `gemini`, `deepseek`
- `description`
- `status`: `current`, `deprecated`, `sunset`, `unknown`
- `context_window`
- `max_output_tokens`
- `modalities_input`: array, e.g. `text`, `image`, `audio`
- `modalities_output`: array
- `supports_tools`
- `supports_vision`
- `supports_json_schema`
- `supports_prompt_cache`
- `source_priority_summary`
- `first_seen_at`
- `last_verified_at`

### `model_aliases`

All names that should resolve to a canonical tag.

Fields:

- `alias`: raw alias string, indexed
- `normalized_alias`: normalized lookup key
- `model_tag`: canonical model tag
- `source`: `official`, `models.dev`, `llm-metadata`, `openrouter`, `manual`, etc.
- `alias_type`: `official`, `snapshot`, `provider_route`, `third_party`, `colloquial`
- `confidence`: numeric 0-1

### `model_snapshots`

Concrete dated model versions or snapshots.

Fields:

- `snapshot_id`: URL-safe ID or vendor-native name
- `model_tag`: canonical logical model
- `snapshot_name`: original name
- `released_at`
- `deprecated_at`
- `sunset_at`
- `status`: `current`, `deprecated`, `sunset`, `unknown`
- `successor_snapshot_id`

### `model_prices`

Pricing facts by source.

Fields:

- `model_tag`
- `source`: `basellm`, `models.dev`, `openrouter`, `manual`
- `currency`
- `unit`: usually `1m_tokens`
- `input_price`
- `output_price`
- `cache_read_price`
- `cache_write_price`
- `raw_source_url`
- `observed_at`

### `model_source_records`

Lossless source observations attached to a canonical model tag.

Normalization deliberately creates compact canonical fields (`tag`, `display_name`,
capability booleans, normalized price columns). Any source fields that are not
represented exactly in those canonical fields must remain searchable and
inspectable under the matched tag instead of being discarded.

Fields:

- `model_tag`: canonical tag selected by normalization
- `source`: `basellm`, `models.dev`, `openrouter`, `manual`, etc.
- `source_model_key`: raw model key from the upstream source
- `source_provider`: upstream provider/vendor namespace when present
- `source_url`: exact URL fetched for this observation
- `observed_at`
- `raw_record`: lossless JSON object for the upstream model/provider record
- `normalized`: JSON object containing canonical facts produced from this record
- `lossy_fields`: JSON object containing fields transformed, flattened, omitted,
  conflict-lost, or otherwise not exactly represented in canonical columns

Examples of lossy data to preserve:

- `models.dev` provider namespace when multiple providers publish the same model key;
- `models.dev` cost fields that cannot be converted to New API ratios, such as
  `input=0` with non-zero output, missing input baseline, or provider-specific
  cache fields not yet modeled;
- BaseLLM/New API ratio config values after converting `model_ratio`,
  `completion_ratio`, and `cache_ratio` back into display pricing facts;
- source-specific metadata names, aliases, limits, modalities, routing hints, and
  conflict candidates that did not win the canonical merge.

Rule: if normalization or merge logic drops fidelity, write the dropped fact into
`model_source_records.lossy_fields` under the same `model_tag` so detail pages and
search can explain where a canonical fact came from and what was not normalized.

## Normalization engine MVP

The first normalization function should expose this interface:

```ts
type NormalizeModelNameResult = {
  input: string
  normalizedInput: string
  matchedTag: string | null
  confidence: number
  matchType: 'exact_tag' | 'exact_alias' | 'snapshot_alias' | 'heuristic' | 'none'
  reason: string
}
```

Resolution order:

1. exact canonical tag match;
2. exact normalized alias match;
3. snapshot alias match;
4. deterministic heuristic strip-date-and-normalize;
5. no match.

No LLM-based matching in Phase 1. The output must be deterministic and testable.

## Web surfaces MVP

### Human pages

- `/`: search-first landing page with project explanation and recently updated models.
- `/models`: full model list with filters for brand, capability, status, and price availability.
- `/models/<tag>`: canonical model detail page.
- `/brands`: generated brand index.
- `/brands/<brand-slug>`: all models for one brand.

### API routes

- `/api/models`
- `/api/models/<tag>`
- `/api/normalize?model=<name>`
- `/api/brands`
- `/api/brands/<brand-slug>/models`

## Data source strategy

Initial sources, in priority order for Phase 1:

1. `llm-metadata` for new-api-team-maintained model metadata derived from models.dev.
2. `models.dev` for broad upstream model/capability/pricing metadata.
3. BaseLLM ratio config for New API-native pricing/multiplier data.
4. Manual seed overrides for canonical tags, alias decisions, and snapshot grouping.

Conflicts:

- canonical tag and alias grouping: manual overrides win;
- price: BaseLLM/New API-native source wins when available;
- capability fields: models.dev or llm-metadata wins unless manual override exists;
- all conflict decisions should record source and timestamp.

## Recommended tech stack

- Next.js + TypeScript for web and API routes.
- SQLite for local MVP storage.
- Drizzle ORM for schema and migrations.
- Deterministic import scripts under `scripts/`.
- Vitest for normalization and importer tests.

SQLite is enough for Phase 1 because data volume is small, writes are batch imports, and deployment is simpler. Keep schema portable so Postgres migration remains easy.

## Initial implementation milestones

1. Initialize the TypeScript app in the repository root.
2. Add DB schema for brands, models, aliases, snapshots, prices.
3. Add deterministic tag normalization library with tests.
4. Add seed fixture covering OpenAI, Anthropic, Google, DeepSeek, xAI, Qwen, Mistral.
5. Add import script for one reference source.
6. Add `/api/normalize` and `/api/models/<tag>`.
7. Add `/models`, `/models/<tag>`, `/brands/<slug>` pages.
8. Deploy behind `mddb.dev` after local verification.

## Open decisions

- Deployment target: self-hosted Node service, Docker Compose, or static + API service.
- Whether to expose `.json` canonical URLs, e.g. `/models/claude-sonnet-4.json`, in addition to `/api/models/claude-sonnet-4`.
- Whether canonical tags should include vendor prefix only when necessary to disambiguate future collisions.
