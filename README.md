# mddb.dev

mddb.dev 是一个开放的大模型数据库（LLM model registry）。它把分散在模型供应商、聚合网关、价格表和社区数据源里的模型信息，整理成以“规范模型身份”为中心的静态网站和数据处理管线。

核心原则：**模型身份优先，Provider 只是观察来源或部署属性。** 同一个底层模型即使出现在不同 API 路由、价格表、快照版本或网关里，也应尽量归并到稳定的 canonical model tag 下；只有上下文、价格、能力或行为确实不同的情况才作为 variant 保留。

当前公开页面：<https://mddb.dev/models/>

## 项目目标

mddb.dev 希望解决几个常见问题：

- 同一个模型在不同平台有不同名字、路由和别名。
- 价格单位不统一：per token、per 1M tokens、NewAPI ratio、单位计费、请求计费等混在一起。
- Provider availability 与 canonical model identity 容易混淆。
- 快照、preview、free、fast、thinking 等后缀有时是版本，有时只是路由或价格变体。
- 模型数据散落在 API、文档、价格页和社区列表里，难以追踪来源。

本仓库当前实现的是 TypeScript 静态站点和导入/归一化逻辑。未来会继续演进为更完整的机器可读 registry。

## 数据源

当前管线围绕三个公开数据源：

### 1. OpenRouter

- 数据入口：`https://openrouter.ai/api/v1/models`
- 本地快照：`data/openrouter-models.json`
- 刷新脚本：`npm run data:openrouter`
- 可选环境变量：
  - `OPENROUTER_MODELS_URL`：覆盖默认 API URL。
  - `OPENROUTER_API_KEY`：可选 Bearer token，用于避免未来鉴权或限流变化。

OpenRouter 是当前 canonical identity 的第一来源。导入器读取：

- `id`：例如 `openai/gpt-4o`、`anthropic/claude-sonnet-4`。
- `canonical_slug`：用于识别快照或 release marker。
- `name`：人类可读名称，常见格式是 `<Brand>: <Model>`。
- `context_length` / `top_provider.context_length`。
- `architecture`、`supported_parameters`、`top_provider` 等能力字段。
- `pricing` 中的 prompt、completion、cache read/write 等价格。

处理策略：

- 从 OpenRouter route 中拆出 provider namespace 和 source model id。
- 用 source model id 推导 mddb canonical tag，而不是直接照搬 provider route。
- `canonical_slug` 更多作为 snapshot/release 证据，而不是唯一 canonical key。
- `latest` 这类浮动别名不进入稳定 canonical 主行，会作为 alias/观察信息保留。
- 负数价格被视为动态或不可直接换算的 sentinel，不进入默认价格输出。
- per-token 价格统一换算成 USD / 1M tokens。
- NewAPI ratio 换算规则：`model_ratio = input_price_per_1m_usd / 2`，因为 NewAPI 中 `500,000 tokens = $1`，所以 ratio `1` 等价于 `$2 / 1M input tokens`。

### 2. models.dev

- 数据入口：`https://models.dev/api.json`
- 本地快照：`data/models-dev-api.json`

models.dev 作为 OpenRouter-first 主库的辅助来源，主要用于：

- provider availability 观察。
- brand logo 和 provider logo。
- OpenRouter 未覆盖模型的 waiting list 候选发现。
- 对 models.dev-only 候选保留完整 metadata/pricing，等待人工确认。

处理策略：

- 如果 models.dev 中的模型能匹配已有 OpenRouter canonical tag，则作为 availability/provider enrichment 叠加，不覆盖 OpenRouter canonical identity。
- 如果没有匹配，则进入 waiting list 候选，而不是直接污染 canonical 主库。
- 明显的 wrapper、gateway、proxy、provider-specific alias 会被预处理器降级或拒绝。
- models.dev 的同名模型可能来自多个 provider；这些 provider 是可用性观察，不等于 canonical identity。

### 3. BaseLLM / NewAPI metadata

- 在线站点：`https://basellm.github.io/llm-metadata/`
- 本地快照：`data/basellm-newapi.json`

BaseLLM / NewAPI 数据用于补充 NewAPI 生态中的价格和可用性记录。

处理策略：

