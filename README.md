# mddb.dev

mddb.dev 是一个开源的大模型元数据注册表（LLM model registry），主要维护两类 JSON：

- `data/models.json`：模型注册表，记录模型身份、研发方、规格、模态、能力、alias 与来源证据；
- `data/providers/*.json`：供应商注册表，记录 provider 提供的模型 offer、API model id、endpoint、价格、参数与来源证据。

公开站点：<https://models.mddb.dev/>。

后续如果需要直接消费数据，可以优先使用 GitHub Raw 链接读取这些 JSON 文件。

## 当前公开站点

- `/`：模型广场，支持厂牌筛选、搜索、模态筛选、模型 tag 复制和 USD/CNY 价格切换；
- `/providers/`：供应商广场，一供应商一卡片，展示“自研 / 提供”模型数量；
- `/<provider>/`：供应商详情页，展示该 provider 提供的模型；
- `/<provider>/<model-id>/`：模型详情页，展示规格、价格、来源、关系和原始证据。

## 数据文件

### `data/models.json`

模型事实表。典型字段包括：

- `id`：mddb 内部 canonical model id；
- `model`：展示名；
- `alias`：上游或生态里的等价 / 近似 model id；
- `author`：研发方 / 自研模型归属；
- `input_modalities` / `output_modalities`：输入输出模态；
- `context_length` / `max_output_tokens`：关键规格；
- `reasoning` / `tool_calling` / `other_parameters`：能力与补充参数；
- `sources`：来源证据。

### `data/providers/*.json`

每个 provider 一个 JSON 文件。典型字段包括：

- `id` / `provider`：供应商 id 与展示名；
- `currency`：默认币种；
- `offers[]`：该供应商提供的模型；
  - `model_id`：指向 `data/models.json` 中的 canonical model id；
  - `model`：展示名；
  - `api_model_id`：该 provider/API 实际使用的 model tag；
  - `endpoint_path` / `mode`：接口与调用形态；
  - `prices[]`：价格事实；
  - `sources[]` / `other_parameters`：来源证据与补充参数。

JSON Schema 说明见 [`docs/mddb-schema-v1.md`](docs/mddb-schema-v1.md)，schema 文件位于 `data/schema/`。

## 数据源

当前参考的数据源包括：

- OpenRouter
- BaseLLM / NewAPI metadata
- models.dev
- LiteLLM `model_prices_and_context_window.json`

## 仓库结构

```text
data/
  models.json                    模型注册表
  providers/*.json               供应商 / offer 注册表
  schema/*.schema.json           JSON Schema
docs/
  mddb-schema-v1.md              数据格式说明
scripts/                         数据抓取、导入与构建脚本
web/src/                         静态站点源码
```

## License

mddb.dev 使用 GNU Affero General Public License v3.0 or later 授权。详见 [`LICENSE`](LICENSE)。
