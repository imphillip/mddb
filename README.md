# mddb.dev

mddb.dev 是一个开源的大模型元数据注册表（LLM model registry）。项目的核心不是前端站点，而是一组可审计、可维护、可由机器消费的 JSON 文件：

- `registry/models.json`：模型注册表，记录自研模型 / canonical model identity、基础规格、模态、能力、alias 与来源证据；
- `registry/providers/*.json`：供应商注册表，记录每个 provider 提供的模型 offer、API model id、endpoint、价格、参数与来源证据。

公开站点只是这组 registry JSON 的 viewer：<https://models.mddb.dev/>。它负责把 JSON 内容渲染成便于浏览、搜索和复制 model tag 的静态页面；导入脚本、质量检查和后续工具也都围绕这组 JSON 文件工作。

## 当前公开站点

- `/`：模型广场，从 `registry/models.json` 和 `registry/providers/*.json` 生成，支持厂牌筛选、搜索、模态筛选、模型 tag 复制和 USD/CNY 价格切换；
- `/providers/`：供应商广场，一供应商一卡片，展示“自研 / 提供”模型数量；
- `/<provider>/`：供应商详情页，按模型广场同款布局展示该 provider 提供的模型；
- `/<provider>/<model-id>/`：模型详情页，展示规格、价格、来源、关系和原始证据。

## 开源核心

### `registry/models.json`

`models.json` 是最严格维护的核心文件。它描述“模型是什么”以及“模型是谁研发的”。典型字段包括：

- `id`：mddb 内部 canonical model id；
- `model`：展示名；
- `alias`：上游或生态里的等价 / 近似 model id；
- `author`：研发方 / 自研模型归属；
- `input_modalities` / `output_modalities`：输入输出模态；
- `context_length` / `max_output_tokens`：关键规格；
- `reasoning` / `tool_calling` / `other_parameters`：能力与补充参数；
- `sources`：来源证据，必须尽量保留 source id、URL、observed time。

维护原则：

- **identity 优先**：不要把 typo、wrapper、临时 route、free route 直接晋升为 canonical model；
- **author 与 provider 分离**：author 是研发方，provider 是实际提供服务的一方；
- **证据优先**：新增或改动模型 identity、alias、规格、能力时，应保留来源 URL 或 raw upstream id；
- **稳定输出**：排序、命名和 normalization 应保持 deterministic，方便 review diff。

### `registry/providers/*.json`

每个 provider 一个 JSON 文件。它描述“谁提供了哪些模型，以及如何计费 / 调用”。典型字段包括：

- `id` / `provider`：供应商 id 与展示名；
- `currency`：默认币种；
- `offers[]`：该供应商提供的模型；
  - `model_id`：指向 `registry/models.json` 中的 canonical model id；
  - `model`：展示名；
  - `api_model_id`：该 provider/API 实际使用的 model tag；
  - `endpoint_path` / `mode`：接口与调用形态；
  - `prices[]`：价格事实，含条件、单位、币种、来源与 raw pricing；
  - `sources[]` / `other_parameters`：来源证据与补充参数。

维护强度分层：

- 对有自研模型能力的 provider（通常同时在 `models.json` 中作为 author 出现），维护要求更严格：identity、alias、规格、价格、来源都应尽量准确；
- 对只做部署 / 中转 / 聚合、没有自研模型能力的 provider，管理可以更宽松：重点保证 offer 能正确指向 canonical model、价格与来源不污染 canonical identity；
- free-tier、`:free`、促销 route 等只作为短期 source observation，不应当作官方商业价格事实。

## 网站与工具的角色

mddb.dev 的前端静态站点是 registry viewer，不是数据源本身：

- build 阶段读取 `registry/models.json` 和 `registry/providers/*.json`；
- adapter 会把 registry JSON 转成页面渲染使用的 provider graph；
- 页面展示模型、供应商、价格、来源证据和可复制 model tag；
- 生成的 `public/` 是构建产物，不提交 git。

脚本和工具围绕 registry JSON 工作：

- 从 OpenRouter、BaseLLM/NewAPI、models.dev、AIHOT 等外部来源抓取或补充数据；
- 把有价值的数据导入 / 投影到 `models.json` 与 `providers/*.json`；
- 运行数据质量 gate，检查 pricing、provider observation、release date、context window 等覆盖率；
- 后续 API、CLI、分析工具和自部署能力也应优先消费 registry JSON，而不是绕过它另建一套 canonical 数据。

## 数据源

### OpenRouter

- 入口：`https://openrouter.ai/api/v1/models`
- endpoint detail：`/api/v1/models/<model-or-canonical-slug>/endpoints`
- 刷新命令：`npm run data:openrouter`
- 导入 registry：`npm run registry:populate:openrouter`
- 可选环境变量：`OPENROUTER_API_KEY`

OpenRouter 是当前 canonical import 的基础来源。它提供 API route id、显示名、上下文窗口、architecture、supported parameters 和 token pricing；endpoint detail 用于补充真实部署 provider、价格和参数。

### BaseLLM / NewAPI metadata

- 站点：`https://basellm.github.io/llm-metadata/`
- 刷新命令：`npm run data:basellm`

BaseLLM / NewAPI metadata 是价格 / 可用性补充来源：

- 只自动挂接 exact source-id 或 model-id-only match；
- 过滤 `:free` route；
- 不覆盖 OpenRouter endpoint price；
- 保留 provider-specific billing mode。

NewAPI ratio 换算规则：

```text
500,000 tokens = $1
ratio 1 = $2 / 1M tokens
price_per_1m_usd = ratio * 2
```

### models.dev

- 入口：`https://models.dev/api.json`
- 刷新命令：`npm run data:models-dev`

