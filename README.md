# mddb.dev

mddb.dev 是一个面向 AI 中转服务 / new-api 生态的开放模型数据库（LLM model registry）。它把 OpenRouter 等上游来源中的模型路由、部署 provider、规格、价格和来源证据整理成可由人阅读、也可由机器消费的 **有向模型图谱**。

公开站点：<https://mddb.dev/models/>

## 当前公开站点

当前站点已经从纯数据仓库推进到可浏览的静态模型数据库：

- `/`：模型动态，展示来自 AIHOT 的模型/AI 行业相关新闻，并按 provider / model tag 连接回实体页；
- `/models/`：模型广场，按 provider-scoped identity 展示可用模型，支持厂牌筛选、搜索、模态筛选、模型 tag 复制和 USD/CNY 价格切换；
- `/models/<provider>/`：Provider 页面，右侧复用模型广场列表样式展示该 provider 的模型，左侧展示相关模型动态；
- `/models/<provider>/<model-id>/`：模型详情页，展示规格、价格、来源、关系和原始证据。

公开站点：<https://mddb.dev/>

## 核心定位

mddb.dev 是一个面向 AI gateway / OpenRouter / new-api 生态的开放模型数据库（LLM model registry）。它关注的不是“把所有模型名压平成一个 canonical string”，而是把真实世界里的 provider、API model-id、endpoint、alias、snapshot、variant、价格和来源证据整理成可审计、可引用的 **provider model graph**。

核心原则：

- **OpenRouter-first identity**：OpenRouter 是当前 canonical import 的基础来源；
- **provider-scoped model path**：公开详情页采用 `/models/<provider>/<model-id>/`；
- **author 与 provider 分离**：author 是研发方，provider 是实际部署/提供服务的一方；
- **secondary source 只做 enrichment**：models.dev、BaseLLM/NewAPI、AIHOT 等补充 logo、价格、动态和可用性，不直接覆盖 OpenRouter-first identity；
- **provenance-first**：价格、规格、provider availability、alias、source record 都保留来源和观察证据；
- **免费/促销 route 不当作官方商业价格**：`:free` 等 free-tier 只作为短期观察处理。

## 当前能力

### 模型广场

模型广场提供一个面向人使用的模型列表：

- 全站统一导航栏：Logo、站名、搜索、菜单、GitHub、USD/CNY 切换；
- provider / author 筛选；
- Text、Image、Embedding、Audio、Video、Rerank、Speech、Transcription 等模态筛选，并显示每类数量；
- 列表价格支持 USD/CNY 联动切换；
- 每行模型可以复制实际 model tag；
- 移动端保留完整表格字段，并通过横向滚动保证可用。

### Provider 页面

Provider 页面用于回答“这个 provider 下有哪些模型，以及最近相关动态是什么”：

- URL：`/models/<provider>/`；
- 右侧模型列表复用模型广场默认列表样式；
- 左侧保留返回模型广场入口，并显示该 provider 相关的最新模型动态；
- 旧 `/models/providers/<provider>/` 路径不再作为有效入口。

### 模型详情页

模型详情页用于查看单个 provider-scoped model node：

- URL：`/models/<provider>/<model-id>/`；
- 标题区显示 case-preserved model id 和关系 chips；
- 展示 input/output modalities、context length、max output、tokenizer、released、supported parameters 等规格；
- 展示 OpenRouter endpoint price，以及 BaseLLM/NewAPI 补充价格（仅当 OpenRouter 缺价时）；
- 价格同样受全站 USD/CNY 切换影响；
- 展示 source/raw evidence，便于审计。

### 模型动态

模型动态来自 AIHOT：

- 默认使用 `mode=all` 拉取，然后按 provider/model vocabulary 做 deterministic tagging；
- 只导出与模型/provider 相关的动态；
- provider/model tag 可点击跳回 `/models/<provider>/` 或 `/models/<provider>/<model-id>/`；
- 当前运行环境会每 20 分钟静默拉取一次 AIHOT 并写入本地 SQLite；异常时才告警。

## 数据模型

当前实现围绕 provider graph 展开：

```text
source_model --has_endpoint--> endpoint_deployment
endpoint_deployment --deployment_of--> source_model
source_model --alias_of--> source_model
source_model --snapshot_of--> source_model
source_model --variant_of--> source_model
```

两类主要节点：

- `source_model`：OpenRouter API、sitemap 或模型页中观察到的模型 ID；
- `endpoint_deployment`：OpenRouter endpoint detail 中观察到的具体 provider/backend 部署。

公开 JSON 中的 `graphModel` 与 `observations` 字段用于逐步表达价格、provider availability 和来源证据：

```text
graphModel.version = v2-observation-graph
observations.pricing[] = provider-specific pricing facts
observations.providers[] = provider / availability facts
```

现有 `nodes` / `edges` 保持兼容；observation layer 用于把价格、provider 可用性和来源证据逐步节点化。

## 数据源

### OpenRouter

- 入口：`https://openrouter.ai/api/v1/models`
- endpoint detail：`/api/v1/models/<model-or-canonical-slug>/endpoints`
- sitemap：`https://openrouter.ai/sitemap.xml`
- 本地快照：`data/openrouter-models.json`、`data/openrouter-endpoints.json`、`data/openrouter-sitemap-models.json`
- 刷新命令：`npm run data:openrouter`
- 可选环境变量：`OPENROUTER_API_KEY`

