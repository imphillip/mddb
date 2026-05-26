# mddb.dev model store 数据管线重构计划

## Goal

把当前 mddb.dev 数据处理从“各 source importer 自由写入 `data/models.json`”重构为稳定两层/三层管线：

1. **Fetch / Source Snapshot 层**：从 OpenRouter、Bailian、Volcengine、LiteLLM、models.dev 等来源下载并保存原始或半原始数据。
2. **Normalize / Import 层**：读取 source snapshots，按固定 mapping 转成统一的 `model_item` / `offer` / `price` 结构。
3. **Build / Validate 层**：合并 normalized items，生成最终交付物 `data/models.json`，并用 schema/audit/tests 阻止结构漂移。

核心目标：`data/models.json` 是交付给用户的 model store，必须像“填空题”一样稳定；raw source 和 source-specific quirks 只能停留在内部源数据或 deterministic importer 中。

## Current context / assumptions

- 用户给了参考样例：`/home/phillip_wu/.hermes/cache/documents/doc_e387eb2ee3f9_model_item.json`。
- 该样例是 **seed example / design reference**，不是唯一标准答案，也不是最终 schema：
  - 样例中的 price keys 不一定覆盖所有来源；
  - 样例中的模型规格字段不一定完整；
  - 样例中的 endpoint / offer 结构可能需要根据 raw source 补完；
  - 最终 schema 要通过 raw source discovery + 用户确认 + tests/audit 固化。
- 样例提供的方向：
  - 顶层 model facts：`id`, `model`, `alias_id`, `alias`, `author`, `author_id`, modalities, capabilities, token limits, timestamps。
  - `offers[]` 承载每个 source/provider 的可用性、价格、endpoint、限流等。
  - `offers[].prices[]` 承载 price tiers，tier condition 放进每个 price item 的 `conditions[]`。
- 现有 `data/schema/models.schema.json` 仍描述旧模型结构，并声明 pricing/endpoint belong in provider files；但实际 `data/models.json` 已出现 `prices`，实现和 schema/policy 不一致。
- 当前已有文档：`docs/data-source-rules.md`，已固定 canonical model-id 优先级与 source 角色。
- 当前已有脚本可参考但不应被盲目延续：
  - `scripts/fetch-openrouter-models.mjs`
  - `scripts/fetch-bailian-model-market.mjs`
  - `scripts/fetch-volcengine-ark-docs.mjs`
  - `scripts/fetch-litellm-model-prices.mjs`
  - `scripts/populate-registry-openrouter.mjs`
  - `scripts/populate-litellm-models.mjs`
  - `scripts/merge-bailian-models.mjs`
  - `scripts/merge-volcengine-models.mjs`
  - `scripts/populate-models-dev-providers.mjs`
- 如果字段语义不清、是否合并不确定、price/tier/tool pricing 映射不确定，应停下来问用户，不猜。

## Model store contract discovery draft

基于用户给的 `model_item.json`，目标 `data/models.json` 的单个 model item **可能接近**下面结构。此处只是 contract discovery 的起点，不能把样例机械当作完整 schema：

```json
{
  "id": "qwen3.6-max-preview",
  "model": "Qwen 3.6 Max",
  "alias_id": ["qwen/qwen3.6-max-preview"],
  "alias": ["Qwen3.6 Max Preview"],
  "author": "qwen",
  "author_id": "qwen",
  "input_modalities": ["text"],
  "output_modalities": ["text"],
  "reasoning": true,
  "tool_calling": true,
  "context_length": 262144,
  "max_input_tokens": 245760,
  "max_output_tokens": 65536,
  "release_timestamp": 1777260242,
  "knowledge_cutoff": 1776643200,
  "last_updated": "2026-05-24T18:19:06Z",
  "offers": [
    {
      "source": "openrouter",
      "url": "https://openrouter.ai/qwen/qwen3.6-max-preview",
      "observed_at": "2026-05-19T22:11:55.841Z",
      "currency": "USD",
      "prices": [
        {
          "input": { "amount": 1.04, "unit": "per_1m_tokens" },
          "output": { "amount": 6.24, "unit": "per_1m_tokens" }
        }
      ]
    }
  ]
}
```

### Initial contract questions to document

- `id`: canonical, un-namespaced model id for URL/API within mddb.
- `model`: human display name.
- `alias_id`: source/vendor/API ids, including namespaced IDs such as `qwen/qwen3.6-max-preview` and snapshot ids.
- `alias`: human names/marketing names.
- `author` / `author_id`: normalized研发方/brand/provider identity; avoid duplicate semantics later if user decides one can be removed.
- `offers[]`: source/provider-specific facts. Prices, endpoint availability, source URL, observed time, rate limits likely belong here, but final boundaries must be confirmed against provider-file strategy.
- `offers[].prices[]`: likely each item is one price tier/condition group.
- `conditions[]`: likely always array, even single condition.
- Price dimensions such as `input`, `output`, `cache_write`, `cache_read`, `web_search`, `code_interpreter` can appear directly inside each price item if their semantics are clear from raw source.
- Avoid `mddb_registry` or another nested copy of the same model identity.
- Avoid both `prices` at model top and `offers[].prices` unless explicitly approved; preferred direction is `offers[].prices`, but migration requires schema/frontend agreement.
- Do not reject source fields just because the sample lacks them; inspect raw data and add stable fields only when semantics and placement are clear.

