# OpenRouter-first Provider Graph 重构方案

Date: 2026-05-16
Status: draft / implementation guide

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 把 mddb.dev 从“canonical model tag 为中心的模型目录”重构为“面向 new-api / AI 中转服务模型管理的 OpenRouter-first provider graph”，最终输出可被 new-api 站点用于配置模型规格与价格的数据/API。

**Architecture:** 保留现有静态站、JSON projection、TypeScript importer/renderer 的整体风格，但重建核心 schema。主实体从全局 canonical model 改为 provider-scoped model node：`/models/<provider-name>/<model-id>`。author/厂牌与 provider 分离；相同规格/价格、alias、variant、snapshot、route wrapper 等关系用有向图边表达，而不是强行改写 provider 自己的模型 ID。

**Tech Stack:** TypeScript, JSON snapshots, static HTML generation, OpenRouter `/api/v1/models`, OpenRouter sitemap/model pages, OpenRouter `/endpoints` detail API.

---

## 1. 背景与产品初心

mddb.dev 的初心不是只做一个公开模型展示页，而是补足 new-api 这类 AI 中转服务中缺失的“模型管理模块”。目标用户包括：

- 自建 new-api / One API / 中转站的站长；
- 需要维护模型规格、价格、上下文、模态、provider route 的管理员；
- 需要把 OpenRouter 等上游目录转换成自己的模型配置的人；
- 想用 wiki/百科方式查模型规格与价格的普通用户。

最终成果应提供：

- 人可读 wiki 页面；
- 机器可读 JSON/API；
- 面向 new-api 的价格/模型配置 projection；
- 管理员可修正/覆盖/审核数据的持久层。

当前阶段暂时放下 models.dev 与 BaseLLM，只适配 OpenRouter。

---

## 2. 非目标

本阶段不做：

- 不继续扩展 BaseLLM/NewAPI importer；
- 不继续扩展 models.dev overlay；
- 不强行把 OpenRouter 的 author namespace 当作我们自己的 provider；
- 不把所有模型归并到一个无 provider 的 canonical tag；
- 不把 `:free` / promotional route 作为官方商业价格；
- 不把 agent/app 页面与底层模型混为一类。

---

## 3. 核心概念

### 3.1 Author / Brand

`author` 是模型研发方或厂牌，例如：

- Anthropic
- OpenAI
- Google
- Alibaba / Qwen
- Black Forest Labs
- MiniMax

OpenRouter 的 URL 第一段经常是 author，例如 `anthropic/claude-sonnet-4`。但在 mddb.dev 新 schema 中，这一段不自动等于 provider。

### 3.2 Provider

`provider` 是真正提供服务/部署模型的一方，可以是：

- 原厂 API，例如 Anthropic、OpenAI；
- 云厂商，例如 Amazon Bedrock、Google Vertex、Azure；
- 中转站/网关，例如 OpenRouter、自建 new-api、其他 gateway；
- 特定渠道或 marketplace provider。

Provider 有自己的属性：

```ts
type Provider = {
  providerId: string
  slug: string
  displayName: string
  kind: 'author_api' | 'cloud' | 'gateway' | 'marketplace' | 'local' | 'unknown'
  currency: string
  homepageUrl: string | null
  apiBaseUrl: string | null
  source: SourceName | 'manual'
  metadata: Record<string, unknown>
}
```

关键规则：provider 下属模型的默认标价货币由 `provider.currency` 表示。单个价格项仍可覆盖 currency，以处理少数例外。

### 3.3 Provider Model Node

主模型节点改为 provider-scoped：

```text
/models/<provider-name>/<model-id>
```

其中：

- `provider-name` 是我们规范化后的 provider slug；
- `model-id` 是这个 provider API 中真实使用的模型关键字，尽量保留上游命名习惯，只做 URL-safe 编码/slug 映射；
- 页面展示时保留 raw model id。

示例：

```text
/models/anthropic/claude-sonnet-4
/models/openrouter/anthropic%2Fclaude-sonnet-4
/models/amazon-bedrock/anthropic.claude-sonnet-4-20250522-v1:0
/models/google-vertex/anthropic%2Fclaude-4-sonnet-20250522
```

实际 URL 是否使用 `%2F`、双路径段或 slug+rawId 映射，需要在实现任务中定稿。原则是：**不破坏 provider 的真实 API model-id。**

### 3.4 Spec / Price Reference Graph

如果 provider B 的某个模型在规格与价格上完全等同于 provider A 的某个模型，不复制一整份事实，而是建立有向边：

