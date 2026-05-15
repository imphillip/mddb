# OpenRouter-first Registry Implementation Plan

> Maintainers: implement this plan task-by-task and keep changes covered by tests.

**Goal:** Convert the current OpenRouter-derived site into a registry-first pipeline with canonical data artifacts and machine-readable exports for new-api/sub2api consumers.

**Architecture:** OpenRouter remains the first imported source, but importer output flows into canonical registry files (`models`, `aliases`, `snapshots`, `variants`, `deployments`, `prices`, `sourceRecords`) before website/API projections are generated. The site and downstream JSON exports consume registry projections instead of coupling directly to OpenRouter source records.

**Tech Stack:** TypeScript, Vitest, static JSON artifacts, existing static HTML build.

---

## Preconditions

- Working directory: repository root
- Relevant docs:
  - `docs/architecture.md`
  - `docs/model-identity-normalization.md`
  - `docs/research/openrouter-base-source.md`
- Existing commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run build`
- Use strict TDD for production code changes.

## Task 1: Add canonical registry schema types

**Objective:** Define the stable registry objects that all importers and projections use.

**Files:**

- Create: `src/lib/registry-schema.ts`
- Test: `src/lib/registry-schema.test.ts`

**Step 1: Write failing tests**

Create tests for two small validators/helpers:

```ts
import { describe, expect, it } from 'vitest'
import { isValidModelTag, makeRegistryMetadata } from './registry-schema.js'