## Proposed approach

### Phase 0 — Freeze and document target contract

1. Add a new section to `docs/data-source-rules.md` or create `docs/model-store-schema.md`.
2. Paste/adapt the target `model_item` contract from the user sample.
3. Explicitly define layer boundaries:
   - raw source snapshots are internal and may be source-shaped;
   - final model store is stable and source-agnostic;
   - importer code maps raw source to fixed fields.
4. Add explicit forbidden patterns:
   - `mddb_registry` nested model copy;
   - source-specific arbitrary top-level fields;
   - model-level `prices` if `offers[].prices` is the approved contract;
   - duplicated identity fields with same meaning, unless retained for compatibility.

Deliverable: docs only, reviewed before large code changes.

### Phase 1 — Add schema/tests before rewrites

1. Update `data/schema/models.schema.json` to represent the target model item structure.
2. Add JSON schema definitions for:
   - `modelItem`
   - `offer`
   - `priceItem`
   - `condition`
   - `moneyAmount`
3. Add tests/fixtures:
   - fixture: user-provided model item sample should validate.
   - regression: model item with `mddb_registry` should fail.
   - regression: top-level `prices` should fail if contract moves prices under offers.
   - regression: `conditions` must be array.
4. Extend or create audit script:
   - detect forbidden keys in `data/models.json`;
   - detect free-form `unit_prices` / legacy `prices` structures;
   - detect duplicated `name`/`aliases` if final contract standardizes `model`/`alias`.

Likely files:
- `data/schema/models.schema.json`
- `web/src/lib/data-quality.test.ts` or new `scripts/model-store-schema.test.mjs`
- `scripts/audit_data_source_rules.py` or new `scripts/audit_model_store_shape.py`
- `docs/model-store-schema.md`

### Phase 2 — Build a deterministic normalized item writer

Create shared library instead of each importer writing arbitrary fields:

- `scripts/lib/model-store-item.mjs`
  - `createModelItem(baseFacts)`
  - `mergeModelFacts(existing, patch, sourcePriority)`
  - `addAliasId(item, id)`
  - `addAlias(item, name)`
  - `addOffer(item, offer)`
  - `normalizePriceItem(rawPrice)`
  - `sortOffersAndPrices(item)`
  - `validateNoForbiddenKeys(item)`

This library is the only allowed path to write final model items.

### Phase 3 — Convert importers source-by-source

Do not rewrite all at once if unclear. Convert one source at a time with fixtures.

#### 3.1 OpenRouter

- Input: OpenRouter models/endpoints raw snapshots.
- Output:
  - model identity and OpenRouter alias ids;
  - USD offer under `offers[]`;
  - price item with `input/output`.
- Preserve canonical identity priority already documented.

Potential questions for user:
- Should OpenRouter `provider` endpoint rows become separate offers, or only source-level OpenRouter offer?
- Should OpenRouter endpoint-specific provider availability remain in provider files, or be summarized in model `offers[]`?

#### 3.2 Bailian

- Input: `.internal/sources/bailian-model-market.json` direct HTTP snapshots.
- Output:
  - CNY offer with `source: "bailian"` or `"bailian_model_market"` — needs user decision.
  - endpoint: likely `openai/chat.completions` for compatible chat endpoint.
  - `other_params`: RPM/TPM.
  - price tiers under `offers[].prices[]`.
  - token/cache/tool pricing mapped to direct price dimensions.

Potential questions for user:
- Source id naming: use short `bailian` as in sample, or current explicit `bailian_model_market`?
- Tool prices (`web_search`, `code_interpreter`, `web_extractor`) should be separate price dimensions in same offer, or separate offers?
- For free tool prices (`amount: 0`), keep or omit?

#### 3.3 Volcengine Ark

- Input: SSR/docs snapshots.
- Output:
  - CNY offer under `offers[]`.
  - input-length tiers as `conditions[]`.
  - endpoint/docs URL.

Potential questions for user:
- Whether Volcengine source key should be `volcengine`, `volcengine_ark`, or current source name.
- How to express regional endpoints/regions if present.

#### 3.4 LiteLLM

- Input: LiteLLM raw model/pricing file.
- Output:
  - only high-confidence specs/price enrichment.
  - avoid canonical identity overrides unless no OpenRouter/CNY official identity exists.