```ts
type ModelRelation = {
  fromNodeId: string
  toNodeId: string
  relationType:
    | 'same_as'
    | 'alias_of'
    | 'variant_of'
    | 'snapshot_of'
    | 'price_same_as'
    | 'spec_same_as'
    | 'derived_from'
    | 'routes_to'
  confidence: number
  evidence: SourceEvidence[]
  notes: string | null
}
```

被指向节点需要能展示反向引用：

```text
Also available as:
- provider: amazon-bedrock, model-id: anthropic.claude-sonnet-4-20250522-v1:0
- provider: google-vertex, model-id: anthropic/claude-4-sonnet-20250522
```

### 3.5 OpenRouter 的双重身份

OpenRouter 在本项目中有两层含义：

1. **数据源**：`source = openrouter`，提供 `/api/v1/models`、sitemap、model page、endpoint detail；
2. **服务 provider / gateway**：`provider = openrouter`，其 API model id 是 `anthropic/claude-sonnet-4` 这样的 route。

OpenRouter `/api/v1/models` 里的 `id` 应首先产生一个 OpenRouter provider model node：

```text
provider = openrouter
modelId = anthropic/claude-sonnet-4
```

它的 `author` 可从 namespace/display name/canonical slug 推断为 Anthropic。

OpenRouter `/endpoints` 里的 endpoint rows 再产生 deployment/provider observations，例如 Anthropic、Google Vertex、Amazon Bedrock 等 provider 的服务节点或 relation。

---

## 4. 目标数据模型草案

### 4.1 Registry envelope

```ts
type RegistryDataset = {
  schemaVersion: '0.2.0-provider-graph'
  generatedAt: string
  sources: SourceRun[]
  providers: Provider[]
  authors: Author[]
  modelNodes: ProviderModelNode[]
  relations: ModelRelation[]
  priceFacts: PriceFact[]
  sourceRecords: SourceRecord[]
  adminOverrides: AdminOverride[]
}
```

### 4.2 ProviderModelNode

```ts
type ProviderModelNode = {
  nodeId: string
  route: string
  providerId: string
  providerModelId: string
  providerModelIdEncoded: string
  displayName: string
  authorId: string | null
  authorDisplayName: string | null
  modelFamily: string | null
  lifecycleStatus: 'active' | 'preview' | 'deprecated' | 'sunset' | 'unknown'
  modality: {
    input: string[]
    output: string[]
  }
  specs: {
    contextWindowTokens: number | null
    maxOutputTokens: number | null
    tokenizer: string | null
    supportedParameters: string[]
    defaultParameters: Record<string, unknown> | null
    capabilities: Record<string, boolean | string | number | null>
  }
  pricingSummary: {
    currency: string
    inputPer1m: number | null
    outputPer1m: number | null
    cacheReadPer1m: number | null
    cacheWritePer1m: number | null
    requestPrice: number | null
    unitPrice: number | null
  }
  primaryPriceFactIds: string[]
  relationIds: string[]
  reverseRelationIds: string[]
  sourceRecordIds: string[]
  quality: {
    confidence: number
    warnings: string[]
    needsReview: boolean
  }
}
```

### 4.3 PriceFact

```ts
type PriceFact = {
  priceFactId: string
  nodeId: string
  source: SourceName | 'manual'
  sourceRecordId: string
  currency: string
  components: Array<{
    mode: 'token' | 'request' | 'image' | 'audio' | 'video' | 'time' | 'web_search' | 'reasoning' | 'other'
    scope: 'input' | 'output' | 'cache_read' | 'cache_write' | 'request' | 'unit' | 'other'
    amount: number
    unit: '1m_tokens' | 'request' | 'image' | 'second' | 'minute' | 'unit'
    conditions: Array<{
      key: 'context_length' | 'provider_endpoint' | 'region' | 'tier' | 'resolution' | 'duration' | 'quality' | 'other'
      value: string
    }>
    sourceField: string
  }>
  rawPricing: Record<string, unknown>
  effectiveAt: string | null
  observedAt: string
  warnings: string[]
}
```

### 4.4 SourceRecord

```ts
type SourceRecord = {
  sourceRecordId: string
  source: 'openrouter'
  sourceUrl: string
  observedAt: string
  rawId: string
  rawRecord: unknown
  extracted: Record<string, unknown>
  importerVersion: string
}
```

---

## 5. OpenRouter source surfaces

### 5.1 `/api/v1/models`

用途：基础 OpenRouter provider model list。

产物：