describe('registry schema helpers', () => {
  it('accepts lowercase hyphen-only model tags', () => {
    expect(isValidModelTag('claude-haiku-4-5')).toBe(true)
    expect(isValidModelTag('gpt-4o')).toBe(true)
  })

  it('rejects provider paths, periods, underscores, and empty segments', () => {
    expect(isValidModelTag('anthropic/claude-haiku-4-5')).toBe(false)
    expect(isValidModelTag('gemini-2.5-pro')).toBe(false)
    expect(isValidModelTag('claude_haiku_4_5')).toBe(false)
    expect(isValidModelTag('claude--haiku')).toBe(false)
  })

  it('creates deterministic metadata from source summaries', () => {
    expect(
      makeRegistryMetadata({
        generatedAt: '2026-05-14T00:00:00.000Z',
        sources: [
          {
            source: 'openrouter',
            sourceUrl: 'https://openrouter.ai/api/v1/models',
            observedAt: '2026-05-14T00:00:00.000Z',
            recordCount: 2,
            skippedCount: 1,
          },
        ],
      }),
    ).toMatchObject({ schemaVersion: '1', generatedAt: '2026-05-14T00:00:00.000Z' })
  })
})
```

Run:

```bash
npm test -- src/lib/registry-schema.test.ts
```

Expected: FAIL because the file does not exist.

**Step 2: Implement schema types and helpers**

`registry-schema.ts` should export:

- `SourceName`
- `RegistryMetadata`
- `ModelCapabilities`
- `RegistryModel`
- `RegistryAlias`
- `RegistrySnapshot`
- `RegistryVariant`
- `RegistryDeployment`
- `RegistryPriceFact`
- `RegistrySourceRecord`
- `RegistryBrand`
- `RegistryProvider`
- `RegistryDataset`
- `isValidModelTag(tag: string): boolean`
- `makeRegistryMetadata(input): RegistryMetadata`

Use the field names from `docs/architecture.md` but TypeScript camelCase.

**Step 3: Run tests**

```bash
npm test -- src/lib/registry-schema.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/registry-schema.ts src/lib/registry-schema.test.ts
git commit -m "feat: add registry schema types"
```

## Task 2: Build registry from OpenRouter catalog

**Objective:** Convert `OpenRouterCatalog` into canonical registry objects.

**Files:**

- Create: `src/lib/registry-builder.ts`
- Test: `src/lib/registry-builder.test.ts`
- Read: `src/lib/openrouter-importer.test.ts`

**Step 1: Write failing tests**

Use fixtures mirroring `openrouter-importer.test.ts`. Assertions:

- `anthropic/claude-opus-4.7-fast` produces:
  - model tag `claude-opus-4-7`
  - alias `anthropic/claude-opus-4.7-fast`
  - snapshot marker `20260512`
  - variant `fast`
  - deployment route `anthropic/claude-opus-4.7-fast`
  - price fact with `inputPricePer1mUsd: 30`, `outputPricePer1mUsd: 150`, `newApiRatios.modelRatio: 15`
- `openai/gpt-4o` and `openai/gpt-4o-2024-08-06` merge into one `gpt-4o` model.
- Every source record preserves raw OpenRouter record.

Run:

```bash
npm test -- src/lib/registry-builder.test.ts
```

Expected: FAIL because builder does not exist.

**Step 2: Implement `buildRegistryFromOpenRouterCatalog`**

Suggested signature:

```ts
export function buildRegistryFromOpenRouterCatalog(
  catalog: OpenRouterCatalog,
  options: {
    sourceUrl: string
    observedAt: string
    generatedAt: string
  },
): RegistryDataset
```

Implementation rules:

- Group `catalog.records` by `canonicalTag`.
- Create one `RegistryModel` per tag using the primary record scoring already used by `openrouter-gallery.ts`.
- Create aliases from every `record.aliases` entry.
- Create snapshots from `record.snapshot` when present.
- Create variants from `record.variant` when present.
- Create deployments from every OpenRouter record.
- Create price facts from every OpenRouter record unless `ratioStatus` indicates skipped/unsupported; preserve unsupported facts in source records.
- Create source records for every OpenRouter record.
- Sort all arrays deterministically.

**Step 3: Run targeted tests**

```bash
npm test -- src/lib/registry-builder.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib/registry-builder.ts src/lib/registry-builder.test.ts
git commit -m "feat: build registry from OpenRouter catalog"
```

## Task 3: Add Claude family-order alias generation to registry build

**Objective:** Ensure equivalent Claude IDs resolve consistently, including `claude-haiku-4-5-20251001`, `claude-4-5-haiku`, and `claude-haiku-4-5`.

**Files:**

- Modify: `src/lib/model-normalization.ts`
- Modify: `src/lib/model-normalization.test.ts`
- Modify: `src/lib/registry-builder.ts`
- Modify: `src/lib/registry-builder.test.ts`

**Step 1: Write failing tests**

Add tests that assert:

```ts
normalizeModelName('claude-4-5-haiku', { tags: ['claude-haiku-4-5'] }).matchedTag === 'claude-haiku-4-5'
normalizeModelName('claude-haiku-4-5-20251001', { tags: ['claude-haiku-4-5'] }).matchedTag === 'claude-haiku-4-5'
normalizeModelName('claude-haiku-4-5', { tags: ['claude-haiku-4-5'] }).matchedTag === 'claude-haiku-4-5'
```

Also assert registry aliases include generated Claude order aliases for Claude records.

Run:

```bash
npm test -- src/lib/model-normalization.test.ts src/lib/registry-builder.test.ts
```

Expected: FAIL for the generated/order alias case if not implemented thoroughly.

**Step 2: Implement helper**

Add a helper such as:

```ts
export function generateClaudeFamilyAliases(tag: string): ModelAliasRecord[]
```

For `claude-haiku-4-5`, generate at least:

- `claude-haiku-4-5`
- `claude-4-5-haiku`

Snapshot aliases are generated from source snapshot records rather than invented dates.

**Step 3: Wire into registry builder**

When a model tag matches `^claude-(haiku|sonnet|opus)-\d+-\d+$`, add generated aliases with `aliasType: 'generated'` or `third_party` depending on the final union type. If `aliasType` union does not allow `generated`, update schema to allow it.

**Step 4: Run tests**

```bash
npm test -- src/lib/model-normalization.test.ts src/lib/registry-builder.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/model-normalization.ts src/lib/model-normalization.test.ts src/lib/registry-builder.ts src/lib/registry-builder.test.ts src/lib/registry-schema.ts
git commit -m "feat: generate Claude family aliases"
```

## Task 4: Generate checked-in registry artifacts

**Objective:** Build `data/registry/*.json` deterministically from `data/openrouter-models.json`.

**Files:**

- Create: `src/scripts/build-registry.ts`
- Modify: `package.json`
- Generated: `data/registry/*.json`
- Test: optional `src/scripts/build-registry.test.ts` if helper extraction is needed

**Step 1: Write failing test or smoke command**

Prefer extracting a small pure function and testing it. If not practical, first add script command and run:

```bash
npm run build:registry
```

Expected: FAIL because command/script does not exist.

**Step 2: Implement script**

Command in `package.json`:

```json
"build:registry": "tsc && node dist/scripts/build-registry.js"
```

Script behavior:

- Load `data/openrouter-models.json`.
- Import via `importOpenRouterModels`.
- Build registry with `buildRegistryFromOpenRouterCatalog`.
- Write pretty JSON with trailing newline to:
  - `data/registry/metadata.json`
  - `data/registry/models.json`
  - `data/registry/aliases.json`
  - `data/registry/snapshots.json`
  - `data/registry/variants.json`
  - `data/registry/deployments.json`
  - `data/registry/prices.json`
  - `data/registry/source-records.json`
  - `data/registry/brands.json`
  - `data/registry/providers.json`

**Step 3: Run script and verify files**

```bash
npm run build:registry
```

Expected: JSON files created.

**Step 4: Run tests/typecheck**

```bash
npm test
npm run typecheck
```

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json src/scripts/build-registry.ts data/registry
 git commit -m "feat: generate registry artifacts"
```

## Task 5: Add public API projections

**Objective:** Generate machine-readable public JSON under `public/api/`.

**Files:**

- Create: `src/lib/registry-projections.ts`
- Create: `src/lib/registry-projections.test.ts`
- Modify: `src/scripts/build-site.ts` or add `src/scripts/build-public-api.ts`

**Step 1: Write failing tests**

Assertions:

- `toPublicModelList(dataset)` emits compact model summaries.
- `toPublicModelDetail(dataset, 'gpt-4o')` includes aliases, snapshots, deployments, prices, and source summary.
- `toNewApiRatioConfig(dataset)` emits New API-compatible `model_ratio`, `completion_ratio`, `cache_ratio`, `create_cache_ratio`, and `model_price` maps only when supported.
- `toSub2ApiModels(dataset)` emits tag, aliases, providers, capabilities, and prices.

Run:

```bash
npm test -- src/lib/registry-projections.test.ts
```

Expected: FAIL.

**Step 2: Implement projections**

Export pure functions:

```ts
export function toPublicModelList(dataset: RegistryDataset): unknown
export function toPublicModelDetail(dataset: RegistryDataset, tag: string): unknown
export function toAliasLookup(dataset: RegistryDataset): unknown
export function toNewApiRatioConfig(dataset: RegistryDataset): unknown
export function toSub2ApiModels(dataset: RegistryDataset): unknown
```

**Step 3: Wire generation**

During build, write:

- `public/api/models.json`
- `public/api/models/<tag>.json`
- `public/api/aliases.json`
- `public/api/newapi/ratio_config-v1-base.json`
- `public/api/sub2api/models.json`

**Step 4: Run tests/build**

```bash
npm test -- src/lib/registry-projections.test.ts
npm run build
```

Expected: PASS and files exist under `public/api/`.

**Step 5: Commit**

```bash
git add src/lib/registry-projections.ts src/lib/registry-projections.test.ts src/scripts package.json public/api
git commit -m "feat: publish registry API projections"
```

## Task 6: Refactor site rendering to consume registry projections

**Objective:** Decouple the website from OpenRouter-specific records.

**Files:**

- Modify: `src/lib/openrouter-gallery.ts` or replace with `src/lib/registry-gallery.ts`
- Modify: `src/scripts/build-site.ts`
- Modify tests under `src/lib/*gallery*.test.ts` and `src/lib/deployment-separation.test.ts`

**Step 1: Write/update failing tests**

Assert build-site reads registry artifacts or builds registry first, not OpenRouter records directly.

Run:

```bash
npm test -- src/lib/deployment-separation.test.ts
```

Expected: FAIL after test update.

**Step 2: Implement refactor**

- Convert `RegistryDataset` to the existing `ModelGallery`/`ModelDetail` UI shape.
- Keep URLs stable.
- Preserve current model plaza behavior.

**Step 3: Run tests and build**

```bash
npm test
npm run typecheck
npm run build
```

Expected: PASS.

**Step 4: Commit**

```bash
git add src/lib src/scripts public
git commit -m "refactor: render site from registry data"
```

## Task 7: Deploy and verify published surfaces

**Objective:** Make the OpenRouter-first registry inspectable on mddb.dev.

**Files:** generated `public/` and runtime deployment only.

**Step 1: Ensure clean committed workspace**

```bash
git status --short
```

Expected: clean.

**Step 2: Build**

```bash
npm run build
```

Expected: PASS.

**Step 3: Deploy**

```bash
npm run deploy
```

Expected: deploy script succeeds.

**Step 4: Smoke-check public endpoints**

```bash
curl -fsS https://mddb.dev/models/ >/tmp/mddb-models.html
curl -fsS https://mddb.dev/api/models.json >/tmp/mddb-models.json
curl -fsS https://mddb.dev/api/newapi/ratio_config-v1-base.json >/tmp/mddb-ratio.json
```

Expected: all HTTP requests succeed and files are non-empty.

**Step 5: Final commit if deploy generated tracked changes**

Normally deploy should not modify tracked files. If it does, inspect before committing.

## Completion checklist

- [ ] `docs/architecture.md` committed.
- [ ] Canonical registry schema exists.
- [ ] OpenRouter records build registry artifacts.
- [ ] Claude family-order aliases resolve consistently.
- [ ] `data/registry/*.json` generated deterministically.
- [ ] `public/api/models.json` generated.
- [ ] `public/api/newapi/ratio_config-v1-base.json` generated.
- [ ] `public/api/sub2api/models.json` generated.
- [ ] Website uses registry projection, not raw OpenRouter coupling.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Changes committed locally.
- [ ] Deployment completed after commit.
