# mddb 新数据 Schema 草案

来源：`Untitled.pdf` 的示意。

核心约束：

- 公开实体保持两类：`model` 与 `provider`。
- `models.json` 只保存模型事实，不保存价格与 endpoint。
- 每个 provider 一个 `<provider>.json`。
- `author` 必然是一个 provider id。
- provider 文件拥有 `offers[]`；offer 可引用 `models.json`，也可先登记候选/变种。
- endpoint 由 `provider.base_url + offer.endpoint_path` 拼装。
- price 支持 0..n 组；每组由 `conditions` 与 `prices` 构成。
- 不能识别/暂不归类的字段进入 `other_parameters`，避免丢源数据。

## 文件结构

```text
registry/
  models.json
  providers/
    openai.json
    anthropic.json
    openrouter.json
schema/
  models.schema.json
  provider.schema.json
```

## `models.json`

`models.json` 是维护者控制的模型事实表。

字段：

- `id`: 模型 id；用于 endpoint 指定、URL slug；不带 author/provider 前缀。
- `model`: 模型正式名称。
- `alias[]`: 别称数组。
- `author`: 研发方；必须是 provider id。
- `input_modalities[]`: 输入模态。
- `output_modalities[]`: 输出模态。
- `reasoning`: 是否支持思维/推理过程。
- `tool_calling`: 是否支持工具调用。
- `context_length`: 上下文大小。
- `max_input_tokens`: 最大输入 token。
- `max_output_tokens`: 最大输出 token。
- `knowledge_cutoff`: 训练数据截止日期。
- `released`: 发布日期。
- `deprecation`: 下架日期。
- `other_parameters`: 未归类字段。
- `last_updated`: 数据更新于。
- `sources[]`: 来源追溯。

示例：

```json
{
  "schema_version": 1,
  "models": [
    {
      "id": "gpt-4o-mini",
      "model": "GPT-4o mini",
      "alias": ["gpt-4o-mini-2024-07-18"],
      "author": "openai",
      "input_modalities": ["text", "image"],
      "output_modalities": ["text"],
      "reasoning": false,
      "tool_calling": true,
      "context_length": 128000,
      "max_output_tokens": 16384,
      "knowledge_cutoff": "2023-10",
      "released": "2024-07-18",
      "other_parameters": {},
      "last_updated": "2026-05-18T00:00:00Z",
      "sources": [
        {
          "source": "openai-docs",
          "source_id": "gpt-4o-mini",
          "url": "https://platform.openai.com/docs/models"
        }
      ]
    }
  ]
}
```

## `<provider>.json`

每个 provider 一个文件，保存 provider 身份、endpoint 域名、默认货币与 offer。

字段：

- `id`: 全小写 provider id，用于 URL slug。
- `provider`: 企业、组织、实验室、平台或中转站名称。
- `icon`: icon/logo URL。
- `domain`: endpoint 所在域名。
- `base_url`: API base URL。
- `currency`: provider 默认 pricing 货币单位。
- `offers[]`: provider 提供的模型/变种/候选。
- `other_parameters`: 未归类 provider 字段。
- `last_updated`: 数据更新于。
- `sources[]`: 来源追溯。

### `offers[]`

字段：

- `model_id`: 可以是 `models.json` 里的 id，也可以是 provider 自填候选 id。
- `model`: 可以是 `models.json` 里的正式名，也可以是 provider 自填名称。
- `variant_of`: 如需声明变种，填 `models.json` 里的 model id。
- `endpoint_path`: 调用路径。
- `api_model_id`: API 请求体里使用的精确模型 id。
- `mode`: chat / embedding / image / audio / video 等。
- `prices[]`: 支持 0..n 组价格。
- `other_parameters`: 未归类 offer 字段。
- `sources[]`: 来源追溯。

### `prices[]`

每组价格：

- `conditions`: 阶梯条件，0..n 个 key/value。
- `prices`: 价格，按需用 key/value 表达；支持按量、按次、按时长、工具调用等。
- `currency`: 可覆盖 provider 默认货币。
- `source`: 来源。
- `observed_at`: 观测时间。
- `raw_pricing`: 无法无损映射的原始价格字段。

示例：

```json
{
  "schema_version": 1,
  "id": "openai",
  "provider": "OpenAI",
  "icon": "https://openai.com/favicon.ico",
  "domain": "api.openai.com",
  "base_url": "https://api.openai.com/v1",
  "currency": "USD",
  "offers": [
    {
      "model_id": "gpt-4o-mini",
      "model": "GPT-4o mini",
      "endpoint_path": "/chat/completions",
      "api_model_id": "gpt-4o-mini",
      "mode": "chat",
      "prices": [
        {
          "conditions": {},
          "prices": {
            "input": { "amount": 0.15, "unit": "per_1m_tokens" },
            "output": { "amount": 0.6, "unit": "per_1m_tokens" }
          },
          "source": "openai-docs"
        },
        {
          "conditions": { "batch": true },
          "prices": {
            "input": { "amount": 0.075, "unit": "per_1m_tokens" },
            "output": { "amount": 0.3, "unit": "per_1m_tokens" }
          },
          "source": "openai-docs"
        }
      ],
      "other_parameters": {}
    }
  ]
}
```

## 阶梯价格表达

LiteLLM 这类字段：

```json
{
  "input_cost_per_token": 0.000003,
  "input_cost_per_token_above_200k_tokens": 0.000006
}
```

映射为：

```json
[
  {
    "conditions": {},
    "prices": {
      "input": { "amount": 3, "unit": "per_1m_tokens" }
    }
  },
  {
    "conditions": { "context_tokens": ">200000" },
    "prices": {
      "input": { "amount": 6, "unit": "per_1m_tokens" }
    }
  }
]
```

图片/视频/工具调用可以这样表达：

```json
{
  "conditions": { "resolution": ">1024x1024", "quality": "premium" },
  "prices": {
    "image_output": { "amount": 0.012, "unit": "per_image" },
    "tool_call": { "amount": 0.001, "unit": "per_tool_call" }
  }
}
```

## 已落地文件

- `schema/models.schema.json`
- `schema/provider.schema.json`