Potential questions:
- Should LiteLLM be visible as an `offer` source if it is an aggregator/config source rather than official endpoint?
- Which LiteLLM-only providers should appear in final model store?

#### 3.5 models.dev

- Keep icon/logo enrichment only.
- Do not create model rows, offers, or prices.
- Decide where icon/logo lives in final model item or provider metadata.

### Phase 4 — Generate final `data/models.json` from normalized output

Add a single orchestrator:

- `scripts/build-model-store.mjs`
  - reads existing canonical store if needed for stable IDs;
  - reads normalized source patches;
  - applies source identity priority;
  - emits `data/models.json` in target contract;
  - stable sort and stable formatting.

Optional daily command:

```bash
npm run data:update
```

Suggested internal pipeline:

1. `npm run data:fetch` — refresh raw snapshots.
2. `npm run data:normalize` — build normalized patches.
3. `npm run data:build-store` — write final `data/models.json`.
4. `npm run data:quality` / audit / tests.

### Phase 5 — Update frontend to consume new structure

Frontend currently reads current mixed structures such as model-level `prices` and provider files. After schema change:

- Detail page should read `model.offers[]`.
- Price cards should render `offers[].prices[]`.
- Metadata code block should show clean model item without nested `mddb_registry`.
- Plaza price summary should select best display tier from offers using deterministic rules.

Likely files:
- `web/src/lib/openrouter-raw-renderer.ts`
- `web/src/lib/registry-graph.ts`
- `web/src/lib/data-quality.test.ts`
- relevant renderer tests.

### Phase 6 — Migration and cleanup

1. Run new builder on current source snapshots.
2. Inspect diff for representative models:
   - `qwen3.7-max`
   - `qwen3-max`
   - one OpenRouter-only model
   - one Bailian-only model
   - one Volcengine-priced model
   - one LiteLLM-only non-chat model
3. Remove or quarantine old generated fields:
   - `mddb_registry`
   - duplicate `name` if `model` is canonical display field
   - duplicate `aliases` if `alias`/`alias_id` are canonical
   - top-level `prices` if replaced by `offers[].prices`
4. Keep compatibility only if necessary and document deprecation.

## Tests / validation

Minimum verification before commit:

```bash
npm test
npm run data:quality
python3 scripts/audit_data_source_rules.py
python3 scripts/audit_model_store_shape.py
npm run typecheck
npm run build
git diff --check
```

Additional targeted checks:

```bash
node scripts/build-model-store.mjs --check
node scripts/inspect-model-item.mjs qwen3.7-max
node scripts/inspect-model-item.mjs qwen3-max
```

Expected assertions:

- `qwen3.7-max` conforms to target `model_item` shape.
- No model item contains `mddb_registry`.
- No model item contains top-level `prices` if `offers[].prices` is approved.
- Each offer has `source`, `url`, `observed_at`, `currency` where applicable.
- Each price tier uses direct dimensions (`input`, `output`, `cache_write`, etc.) and optional `conditions[]`.
- Source identity priority remains OpenRouter > CNY official > LiteLLM.
- models.dev remains icon/logo only.

## Risks / tradeoffs

- This is a schema migration, not a small importer patch. Frontend and tests will need updates together.
- Existing provider files may duplicate information that moves into `offers[]`; need decide whether provider files remain deployment/provider catalog or become derived artifacts.
- Some sources have endpoint/provider semantics that may not fit the sample exactly; stop and ask rather than inventing fields.
- If `author` and `author_id` are both kept, document why; otherwise remove one to reduce duplication.
- Timestamp format is currently mixed: schema uses ISO strings, sample uses Unix seconds for release/knowledge cutoff. Need user decision.

## Open questions for user

1. Source naming: should final `offers[].source` use short names (`openrouter`, `bailian`, `volcengine`, `litellm`) or current explicit names (`bailian_model_market`, `volcengine_ark_docs`, etc.)?
2. Timestamp format: should `release_timestamp` / `knowledge_cutoff` stay Unix seconds as sample, or use ISO/date strings as existing schema does?
3. Should final model item keep both `author` and `author_id`? Same for `alias` vs `alias_id` is clear, but `author`/`author_id` may be redundant.
4. Should provider endpoint availability live only in `offers[]`, or should `data/providers/*.json` remain a separate public artifact?
5. Tool prices: should `web_search`, `code_interpreter`, `web_extractor` appear as price dimensions in the same offer, separate price tiers, or separate offer-like add-ons?
6. Should free/zero-priced tools be kept as explicit `amount: 0`, or omitted?
7. Should LiteLLM create visible offers, or only enrich specs/prices when source is not official?

## Implementation stopping rule

During implementation, if any field cannot be mapped with high confidence, stop and ask the user with a concrete example:

- raw source snippet;
- proposed target field;
- alternative mappings;
- impact on frontend/API.

Do not silently create new top-level keys or source-specific nested structures.
