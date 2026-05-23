# mddb.dev

mddb.dev 是一个开源的大模型元数据注册表（LLM model registry），主要维护两类 JSON：

- `data/models.json`：模型注册表，记录模型身份、研发方、规格、模态、能力、alias 与来源证据；
- `data/providers/*.json`：供应商注册表，记录 provider 提供的模型 offer、API model id、endpoint、价格、参数与来源证据。

公开站点：<https://models.mddb.dev/>。

后续如果需要直接消费数据，可以优先使用 GitHub Raw 链接读取这些 JSON 文件。

## 当前公开站点

- `/`：模型广场，支持厂牌筛选、搜索、模态筛选、模型 tag 复制和显式币种价格展示；
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
- models.dev
- LiteLLM `model_prices_and_context_window.json`

## 本地环境变量

私密配置不要提交到仓库。仓库只保留 `.env.example` 模板；本地或部署环境使用 `.env.local`：

```bash
cp .env.example .env.local
```

常用变量：

- `OPENROUTER_API_KEY`：OpenRouter 数据抓取 / 更新脚本使用；没有时相关脚本可能无法拉取最新数据。
- `UPDATE_ADMIN_PASSWORD`：内部 `/update/` 数据同步管理台密码；部署环境请使用长随机值。

`.env.local` 已在 `.gitignore` 中忽略，填入真实 key 或密码后不要提交。

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
