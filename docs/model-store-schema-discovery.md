# Model store schema discovery

本文定义 mddb.dev model store 重构的工作边界。它不是最终 schema，而是把 schema 发现、用户确认、脚本实现和验证流程固定下来，防止 importer 在每次数据更新时自由发挥。

## 背景

`data/models.json` 是 mddb.dev 交付给用户的核心 model store。Fetch 下来的 OpenRouter、Bailian、Volcengine、LiteLLM、models.dev 等原始数据只是内部材料，不应该把 source-specific 结构直接泄漏到最终 JSON。

用户提供的 `model_item.json` 是方向性参考样例，不是唯一标准答案：

- 样例没有覆盖所有 price keys；
- 样例没有覆盖所有模型规格字段；
- 样例中的 offer / endpoint 结构可能不完整；
- 最终结构要基于 raw source 字段语义、mddb 交付需求和用户确认来固化。

## 管线边界

### 1. Fetch / source snapshot

职责：从各数据源拉取原始或半原始数据，并保存内部快照。

允许：

- 保持 source 原始字段名和嵌套结构；
- 保存 `observed_at`、source URL、fingerprint、增量状态；
- 为解析方便保存半结构化 markdown/SSR JSON。

不允许：

- 直接把 source-specific 结构当成最终 `models.json` 结构；
- 在 fetch 阶段决定 canonical model store schema；
- 把临时解析字段泄漏到公开交付物。

### 2. Normalize / import

职责：读取 source snapshot，用确定性代码把有用字段映射到统一 model store patch。

要求：

- mapping 逻辑必须有测试；
- 不确定字段必须停下来问用户；
- 不允许新增自由 top-level key；
- 不允许把同一个模型 identity 再包一层，例如 `mddb_registry`。

LLM 可以用于开发阶段理解 raw source 字段语义，但不能作为运行时随机解释器。最终 importer 必须是确定性代码。

### 3. Build / validate

职责：合并 normalized patches，生成最终 `data/models.json`，并用 schema/audit/tests 验证。

要求：

- 输出结构稳定；
- 排序稳定；
- source identity 优先级稳定；
- frontend/API 只消费最终结构，而不是 raw source quirks。

## Model item 方向性结构

下列字段是当前 discovery 的起点，后续可根据 raw source 增补或调整。

### 顶层 model facts

候选字段：

- `id`: mddb canonical model id，用于 URL/API，通常不含 author namespace。
- `model`: 官方/展示名称。
- `alias_id`: source/vendor/API ids，例如 OpenRouter namespaced id、snapshot id、Bailian/Volcengine source id。
- `alias`: 人类可读别名、marketing name。
- `author`: normalized model author / brand。
- `author_id`: normalized author id；是否与 `author` 合并待确认。
- `input_modalities`, `output_modalities`: 模态。
- `reasoning`, `tool_calling`: 能力标记。
- `context_length`, `max_input_tokens`, `max_output_tokens`: token limits。
- `release_timestamp`, `knowledge_cutoff`, `last_updated`: 时间字段；Unix seconds vs ISO/date string 待确认。

### Offers

`offers[]` 候选承载 source/provider-specific facts：

- `source`: 来源标识，例如 `openrouter`、`bailian`、`volcengine`、`litellm`。命名规则待确认。
- `url`: source/detail/docs URL。
- `observed_at`: 观测时间。
- `currency`: offer 默认币种；如果单个 offer 里出现混合币种，应拆分或在 price item 层声明，需确认。
- `prices[]`: 价格档。
- `endpoints`: endpoint 类型或路径，例如 `openai/chat.completions`。结构待从 raw source 归纳。
- `other_params`: source/provider 层参数，例如 RPM/TPM、region、billing notes。字段边界待确认。

### Price item

`offers[].prices[]` 中每个 item 候选表示一个价格档/条件组。

常见字段：

- `conditions[]`: 适用条件数组，例如输入长度范围、批处理、优先级、区域、工具类型。
- `input`, `output`: token price。
- `cache_write`, `cache_read`: cache price。
- `web_search`, `code_interpreter`, `web_extractor`: tool/add-on price；具体是否直接作为 price dimensions 待确认。
- 其他 price dimensions 必须先从 raw source 语义确认，再加入 schema。

Money amount 形态候选：

```json
{ "amount": 9, "unit": "per_1m_tokens" }
```

## 明确禁止的结构漂移

以下结构不应进入最终 model store：

- `mddb_registry`: 把当前模型自身再嵌套复制一层。
- 未确认的 source-specific top-level key。
- 同一语义的重复字段，例如无明确迁移策略时同时保留 `name`/`model`、`aliases`/`alias`。
- 同时存在 model-level `prices` 与 `offers[].prices`，除非迁移期明确允许并有测试。
- provider/router/product/free/latest 等非 canonical identity 污染 model `id`。
- models.dev 创建 model rows、offers 或 prices。models.dev 只用于 icon/logo enrichment。

## 字段发现流程

处理每个 source 时按以下顺序：

1. 读取 raw snapshot 和官方文档/页面线索。
2. 列出 source 可提供的事实类型：identity、spec、capability、pricing、endpoint、limit、provenance。
3. 判断每个字段是否能映射到现有候选结构。
4. 如果不能映射：
   - 给出 raw snippet；
   - 给出 2-3 个候选目标字段；
   - 说明对 frontend/API 的影响；
   - 问用户确认。
5. 用户确认后，先补文档/schema/test，再改 importer。

## 当前未决问题

1. `offers[].source` 使用短名还是显式来源名：`bailian` vs `bailian_model_market`。
2. 时间格式：`release_timestamp`/`knowledge_cutoff` 用 Unix seconds，还是沿用 ISO/date string。
3. 是否保留 `author` + `author_id` 双字段。
4. provider files 是否继续作为公开 artifact，还是作为 model store 的派生/内部视图。
5. tool/add-on pricing 是否作为同一 offer 下的 price dimensions，还是拆成单独 add-ons。
6. `amount: 0` 的免费工具价格是否显式保留。
7. LiteLLM 是可见 offer source，还是只作为非官方 enrichment。

## 验证方向

后续应添加 schema/audit/tests，至少覆盖：

- 用户给的参考样例可以作为有效 fixture 的起点，但不是完整 schema。
- 含 `mddb_registry` 的 model item 必须失败。
- 未确认 top-level keys 必须失败或进入 audit warning。
- `conditions` 应为数组。
- `qwen3.7-max` 等代表模型能从 raw source 生成稳定、可读、无重复包裹的 model item。