- BaseLLM 记录不会替换 canonical model；它们作为 pricing/availability variants 附着在同一 canonical model 下。
- 同一个 source model id 如果存在不同 provider、上下文窗口、计费方式或价格，都会保留为独立 variant。
- 支持 token pricing、unit/request pricing、上下文窗口差异、provider 差异和无法换算但有来源价值的记录。
- NewAPI ratio 换算为 USD / 1M tokens 时使用：`price_per_1m_usd = model_ratio * 2`。

## 数据处理原理

### Canonical tag

canonical tag 是 mddb.dev 的稳定模型 ID：

- 小写。
- 使用 hyphen 分隔。
- 不包含 provider namespace。
- 不包含 region、gateway、cloud marketplace、router 等部署属性。
- 不把日期快照直接混入主模型，除非它本身就是模型身份的一部分。

例子：

```text
openai/gpt-4o                  → gpt-4o
anthropic/claude-sonnet-4      → claude-sonnet-4
claude-4-5-haiku               → claude-haiku-4-5
```

详细规则见 [`docs/model-identity-normalization.md`](docs/model-identity-normalization.md)。

### Snapshot 与 variant

mddb.dev 区分两类变化：

- **Snapshot**：日期、版本号或 release marker，例如 `2024-08-06`、`v1`。
- **Variant**：同一模型下有意义的行为、上下文、价格或路由差异，例如 `free`、`fast`、`thinking`、不同 context window、不同 provider 价格。

原则：

- 不因为 provider route 不同就创建新 canonical model。
- 不丢弃 snapshot marker，而是作为模型下的版本/别名证据。
- 不用 secondary source 覆盖 primary source，而是保留 provenance 和 variant。

### 价格归一化

内部展示优先使用：

- `inputPrice`: USD / 1M input tokens
- `outputPrice`: USD / 1M output tokens
- `cacheReadPrice`: USD / 1M cached input tokens
- `cacheWritePrice`: USD / 1M cache write tokens

OpenRouter 的价格通常是 USD / token：

```text
price_per_1m_usd = price_per_token * 1_000_000
model_ratio = price_per_1m_usd / 2
completion_ratio = completion_price_per_token / prompt_price_per_token
cache_ratio = cache_read_price_per_token / prompt_price_per_token
```

NewAPI/BaseLLM ratio 的规则：

```text
price_per_1m_input_usd = model_ratio * 2
price_per_1m_output_usd = price_per_1m_input_usd * completion_ratio
cache_read_price = price_per_1m_input_usd * cache_ratio
cache_write_price = price_per_1m_input_usd * create_cache_ratio
```

如果某个来源只提供单位计费、请求计费或无法安全换算的价格，会作为 variant/provenance 保留，而不是强行转换成 token price。

### Waiting List

`/waitinglist/` 是一个静态候选审核辅助页面，用来查看 models.dev-only 或 BaseLLM-only 候选。

公开前已调整：

- 不再嵌入任何管理员账号或密码。
- 不作为后台管理系统。
- 审核标记只保存在当前浏览器 `localStorage`。
- 页面可以导出本机审核标记 JSON，真正入库仍需代码/数据文件变更和 PR 审核。

## Repository layout

```text
data/
  openrouter-models.json   OpenRouter source snapshot
  models-dev-api.json      models.dev source snapshot
  basellm-newapi.json      BaseLLM/NewAPI source snapshot
src/
  lib/                     Importers, normalization, enrichment, renderers, tests
  scripts/                 Static site build script
scripts/
  fetch-openrouter-models.mjs
  deploy-static-site.sh
public/                    Generated site output, ignored by git
```

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Typecheck:

```bash
npm run typecheck
```

Build the static site:

```bash
npm run build
```

Serve the generated site locally:

```bash
npm run serve
```

Refresh OpenRouter data:

```bash
npm run data:openrouter
```

## Deployment

The code workspace and runtime directory are intentionally separate.

`npm run build` writes generated HTML to `public/`. The deploy script then publishes that output to the runtime root configured by `RUNTIME_DIR` when deployment is needed.

```bash
npm run deploy
```

Dry run:

```bash
npm run deploy:dry-run
```

## Contributing

Useful contributions include:

- adding missing aliases with source URLs;
- correcting model identity normalization rules;
- improving importer adapters;
- adding source-specific tests;
- reviewing waiting-list candidates;
- improving pricing conversion and provenance handling.

When proposing a correction, include the model name, provider/source, source URL, and the intended canonical tag.

## License

License is not finalized yet. Do not assume reuse rights until a license file is added.
