# mddb.dev Wiki-style Registry Refactor Plan

**Goal:** Rework mddb.dev toward a small-footprint, open-source model/provider registry that supports provider self-registration and provider/price comparison without prematurely freezing the final schema.

**Current decision:** Do an experimental data backfill first. Use LiteLLM as the primary seed source and OpenRouter as a supplemental commercial-provider source. Derive real `models.json` and `providers/*.json` samples, then finalize schema from observed data.

---

## 1. Product Direction

mddb.dev becomes closer to a lightweight LLM wiki:

- Public entry types: `model` and `provider`.
- `models.json` is the main model fact file, maintained primarily by mddb maintainers.
- Each provider has one JSON file under `providers/`.
- Provider files contain their own offers, prices, and endpoint information.
- Provider contribution stays GitHub-PR-based to keep infra small.

Primary use cases:

1. **Provider registration**
   - Gateway/reseller/provider operators can register themselves.
   - They can list supported model offers.
   - Their offers inherit canonical model facts where a model match exists.
   - They can export data for their own gateway/new-api/LiteLLM-style site.

2. **AI application developer comparison**
   - Developers can compare providers for the same or related model.
   - USD and CNY prices must both be first-class original currencies.
   - Provider offers may have prices, but price is optional.
   - Endpoint and API model ID comparison is as important as pricing.

---

## 2. Current Modeling Decisions

### 2.1 `models.json`

- Single JSON file.
- Mainly maintainer-controlled.
- Contains model facts, not provider offer prices.
- Every model `author` must point to a provider id.
- Authors are also providers.
- Keep model facts relatively stable: name, author, family, modality, context, output limits, features, aliases, relationships, sources.

### 2.2 Provider files

Path shape:

```text
data-next/providers/<provider-id>.json
```

Each provider file contains:

- provider identity;
- roles, e.g. `model_author`, `api_provider`, `gateway`, `marketplace`, `reseller`, `cloud_platform`, `data_source`;
- top-level base URL(s);
- offers;
- optional source/provenance and verification state.

Known model authors and major companies can be maintainer-maintained. Smaller gateway/reseller providers can be user PRs.

### 2.3 Offers live inside provider files

An offer represents one provider-exposed callable model/service.

Important rules:

- `offers[].model` does **not** have to reference an existing `models.json` id.
- If it matches, it can inherit canonical model facts.
- If it does not match, it can be a candidate model.
- If it is related to an existing model, it can declare `variant_of` or similar relation.
- Price is optional.
- Endpoint info is required enough to reconstruct the callable URL.

### 2.4 Endpoint composition

Provider has base URL; offer can define path.

```text
callable_endpoint = provider.base_url + offer.path
```

Example concepts:

```json
{
  "base_url": "https://api.example.com/v1",
  "offers": [
    {
      "api_model_id": "gpt-4o-mini",
      "path": "/chat/completions"
    }
  ]
}
```

Do not assume every offer uses the same path. Chat, embeddings, image, audio, rerank, and custom endpoints may differ.

---

## 3. Source Strategy

### 3.1 LiteLLM first

Use LiteLLM `model_prices_and_context_window.json` as the primary seed because it is broad, stable, and gateway-runtime-oriented.

Source:

```text
https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
```

Expected mapping:

- outer key -> `source_model_id` / `api_model_id` candidate;
- `litellm_provider` -> provider id candidate;
- `mode` -> endpoint/path hint;
- `input_cost_per_token`, `output_cost_per_token`, cache/batch/priority fields -> offer prices;
- `max_input_tokens`, `max_output_tokens`, `max_tokens` -> model/offer limits;
- `supports_*` -> capability observations.

Do not treat LiteLLM outer keys as canonical model ids by default.

### 3.2 OpenRouter as supplemental provider data

OpenRouter is a commercial provider/gateway/marketplace, so it should be represented as a provider, not as the primary model identity authority.

Use OpenRouter data to supplement:

- OpenRouter provider file;
- OpenRouter offers;
- endpoint rows;
- route-specific prices;
- API model IDs;
- provider availability observations.

Do not let OpenRouter overwrite LiteLLM-derived experimental samples during this phase; merge it as a secondary provider/source layer.

### 3.3 Keep existing sources available, but out of first experiment scope

BaseLLM/NewAPI, models.dev, official docs, and manual data can be later layers. For this phase, use them only for comparison if needed, not for schema design.

---

## 4. Experimental Output

Write outputs under an internal path first, not production data:

```text
.internal/next-registry/
  models.json
  providers/
    openai.json
    anthropic.json
    bedrock.json
    openrouter.json
    deepseek.json
    ...
  reports/
    source-stats.json
    provider-stats.json
    model-candidates.json
    variant-candidates.json
    unmatched-offers.json
    price-field-coverage.json
```

This keeps the experiment out of public site generation until reviewed.

---

## 5. Proposed Implementation Steps

### Step 1: Add experimental builder script

Create:

```text
scripts/experimental/build-next-registry.mjs
```

Responsibilities:

- fetch or read cached LiteLLM price map;
- load existing `data/openrouter-models.json` and `data/openrouter-endpoints.json` if present;
- derive provider records;
- derive offers;
- derive tentative model records/candidates;
- write `.internal/next-registry/` outputs.

No production renderer changes in this step.

### Step 2: Add source fetch/cache helper

Prefer checked-in/current cached source files where available.

For LiteLLM, write raw cache to:

```text
.internal/next-registry/raw/litellm-model-prices.json
```

This avoids introducing live network fetches into normal site builds.

### Step 3: Map LiteLLM provider groups

Group records by `litellm_provider`.

For each provider:

- create provider id from normalized `litellm_provider`;
- infer minimal roles;
- set `source: litellm`;
- generate offers.

Initial role inference can be conservative:

- `openai`, `anthropic`, `deepseek`, `gemini`, etc. -> `api_provider` plus maybe `model_author` if known;
- `openrouter` -> `gateway`, `marketplace`;
- `bedrock`, `vertex_ai-*`, `azure` -> `cloud_platform`, `api_provider`;
- unknown -> `api_provider`.

### Step 4: Generate offers from LiteLLM rows

For each LiteLLM row, create offer fields:

```json
{
  "source": "litellm",
  "source_model_id": "...",
  "api_model_id": "...",
  "model": "... tentative ...",
  "model_match": "matched | variant | candidate | unknown",
  "variant_of": null,
  "mode": "chat",
  "path": "/chat/completions",
  "prices": [],
  "limits": {},
  "features": [],
  "raw": {}
}
```

Path inference examples:

- `chat` -> `/chat/completions`
- `completion` -> `/completions`
- `embedding` -> `/embeddings`
- image generation -> `/images/generations`
- audio transcription -> `/audio/transcriptions`
- speech -> `/audio/speech`
- unknown/custom -> null or `/chat/completions` only if safe.

### Step 5: Price conversion

LiteLLM prices are per token. Convert to per 1M tokens in provider offers.

Example:

```text
input_cost_per_token * 1_000_000 = input per 1M tokens
```

Preserve raw per-token fields in `raw` or `sources` for audit.

Support first-pass fields:

- `input`
- `output`
- `cache_read`
- `cache_write`
- `input_batch`
- `output_batch`
- `input_priority`
- `output_priority`

### Step 6: Merge OpenRouter as provider supplement

Build/augment:

```text
.internal/next-registry/providers/openrouter.json
```

From OpenRouter source files:

- create offers using OpenRouter model ids;
- set `base_url: https://openrouter.ai/api/v1`;
- infer path by model modality when possible;
- attach endpoint-specific pricing from endpoint details;
- preserve OpenRouter route IDs as `api_model_id` / `source_model_id`.

OpenRouter offers can point to existing/tentative model ids when obvious, otherwise remain candidates.

### Step 7: Generate candidate reports

Reports should answer:

- how many LiteLLM rows became provider offers;
- provider count and offer count;
- how many offers have prices;
- how many offers have no prices;
- how many offers match existing/current model ids;
- how many are likely variants;
- how many are unmatched candidates;
- top providers by offer count;
- USD/CNY coverage;
- endpoint path coverage.

### Step 8: Review data shape before schema freeze

After output is generated, inspect representative files:

- `providers/openai.json`
- `providers/anthropic.json`
- `providers/bedrock.json`
- `providers/gemini.json`
- `providers/openrouter.json`
- `models.json`
- candidate reports.

Only after this review should we write JSON Schema.

---

## 6. Validation Philosophy Before Schema

Do not start with strict JSON Schema. Start with soft validation/reporting:

- missing provider id;
- missing offer `api_model_id`;
- missing path;
- invalid currency;
- malformed prices;
- impossible context/window values;
- duplicate provider offer IDs;
- duplicate endpoint composition;
- offers that appear to be aliases/latest/free/promo;
- offers with model not found in `models.json`.

Schema should be derived from real source diversity.

---

## 7. Open Questions

- Should `models.json` include candidate models from LiteLLM immediately, or only maintainer-approved models?
- Should offer `model` be a string only, or an object with `{ id, match, variant_of }`?
- How should `base_url + path` handle providers with multiple base URLs or regional endpoints?
- How should non-token billing be represented in first schema: image, audio, video, request, search, reasoning?
- How should provider verification be shown: official, verified, community, unverified?
- How much of LiteLLM capability data belongs in `models.json` vs provider offer overrides?

---

## 8. Non-goals for This Phase

- No online editor.
- No login or user accounts.
- No production page redesign yet.
- No final JSON Schema yet.
- No migration of existing renderer until the experimental data shape is reviewed.
- No automatic deploy from this experiment.

---

## 9. Success Criteria

This phase is successful when we have:

- a generated `.internal/next-registry/models.json`;
- generated `.internal/next-registry/providers/*.json`;
- OpenRouter represented as a provider supplement;
- clear reports showing candidate/variant/unmatched distribution;
- enough real examples to decide the final schema;
- no production data or public site behavior changed.