models.dev 当前主要作为 provider / brand logo enrichment 来源。它不直接覆盖 OpenRouter-first identity。

### AIHOT

- 入口：`https://aihot.virxact.com/api/public/items?mode=all&take=100`
- 刷新命令：`npm run data:news`

AIHOT 用于模型动态 / 新闻类 enrichment，不作为 canonical model identity 来源。

## 仓库结构

```text
registry/
  models.json                    核心模型注册表
  providers/*.json               核心供应商 / offer 注册表
src/
  lib/registry-graph.ts          registry JSON -> provider graph adapter
  lib/openrouter-raw-renderer.ts 静态站点 renderer
  lib/data-quality.ts            数据质量报告与 refresh gate
  lib/*                          importer、normalization、enrichment 与测试
  scripts/build-site.ts          静态站点 build 入口
scripts/
  fetch-openrouter-models.mjs
  populate-registry-openrouter.mjs
  fetch-models-dev-api.mjs
  fetch-basellm-newapi.mjs
  fetch-aihot-model-news.mjs
  check-refresh-gate.mjs
public/                           生成的站点输出，git ignored
.internal/                        本地/私有运行数据与维护笔记，git ignored
```

`docs/` 不作为公开仓库表面的一部分。维护者规划、研究笔记和私有运行细节应放在 `.internal/`，该目录被 git ignore。

## 数据质量与 refresh gate

构建时会输出面向审计的数据质量 artifact：

```text
public/graph/openrouter.json
public/graph/data-quality.json
public/graph/missing-pricing.json
public/graph/missing-release-date.json
public/graph/missing-context-window.json
public/graph/missing-provider-observation.json
public/graph/page-only-candidates.json
```

刷新上游后可以运行：

```bash
npm run data:quality
# 或在已 build 后只检查 gate
npm run data:gate -- public/graph/data-quality.json .internal/last-data-quality.json .internal/refresh-gate-report.json
```

如果 source model 数量、pricing coverage 或 pricing/provider observations 大幅下降，gate 返回非零并写 `.internal/refresh-gate-report.json`。这类异常应该暂停 deploy，只发报告；确认是合理上游变化后，再更新 `.internal/last-data-quality.json` 作为下一次比较基线。

## 开发

安装依赖：

```bash
npm install
```

运行测试：

```bash
npm test
```

类型检查：

```bash
npm run typecheck
```

构建静态站点：

```bash
npm run build
```

本地预览生成站点：

```bash
npm run serve
```

刷新 OpenRouter 数据并导入 registry：

```bash
npm run data:openrouter
npm run registry:populate:openrouter
```

## 公开贡献流程

mddb.dev 欢迎公开贡献，尤其欢迎提升 canonical identity、source provenance 和 pricing accuracy 的修正。

### 有价值的贡献类型

- 修正 `registry/models.json` 中的 canonical model identity、alias、author、规格或能力；
- 修正 `registry/providers/*.json` 中的 offer、api model id、endpoint、价格或来源；
- 添加或修正带 source URL 的 alias / price fact / provider observation；
- 改进 source adapter，同时保留 raw provenance；
- 添加 importer、normalization、pricing conversion 或 renderer 测试；
- 改进由 registry 数据生成的网站展示。

### 数据变更必须提供的证据

任何 model / provider data correction 都应包含：

- raw upstream model string、route 或 provider offer；
- provider / source 名称；
- source URL；
- proposed canonical model id 或 provider id；
- classification：canonical model、alias、snapshot、variant、deployment、price fact 或 rejected/wrapper；
- 为什么这个分类是正确的；
- 如果规则可复用，应添加或更新测试 / fixture。

### Pull Request checklist

提交 PR 前请运行：

```bash
npm test
npm run typecheck
npm run build
```

PR 应满足：

- 不把生成的 `public/`、`dist/` 提交进 git；
- 不提交 secret、local token、private notes 或 `.internal/` 文件；
- registry JSON 改动优先保持小而可审计；
- normalization 时保留 raw source evidence，而不是只留下清洗后的字符串；
- 不用 secondary source 覆盖 OpenRouter-first canonical identity；
- 为 normalization、importer、pricing、registry adapter 或 rendering 行为添加 / 更新测试；
- 保持改动聚焦、可 review。

### Review policy

维护者应从以下角度 review registry 变更：

- identity correctness；
- provenance quality；
- source priority 和 conflict handling；
- alias、typo、wrapper、gateway pollution 风险；
- deterministic output 和 stable ordering；
- 与未来机器可读导出的兼容性。

候选项不应仅因为出现在一个上游列表里就晋升为 canonical registry。如果身份存在歧义，应留在 waiting list，直到证据足够。

## 部署

代码 workspace 和 runtime directory 有意分离。

`npm run build` 会把生成的 HTML 写入 `public/`。需要部署时，deploy script 会把生成结果发布到 `RUNTIME_DIR` 配置的 runtime root。

默认公开 deliverable 目标是 `https://models.mddb.dev/`，runtime root 是 `/srv/models.mddb.dev/www`。现有 `https://mddb.dev/` 暂时不作为开源 deliverable 的默认部署目标；如需部署到其它环境，可显式覆盖 `RUNTIME_DIR`。

```bash
npm run deploy
```

Dry run：

```bash
npm run deploy:dry-run
```

保留旧站点时可手动指定：

```bash
RUNTIME_DIR=/srv/mddb.dev/www npm run deploy
```

## License

mddb.dev 使用 GNU Affero General Public License v3.0 or later 授权。详见 [`LICENSE`](LICENSE)。

选择 AGPL 是有意为之：如果你修改并以网络服务形式运行这个 registry，与该服务交互的用户应能获得你修改版本对应的源代码。