- `provider = openrouter`
- `providerModelId = row.id`
- `author` 从 row id namespace、name prefix、canonical slug 推断
- model specs from `context_length`, `architecture`, `top_provider`, `supported_parameters`
- price facts from row `pricing`
- `links.details` 保存为 endpoint detail source URL

### 5.2 `/api/v1/models/<slug>/endpoints`

用途：补充实际部署 provider 的 context、limit、price、supported parameter。

产物：

- provider observations：Anthropic、Google Vertex、Amazon Bedrock 等
- endpoint-level price facts
- `context_length` 条件
- endpoint `tag`、region、status、supported parameters 作为 provenance，不默认变成 canonical identity

### 5.3 sitemap + model pages

用途：发现 `/api/v1/models` 未列出的页面模型，尤其是：

- embedding
- rerank
- image
- video
- audio / TTS / STT
- agent/spawn 页面

产物：

- `pageOnlyCandidate` review artifact
- 非 chat 模型按 modality/type 进入专门 schema
- `spawn/*` 先归类为 agent/app，不进入底层 model node，除非后续设计 agent registry

---

## 6. URL 与持久层设计

目标 URL：

```text
/models/<provider-name>/<model-id>
```

实现建议分两层：

1. 内部稳定 ID：

```text
nodeId = providerId + ':' + base64url(providerModelId)
```

2. 公开路由：

```text
/models/<providerSlug>/<providerModelIdUrlSafe>
```

`providerModelIdUrlSafe` 必须可逆或能通过 lookup 还原 raw ID。候选方案：

- percent encoding：`anthropic%2Fclaude-sonnet-4`
- base64url：`YW50aHJvcGljL2NsYXVkZS1zb25uZXQtNA`
- slug + lookup：`anthropic-claude-sonnet-4`，页面 metadata 存 raw id

建议首选 percent encoding 或 slug+lookup，避免牺牲可读性。实现前需用 static server 验证 `%2F` 在目标部署环境是否被保留；若不可靠，改用 base64url 或 slug+lookup。

持久层初期仍可用 checked-in JSON：

```text
data/
  openrouter-models.json
  openrouter-sitemap-models.json
  openrouter-endpoints/
    <encoded-model-id>.json
  registry/
    provider-graph.json
    providers.json
    authors.json
    model-nodes.json
    relations.json
    price-facts.json
    source-records.json
  admin/
    overrides.example.json
```

管理员修改可先通过 `data/admin/overrides.json` 实现，真实部署时该文件不提交，README 教用户配置管理员口令和本地数据路径。

---

## 7. README 公开说明方向

README 应从“canonical model identity graph”改成“provider model graph for AI gateways”。公开文案需要说明：

- mddb.dev 面向 new-api / AI gateway 的模型规格与价格管理；
- 当前专注 OpenRouter；
- OpenRouter API key 配置：`OPENROUTER_API_KEY`；
- 管理员口令配置：例如 `MDDB_ADMIN_PASSWORD` 或后续实际变量；
- 本地 override 不提交；
- 每次导入都应保留 source provenance；
- provider 与 author 的区别。

---

## 8. 迁移计划

### Phase 0: 文档与边界冻结

- 写入本重构方案；
- README 加短说明，提示 schema 正在迁移；
- 明确 models.dev / BaseLLM 暂停；
- 提交文档修改。

### Phase 1: 新 schema 类型与 fixture

- 新增 `src/lib/provider-graph-schema.ts`；
- 新增 OpenRouter fixture，覆盖：
  - chat model: `anthropic/claude-sonnet-4`
  - endpoint providers: Anthropic / Google Vertex / Amazon Bedrock
  - page-only video: `minimax/hailuo-2.3`
  - embedding/rerank sample
  - spawn sample filtered as agent/app
- 写 schema validation/helper tests。

### Phase 2: OpenRouter provider-node importer

- 让 `/api/v1/models` row 生成 `ProviderModelNode(provider=openrouter)`；
- 不再把 `anthropic` namespace 直接当 canonical parent；
- 保留 raw `row.id`；
- 价格进入 `PriceFact`；
- 生成 source record。

### Phase 3: Endpoint detail importer

- 增加 endpoint detail snapshot/cache；
- endpoint row 生成 provider observations 和 relation；
- 同规格/同价格时建立 `same_as` / `spec_same_as` / `price_same_as`；
- 不把 region/status/uptime 误判为 model identity。

### Phase 4: Sitemap page-only discovery

- 抓 sitemap；
- 分类缺失页面：embedding/rerank/image/video/audio/agent；
- 生成 review artifact；
- 对 image/video/audio 页面抽取价格与参数的 importer 另开任务。

### Phase 5: Projection and routes

