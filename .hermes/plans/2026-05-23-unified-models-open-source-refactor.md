# Open-source Unified Models JSON Refactor Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Refactor the open-source mddb.dev deliverable so the registry is centered on one unified `data/models.json`, without provider/deployer-only catalogs, with official pricing/endpoints embedded on models and prices rendered with explicit currency symbols.

**Architecture:** Treat `models.json` as the public/open-source contract. OpenRouter seeds mainstream reasoning models; LiteLLM fills embedding/video/audio/specialized models and can replace OpenRouter pricing when it is more detailed; models.dev only contributes provider/author icons; BaseLLM/NewAPI is removed from the open-source data pipeline. Frontend pages should render only model-centered surfaces: model list, model detail, and model/news tags as needed; provider plaza and currency switching are removed.

**Tech Stack:** Node.js scripts (`scripts/*.mjs`), static JSON under `data/`, TypeScript renderers/tests under `web/src/lib`, Vitest, `npm run build` static generation.

---

## Target Contract

### Unified model shape

`data/models.json` remains the only open-source registry deliverable. Each row should include model identity/spec plus official commercial serving info:

```ts
type ModelPrice = {
  currency: 'USD' | 'CNY' | string
  source: 'openrouter' | 'litellm' | 'author' | string
  source_url?: string
  unit_prices: Record<string, { amount: number; unit: string; condition?: string }>
  endpoint?: {
    provider_id: string
    provider_name: string
    api_model_id?: string
    base_url?: string
    docs_url?: string
  }
}

type ModelRecord = {
  id: string
  name: string
  author_id: string
  author: string
  icon?: string
  description?: string
  mode?: string
  modalities?: Record<string, string[]>
  context_length?: number
  max_output_tokens?: number
  release_date?: string
  deprecation_date?: string
  prices?: ModelPrice[]
  sources: Array<{ source: string; id: string; url?: string; observed_at?: string }>
  aliases?: string[]
  other_parameters?: Record<string, unknown>
}
```

Notes:

- If the author deploys the model, use the author endpoint/price as official.
- If the author does not deploy, choose one deployer endpoint/price as the official fallback for that model.
- Future multiple prices are allowed only when they are official prices for the same model, such as official regional/currency variants.
- Do not retain provider/deployer-only catalogs as an open-source deliverable.
- `data/providers/*.json` may exist temporarily during migration, but must not be treated as part of the final public contract.

### Data source responsibilities

- OpenRouter:
  - Mainstream reasoning/chat models.
  - Canonical author identity baseline.
  - Official/fallback endpoint and price when appropriate.
- LiteLLM:
  - Embedding, video, audio, rerank, speech, transcription, and other specialized models.
  - Lifecycle metadata such as `deprecation_date`.
  - More detailed pricing, including tiered/conditional prices.
- OpenRouter + LiteLLM conflict rule:
  - If both provide pricing for the same model, select the more detailed commercial price row.
  - Usually LiteLLM wins when it has tiered/conditional pricing.
  - Do not duplicate equivalent price rows from both sources.
- models.dev:
  - Icons only, mapped to `author_id`/model author identity where safe.
  - No model creation, provider offer creation, or price import.
- BaseLLM/NewAPI:
  - Removed from the open-source data source set.

### Frontend contract

- Remove provider plaza/directory as a public surface.
- Remove currency switch UI and script.
- Every visible price must include its currency symbol or currency code inline, e.g. `$3`, `￥5`, `USD 3` when the symbol is unknown.
- Model list and detail pages should not depend on provider files to render prices.
- Provider/deployer can appear only as endpoint attribution inside a model’s official price/endpoint block.

---

## Task 1: Add contract tests for unified `models.json`

**Objective:** Create failing tests that define the new open-source data contract before changing import code.

**Files:**
- Create/Modify: `web/src/lib/open-source-models-contract.test.ts`
- Read: `data/models.json`

**Step 1: Write failing tests**

Add tests that assert:

- `data/models.json` exists and has `models` array.
- model IDs are unique.
- aliases are globally unique.
- every model has `author_id` and `author`.
- if a model has prices, every price has explicit `currency` and at least one numeric unit price.
- price endpoints are embedded under the model price row, not resolved only through `data/providers`.
- no price source is `basellm-newapi`.

**Suggested test skeleton:**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type JsonRecord = Record<string, any>

function readModels() {
  return JSON.parse(readFileSync(join(process.cwd(), 'data', 'models.json'), 'utf8')).models as JsonRecord[]
}

describe('open-source unified models.json contract', () => {
  it('uses unique canonical model ids and aliases', () => {
    const models = readModels()
    const ids = models.map((model) => model.id)
    expect(new Set(ids).size).toBe(ids.length)
    const aliases = models.flatMap((model) => Array.isArray(model.aliases) ? model.aliases : [])
    expect(new Set(aliases).size).toBe(aliases.length)
  })

  it('stores author identity and official pricing/endpoints on models', () => {
    const bad = readModels().filter((model) => {
      if (!model.author_id || !model.author) return true
      for (const price of model.prices ?? []) {
        if (!price.currency) return true
        if (!price.unit_prices || !Object.values(price.unit_prices).some((row: any) => typeof row?.amount === 'number')) return true
        if (!price.endpoint?.provider_id || !price.endpoint?.provider_name) return true
      }
      return false
    })
    expect(bad.map((model) => model.id)).toEqual([])
  })

  it('excludes BaseLLM/NewAPI from open-source model data', () => {
    const offenders = readModels().filter((model) => JSON.stringify(model).includes('basellm-newapi'))
    expect(offenders.map((model) => model.id)).toEqual([])
  })
})
```

**Step 2: Run test to verify RED**

Run:

```bash
npm test -- --run web/src/lib/open-source-models-contract.test.ts
```

Expected: FAIL initially because existing rows do not yet embed official price/endpoints in the target shape.

**Step 3: Commit only if this is a pure test checkpoint**

```bash
git add web/src/lib/open-source-models-contract.test.ts
git commit -m "test: define unified models contract"
```

---

## Task 2: Introduce shared model price helpers

**Objective:** Add helper functions for currency-aware prices and detailed-price selection without touching importers yet.

**Files:**
- Create: `scripts/lib/model-pricing.mjs`
- Create: `scripts/lib/model-pricing.test.mjs`

**Step 1: Write failing tests**

Test these behaviors:

- `priceDetailScore(price)` counts number of unit rows and condition/tier metadata.
- `selectBestPrice(openrouterPrice, litellmPrice)` picks LiteLLM when it has tiered/conditional details.
- It does not choose a `:free`/free-tier route over a commercial price.
- It preserves `currency` and endpoint attribution.

**Step 2: Run RED**

```bash
npm test -- --run scripts/lib/model-pricing.test.mjs
```

Expected: FAIL because helper does not exist.

**Step 3: Implement minimal helper**

Create pure functions only. Do not read/write files in this module.

**Step 4: Verify GREEN**

```bash
npm test -- --run scripts/lib/model-pricing.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/lib/model-pricing.mjs scripts/lib/model-pricing.test.mjs
git commit -m "feat: add model pricing selection helpers"
```

---

## Task 3: Embed OpenRouter official/fallback prices into `models.json`

**Objective:** Change the OpenRouter importer so model rows include author identity and initial official/fallback price endpoint rows.

**Files:**
- Modify: `scripts/populate-registry-openrouter.mjs`
- Modify/Test: `scripts/populate-registry-openrouter.test.mjs`
- Use helper: `scripts/lib/model-pricing.mjs`

**Step 1: Write failing tests**

Add fixture assertions that after OpenRouter import:

- a model row has `author_id` and `author`.
- a model row has `prices[0].currency === 'USD'` when OpenRouter has USD pricing.
- `prices[0].endpoint.provider_id` is the author provider when author deploys.
- fallback deployer endpoint is used only when no author deployer offer exists.
- OpenRouter-only provider/deployer offers are not required to render the model price.

**Step 2: Run RED**

```bash
npm test -- --run scripts/populate-registry-openrouter.test.mjs
```

Expected: FAIL on new embedded model price expectations.

**Step 3: Implement minimal importer change**

- Keep existing provider file output temporarily for compatibility, but mark it migration-only in code comments.
- Add `author_id`, `author`, and `prices` to model rows.
- Convert OpenRouter prompt/completion/cache/image prices into `unit_prices` with `currency: 'USD'`.
- Filter promotional `:free` routes from official prices.

**Step 4: Verify GREEN**

```bash
npm test -- --run scripts/populate-registry-openrouter.test.mjs web/src/lib/open-source-models-contract.test.ts
```

**Step 5: Commit**

```bash
git add scripts/populate-registry-openrouter.mjs scripts/populate-registry-openrouter.test.mjs data/models.json
git commit -m "feat: embed openrouter model prices"
```

---

## Task 4: Make LiteLLM enrich unified model rows directly

**Objective:** Change LiteLLM import so it creates specialized models and enriches existing models directly in `models.json`, selecting more detailed prices over OpenRouter when applicable.

**Files:**
- Modify: `scripts/populate-litellm-models.mjs`
- Modify/Test: `scripts/populate-litellm-models.test.mjs`
- Use helper: `scripts/lib/model-pricing.mjs`

**Step 1: Write failing tests**

Assert:

- allowed non-chat modes can create model rows.
- chat/reasoning aliases only enrich existing OpenRouter rows, not create wrapper pollution.
- `deprecation_date` is preserved.
- tiered/conditional LiteLLM price replaces or outranks simpler OpenRouter price for same model.
- equivalent OpenRouter/LiteLLM prices are deduped.

**Step 2: Run RED**

```bash
npm test -- --run scripts/populate-litellm-models.test.mjs
```

Expected: FAIL for embedded price selection behavior.

**Step 3: Implement minimal importer change**

- Load current `data/models.json`.
- Match LiteLLM rows to existing models via canonical ID/aliases.
- For allowed specialized modes, create model rows with `author_id`/`author` and embedded `prices` when safe.
- Use `selectBestPrice` to replace/suppress less detailed duplicate prices.
- Preserve tier `condition` strings from LiteLLM price keys.

**Step 4: Verify GREEN**

```bash
npm test -- --run scripts/populate-litellm-models.test.mjs web/src/lib/open-source-models-contract.test.ts
```

**Step 5: Commit**

```bash
git add scripts/populate-litellm-models.mjs scripts/populate-litellm-models.test.mjs data/models.json
git commit -m "feat: enrich unified models from litellm"
```

---

## Task 5: Reduce models.dev to icon-only enrichment

**Objective:** Stop models.dev from creating provider offers/prices and use it only to fill `icon` fields on model authors where safe.

**Files:**
- Replace/Modify: `scripts/populate-models-dev-providers.mjs` or create `scripts/populate-model-icons.mjs`
- Modify: `package.json`
- Modify/Test: `scripts/populate-models-dev-providers.test.mjs` or create `scripts/populate-model-icons.test.mjs`

**Step 1: Write failing tests**

Assert:

- running models.dev enrichment changes only icon-related fields in `data/models.json`.
- no `models.dev` price or provider offer is created.
- missing/disabled broken icons are not exposed.

**Step 2: Run RED**

```bash
npm test -- --run scripts/populate-models-dev-providers.test.mjs
```

Expected: FAIL because current script enriches provider files/offers.

**Step 3: Implement minimal icon-only enrichment**

- Either rename script to `populate-model-icons.mjs`, or keep old file temporarily but change behavior.
- Map models.dev provider/icon IDs to `author_id`.
- Write icons into model rows only when author match is safe.
- Do not write provider offer/price data.

**Step 4: Verify GREEN**

```bash
npm test -- --run scripts/populate-models-dev-providers.test.mjs web/src/lib/open-source-models-contract.test.ts
```

**Step 5: Commit**

```bash
git add scripts package.json data/models.json
git commit -m "feat: limit models.dev to icons"
```

---

## Task 6: Remove BaseLLM/NewAPI from open-source pipeline

**Objective:** Delete or quarantine BaseLLM/NewAPI fetch/populate commands and tests from normal open-source data flow.

**Files:**
- Modify: `package.json`
- Delete or move: `scripts/fetch-basellm-newapi.mjs`
- Delete or move: `scripts/populate-basellm-newapi-providers.mjs`
- Delete or move: `scripts/lib/populate-basellm-newapi-providers.mjs`
- Delete or move: `scripts/populate-basellm-newapi-providers.test.mjs`
- Modify: docs/tests referencing BaseLLM

**Step 1: Write failing tests**

Add/update tests that assert:

- `package.json` has no `data:basellm` or `registry:populate:basellm` script.
- `data/models.json` contains no BaseLLM source reference.

**Step 2: Run RED**

```bash
npm test -- --run web/src/lib/open-source-models-contract.test.ts
```

Expected: FAIL until scripts/data references are removed.

**Step 3: Remove pipeline references**

- Remove package scripts.
- Delete or move BaseLLM scripts to a non-public/internal migration folder only if still needed for historical reference.
- Remove BaseLLM provider backfill docs from active strategy docs.

**Step 4: Verify GREEN**

```bash
npm test -- --run web/src/lib/open-source-models-contract.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove basellm from open source pipeline"
```

---

## Task 7: Remove provider plaza and provider routes from frontend

**Objective:** Remove provider/deployer-only public surfaces while preserving model-centered pages.

**Files:**
- Modify: `web/src/lib/site-renderer.ts`
- Modify: `web/src/lib/registry-graph.ts` if provider graph becomes obsolete
- Modify: `scripts/build-site.ts` or build route generator if it emits `/providers/`
- Modify tests: `web/src/lib/site-renderer.test.ts`, `web/src/lib/registry-graph.test.ts`, provider-related tests

**Step 1: Write failing tests**

Assert rendered site output:

- does not include `/providers/` provider plaza links.
- does not generate provider plaza HTML files.
- model detail pages may show endpoint attribution inside price rows but not provider catalog sections.
- navigation only includes model-centered pages and GitHub/source links.

**Step 2: Run RED**

```bash
npm test -- --run web/src/lib/site-renderer.test.ts web/src/lib/registry-graph.test.ts
```

Expected: FAIL while provider plaza still exists.

**Step 3: Remove provider public surfaces**

- Delete provider plaza renderer functions or leave only private helpers not used by build.
- Remove provider route generation.
- Remove provider nav links/cards.
- Keep author icons available through `models.json` only.

**Step 4: Verify GREEN**

```bash
npm test -- --run web/src/lib/site-renderer.test.ts web/src/lib/registry-graph.test.ts
```

**Step 5: Commit**

```bash
git add web/src/lib scripts/build-site.ts
git commit -m "feat: remove provider plaza from open source site"
```

---

## Task 8: Remove currency switching and render explicit currency symbols

**Objective:** Replace toggle-based USD/CNY switching with inline explicit currency labels on every visible price.

**Files:**
- Modify: `web/src/lib/site-renderer.ts`
- Modify: CSS/JS embedded by renderer
- Modify tests: `web/src/lib/site-renderer.test.ts`, `web/src/lib/pricing.test.ts`

**Step 1: Write failing tests**

Assert:

- no currency toggle markup/script is emitted.
- no `data-usd`/`data-cny` price-switch attributes are required for display.
- USD prices render with `$`.
- CNY prices render with `￥`.
- unknown currency renders as code prefix, e.g. `EUR 3`.
- list rows and detail pages both show explicit currency.

**Step 2: Run RED**

```bash
npm test -- --run web/src/lib/site-renderer.test.ts web/src/lib/pricing.test.ts
```

Expected: FAIL while toggle UI exists and prices depend on switch attributes.

**Step 3: Implement minimal render change**

- Add `formatMoneyWithCurrency(amount, currency)` helper.
- Remove toggle HTML, JS, CSS, and nav references.
- Ensure all visible price strings call the helper.
- Preserve units/conditions, e.g. `$3 / 1M input tokens`, `￥5 / 1M output tokens`, `$0.10 / image (above 128k tokens)`.

**Step 4: Verify GREEN**

```bash
npm test -- --run web/src/lib/site-renderer.test.ts web/src/lib/pricing.test.ts
```

**Step 5: Commit**

```bash
git add web/src/lib
git commit -m "feat: render explicit price currencies"
```

---

## Task 9: Regenerate data and remove obsolete provider artifacts

**Objective:** Run the new OpenRouter + LiteLLM + icon-only data pipeline and remove provider/deployer-only data from the public contract.

**Files:**
- Modify: `data/models.json`
- Delete or quarantine: `data/providers/*.json` if no longer needed by build/tests
- Modify docs and tests as necessary

**Step 1: Run pipeline**

```bash
npm run registry:populate:openrouter
npm run registry:populate:litellm
npm run registry:populate:models-dev
```

Expected: `data/models.json` changes; no BaseLLM step.

**Step 2: Run contract audit**

```bash
npm test -- --run web/src/lib/open-source-models-contract.test.ts
```

Expected: PASS.

**Step 3: Remove provider artifacts only after frontend no longer needs them**

If tests/build no longer require `data/providers`, remove them from public tracked data. If a temporary compatibility layer still needs them, add a follow-up task instead of deleting prematurely.

**Step 4: Full verification**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all PASS.

**Step 5: Commit**

```bash
git add -A data web scripts package.json docs
git commit -m "data: regenerate unified open source models"
```


---

## Task 10: Update public docs and README positioning

**Objective:** Make documentation match the new open-source deliverable and avoid promising provider catalog coverage.

**Files:**
- Modify: `README.md`
- Modify: `docs/registry-source-strategy.md`
- Modify: `docs/mddb-schema-v1.md`
- Modify other public docs mentioning provider plaza, BaseLLM, provider offers, or currency switching

**Step 1: Write failing doc/reference tests if existing doc tests cover public copy**

Search first:

```bash
rg "provider plaza|providers|BaseLLM|currency|货币|供应商|服务商" README.md docs web/src/lib -n
```

Add/update tests if existing renderer/doc tests assert these strings.

**Step 2: Update docs**

State clearly:

- Open-source deliverable: `data/models.json`.
- Source policy: OpenRouter + LiteLLM, models.dev icons only, no BaseLLM.
- Price policy: official author price/endpoint, or chosen fallback deployer only when author does not deploy.
- Multiple prices: official regional/currency variants only.

**Step 3: Verify**

```bash
npm test
npm run typecheck
npm run build
```

**Step 4: Commit**

```bash
git add README.md docs web/src/lib
git commit -m "docs: describe unified models open source contract"
```

---

## Final Verification Checklist

Run before final merge/push:

```bash
npm test
npm run typecheck
npm run build
node -e "const m=require('./data/models.json').models; console.log({models:m.length, withPrices:m.filter(x=>x.prices?.length).length, basellm:JSON.stringify(m).includes('basellm')})"
```

Expected:

- All tests pass.
- Typecheck passes.
- Build passes.
- `basellm: false`.
- Site has no provider plaza links.
- Site has no currency toggle.
- Prices visibly include `$`, `￥`, or currency code.
- `data/models.json` is sufficient to render model list/detail pricing without `data/providers`.

## Implementation Notes / Pitfalls

- Do not delete provider files before frontend and build no longer depend on them.
- Do not treat every OpenRouter endpoint provider as an official model price. Prefer author deployment; fallback only when author does not deploy.
- Do not import `:free` as official commercial price.
- Do not use models.dev pricing/offers.
- Do not preserve BaseLLM in active package scripts or open-source data contract.
- Avoid graph-style indirection for the final public contract; provider/deployer facts should be model price endpoint attribution, not public catalog entities.
- Keep the commercial/private fork separate: this plan targets `/home/phillip_wu/workspace/mddb.dev` open-source repo, not `/home/phillip_wu/workspace/mddb-pro` unless explicitly requested.
