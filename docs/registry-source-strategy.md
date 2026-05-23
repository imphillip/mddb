# mddb 数据源分层与维护规则

本文记录 mddb.dev registry 的数据源职责、一次性回填与日常维护边界。

## 核心原则

- 模型是核心实体；`models.json` 只保存模型事实，不保存 provider route/endpoint 细节。
- Provider 是服务/展示实体；`data/providers/*.json` 保存 provider 身份、入口、offers、prices 与来源。
- Canonical model identity 不应由所有数据源混合决定；每个源只负责自己擅长且可信的字段。
- 不清空既有数据；新规则用于审查和修正脚本行为，逐步收敛。

## 数据源职责

### OpenRouter：canonical seed 与日常主刷新源

OpenRouter 是从零初始化 registry 的第一层：

- 建第一批 `models`。
- 从 author/endpoint provider 建第一批 `providers`。
- 建 OpenRouter 自身作为中转 provider 的 offers。
- 建 OpenRouter endpoint provider offers。

适合填充：

- `models.json`
  - `id`
  - `model`
  - `alias`
  - `author`
  - `input_modalities`
  - `output_modalities`
  - `reasoning`
  - `tool_calling`
  - `context_length`
  - `max_output_tokens`
  - `release_timestamp`
  - `other_parameters.openrouter/tokenizer/instruct_type/supported_parameters` 等
- `providers/*.json`
  - OpenRouter provider
  - endpoint providers
  - endpoint-level route offers
  - token-based pricing
  - endpoint status/latency/throughput/quantization 等 observation

注意：

- OpenRouter 的报价是 marketplace/route price，不等同于官方 provider 价。
- OpenRouter 对非 chat、多单位计费覆盖有限。

### LiteLLM：非 chat 模型与复杂计费补齐，日常主刷新源

LiteLLM 是第二层，补 OpenRouter 缺失的模型类型和复杂计费形态。

适合填充：

- 非 chat canonical models：
  - embedding
  - rerank
  - audio transcription
  - speech/TTS
  - video generation
  - 后续可审慎考虑 OCR/moderation/vector/search
- 已有模型 enrichment：
  - alias/source
  - `deprecation_date`
  - `context_length` / `max_output_tokens` 只补合理空值或 LiteLLM 管理的模型
  - `other_parameters.litellm`
- 复杂价格 observation：
  - per query
  - per request
  - per image
  - per second/audio second/video second
  - audio/image/video token
  - cache read/write
  - key suffix 条件价格：`above_*`, `batches`, `priority`, `flex` 等

约束：

- 非 chat 模型可以新增 canonical model。
- Chat 模型原则上不新增 canonical model，只 enrich 已有模型；避免 wrapper/provider alias 污染。
- LiteLLM 基本没有可靠 release date，不得用导入时间或更新时间冒充发布日期。
- `:free` route 只作短期 observation，不作为 official commercial price。

### models.dev：provider 外观与官方入口，偶尔刷新

models.dev 主要价值在 provider metadata，而不是主导 model canonical。

适合填充：

- Provider metadata：
  - `icon`（最独特、最稳定，需本地化）
  - `base_url`
  - `domain`/docs
  - `npm`
  - `env`
  - `other_parameters.models_dev.remote_icon`
- Safe provider offers：只挂到可匹配的 existing canonical models。
- Model 字段只补空或放入 `other_parameters.models_dev`：
  - `release_date`
  - `limit.context`
  - `limit.output`
  - `reasoning`
  - `tool_call`
  - `modalities`
  - `family`
  - `open_weights`
  - `knowledge`

约束：

- 不批量用 models.dev 独有模型创建 canonical models，除非人工审核。
- 不覆盖 OpenRouter/LiteLLM 已经稳定确定的 model identity。
- 日常维护只需偶尔检查 icon/provider metadata 是否更新。

### BaseLLM/NewAPI：一次性/偶尔 provider offer pricing backfill

BaseLLM/NewAPI 更像 provider/聚合商报价回填源，不是长期 model source。

适合填充：

- 新 provider/聚合商文件。
- 已有 canonical model 的 provider offers。
- Prices：
  - input/output per 1M
  - cache read/write
  - ratio/raw pricing
- `other_parameters.basellm_newapi`：
  - vendor_name
  - tags
  - status
  - description/endpoints/icon/name_rule 如需保留原始 observation

约束：

- 不用它创建 canonical model。
- 不用 vendor 当 model author。
- 不用 tags 直接写 canonical modality/context/release。
- 长期维护频率低；主要作为一次性数据填充或偶尔补缺。

## 日常维护节奏

周期性刷新：

1. OpenRouter
   - model baseline
   - endpoint/provider routes
   - route pricing/status
2. LiteLLM
   - 非 chat model 增量
   - lifecycle/deprecation
   - complex pricing

偶尔刷新：

1. models.dev
   - provider icon/base_url/domain/doc/npm/env
   - 少量 safe offers
2. BaseLLM/NewAPI
   - provider offer/pricing backfill
   - 国内/聚合商价格补缺

## 推荐初始化/重建顺序

```text
OpenRouter canonical seed
→ LiteLLM non-chat + lifecycle + complex pricing
→ models.dev provider metadata/icons + safe offer metadata
→ BaseLLM/NewAPI provider-offer pricing backfill
```

## 脚本审查清单

每个 import/enrich 脚本都要问：

1. 这个源是否被允许创建 canonical model？
2. 如果允许，限于哪些 mode/type？
3. 是否只补空，不覆盖更高优先级来源？
4. 是否保留 source/provenance？
5. 是否过滤 `:free` 或把 free route 标为非官方短期 observation？
6. 是否把 provider/offer/pricing 放在 provider 文件，而不是塞进 model canonical 字段？
7. 是否把无法归类字段放入 `other_parameters.<source>`？
8. 是否避免用 import time/last_updated 冒充 release date？

## 简短规则

- 模型实体：OpenRouter + LiteLLM。
- 服务商外观和官方入口：models.dev。
- 报价长尾和聚合商 offer：BaseLLM/NewAPI。
- 日常维护：OpenRouter + LiteLLM 为主；models.dev 偶尔；BaseLLM/NewAPI 低频。