OpenRouter 是当前重构阶段的基础来源。它提供 API route id、显示名、canonical slug、上下文窗口、architecture、supported parameters 和 token pricing；endpoint detail 用于补充真实部署 provider、价格和参数。

### models.dev

- 入口：`https://models.dev/api.json`
- 本地快照：`data/models-dev-api.json`

models.dev 当前作为 provider / brand logo enrichment 来源接入。logo 信息可进入 `enrichment.modelsDev.brandLogos`，但 messy model id 不会直接覆盖 OpenRouter-first identity。

### BaseLLM / NewAPI metadata

- 站点：`https://basellm.github.io/llm-metadata/`
- 本地快照：`data/basellm-newapi.json`
- 刷新命令：`npm run data:basellm`

BaseLLM / NewAPI metadata 当前作为价格/可用性补充来源接入：

- 只自动挂接 exact source-id 或 model-id-only match；
- 过滤 `:free` route；
- 不覆盖 OpenRouter endpoint price；
- 当 OpenRouter 缺 endpoint price 时，详情页可以显示 `BaseLLM / NewAPI 补充价格`；
- 保留 provider-specific billing mode，例如 token 与 request 计费可以并存。

NewAPI ratio 换算规则：

```text
500,000 tokens = $1
ratio 1 = $2 / 1M tokens
price_per_1m_usd = ratio * 2
```

### AIHOT

- 入口：`https://aihot.virxact.com/api/public/items?mode=all&take=100`
- 本地数据库：`.internal/model-news.sqlite`（git ignored）
- 公开导出：`data/model-news-tagged.json`
- 刷新命令：`npm run data:news`

AIHOT 用于模型动态，不作为 canonical model identity 来源。

## 数据质量与 refresh gate

构建时会同时输出面向审计的数据质量 artifact：

```text
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

## 仓库结构

```text
data/
  openrouter-models.json          OpenRouter source snapshot
  openrouter-endpoints.json       OpenRouter endpoint detail snapshot
  openrouter-sitemap-models.json  OpenRouter sitemap model-page index
  models-dev-api.json             models.dev source snapshot
  basellm-newapi.json             BaseLLM/NewAPI source snapshot
  model-news-tagged.json          AIHOT tagged model news export
src/
  lib/                            importer、normalization、enrichment、renderer 和测试
  scripts/                        静态站点 build script
scripts/
  fetch-openrouter-models.mjs
  fetch-aihot-model-news.mjs
  tag-aihot-model-news.mjs
  export-model-news.mjs
  deploy-static-site.sh
public/                           生成的站点输出，git ignored
.internal/                        本地/私有运行数据与维护笔记，git ignored
```

`docs/` 不作为公开仓库表面的一部分。维护者规划、研究笔记和私有运行细节应放在 `.internal/`，该目录被 git ignore。

## 自行部署与配置

本项目会逐步提供面向自部署 new-api / AI gateway 的数据接口。当前必要配置：

```bash
# 可选：OpenRouter API key，用于刷新模型目录、endpoint detail 或未来需要鉴权的接口
OPENROUTER_API_KEY=sk-or-...

# 规划中：管理员口令，用于后续在自部署站点中修改/审核本地覆盖数据
MDDB_ADMIN_PASSWORD=change-me
```

本地 secret 请放入 `.env` / `.env.local`，不要提交到 git。管理员覆盖数据后续会优先采用本地 JSON 或独立持久层，避免污染公开 source snapshot。

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

刷新 OpenRouter 数据：

```bash
npm run data:openrouter
```

## 公开贡献流程

mddb.dev 欢迎公开贡献，尤其欢迎提升 canonical identity、source provenance 和 pricing accuracy 的修正。

### 有价值的贡献类型

- 添加或修正带 source URL 的 alias；
- 修正 canonical tag normalization 规则；
- 添加 source-specific importer tests；
- 改进 source adapter，同时保留 raw provenance；
- 添加 pricing conversion 测试和边界案例；
- 审核 waiting-list candidate，并说明它应归类为 canonical model、alias、snapshot、variant、deployment，还是 rejected wrapper record；
- 改进公开 JSON projection 和 schema 文档；
- 改进由 registry 数据生成的网站展示。

### 数据变更必须提供的证据

任何 model-data correction 都应包含：

- raw upstream model string 或 route；
- provider / source 名称；
- source URL；
- proposed canonical tag；
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
- normalization 时保留 raw source evidence，而不是只留下清洗后的字符串；
- 不用 secondary source 覆盖 OpenRouter-first canonical identity；
- 为 normalization、importer、pricing 或 rendering 行为添加 / 更新测试；
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

```bash
npm run deploy
```

Dry run：

```bash
npm run deploy:dry-run
```

## License

mddb.dev 使用 GNU Affero General Public License v3.0 or later 授权。详见 [`LICENSE`](LICENSE)。

选择 AGPL 是有意为之：如果你修改并以网络服务形式运行这个 registry，与该服务交互的用户应能获得你修改版本对应的源代码。