- 生成 `/models/<provider>/<model-id>` 页面；
- 旧 `/models/<tag>` 先保留 redirect 或 compatibility page；
- 生成 `/api/provider-graph.json`；
- 生成 new-api-oriented projection。

### Phase 6: Admin overrides

- 定义 override 文件 schema；
- README 加部署配置；
- 后续再做 UI/API 管理入口。

---

## 9. 任务拆分

### Task 1: Commit documentation baseline

**Objective:** 保存本方案并更新 README 的项目方向。

**Files:**
- Create: `.internal/docs/plans/2026-05-16-openrouter-provider-graph-refactor.md`
- Modify: `README.md`

**Verification:**

```bash
git diff -- README.md .internal/docs/plans/2026-05-16-openrouter-provider-graph-refactor.md
git status --short
```

**Commit:**

```bash
git add README.md .internal/docs/plans/2026-05-16-openrouter-provider-graph-refactor.md
git commit -m "docs: plan OpenRouter provider graph refactor"
```

### Task 2: Add provider graph schema tests

**Objective:** 先定义最小 schema 与 URL encoding 行为。

**Files:**
- Create: `src/lib/provider-graph-schema.ts`
- Create: `src/lib/provider-graph-schema.test.ts`

**Tests:**

- provider has currency;
- node route includes provider slug and reversible encoded model id;
- OpenRouter route id `anthropic/claude-sonnet-4` remains raw provider model id;
- author differs from provider.

**Verification:**

```bash
npm test -- src/lib/provider-graph-schema.test.ts
npm run typecheck
```

**Commit:**

```bash
git add src/lib/provider-graph-schema.ts src/lib/provider-graph-schema.test.ts
git commit -m "feat: add provider graph schema primitives"
```

### Task 3: Import OpenRouter API rows as provider nodes

**Objective:** Build provider graph nodes from `data/openrouter-models.json` without old canonical tag collapse.

**Files:**
- Create: `src/lib/openrouter-provider-graph.ts`
- Create/modify tests: `src/lib/openrouter-provider-graph.test.ts`

**Verification:**

```bash
npm test -- src/lib/openrouter-provider-graph.test.ts
npm run typecheck
```

**Commit:**

```bash
git add src/lib/openrouter-provider-graph.ts src/lib/openrouter-provider-graph.test.ts
git commit -m "feat: import OpenRouter rows as provider graph nodes"
```

### Task 4: Add endpoint detail cache and importer

**Objective:** Preserve provider endpoint observations and context-specific pricing.

**Files:**
- Add script under `scripts/` for endpoint fetch/cache;
- Add importer under `src/lib/`;
- Add fixture tests.

**Verification:**

```bash
npm test
npm run typecheck
```

**Commit:**

```bash
git add scripts src/lib data/openrouter-endpoints
git commit -m "feat: import OpenRouter endpoint observations"
```

### Task 5: Add sitemap page-only discovery

**Objective:** Track OpenRouter pages missing from `/api/v1/models` and classify them.

**Files:**
- Add fetch script;
- Add classifier;
- Add generated review artifact.

**Verification:**

```bash
npm test
npm run typecheck
```

**Commit:**

```bash
git add scripts src/lib data/openrouter-sitemap-models.json
git commit -m "feat: discover OpenRouter sitemap-only models"
```

### Task 6: Build provider graph projection for site/API

**Objective:** Render new URL structure and machine API from provider graph.

**Files:**
- Modify `src/scripts/build-site.ts`;
- Modify renderer/projection files;
- Add route tests/snapshot tests.

**Verification:**

```bash
npm test
npm run typecheck
npm run build
```

**Commit:**

```bash
git add src public data/registry
git commit -m "feat: render provider-scoped model pages"
```

Do not push unless explicitly requested.

---

## 10. Open questions

1. Public URL should encode provider model id with percent encoding, base64url, or slug+lookup?
2. Should OpenRouter itself be the provider for `/api/v1/models` rows, with endpoint providers as related provider nodes, or should endpoint providers become primary nodes when available?
3. Admin override storage should remain file-based JSON first, or introduce SQLite early?
4. new-api projection should target native ratio config first, or richer mddb-specific JSON first?
5. Should page-only image/video/audio models be first-class model nodes immediately, or enter a review queue first?

Recommended default answers for implementation:

- Use provider `openrouter` as first imported node source.
- Use slug+lookup if `%2F` static routing is unreliable.
- Keep admin overrides as local JSON initially.
- Build rich provider graph JSON before lossy new-api ratio projection.
- Put page-only models into review artifacts first, then promote by type.
