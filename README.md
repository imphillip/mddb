# mddb.dev

mddb.dev 是一个面向 AI 中转服务 / new-api 生态的开放模型数据库（LLM model registry）。它把 OpenRouter 等上游来源中的模型路由、部署 provider、规格、价格和来源证据整理成可由人阅读、也可由机器消费的 **有向模型图谱**。

公开站点：<https://mddb.dev/models/>

## 图谱化特色

mddb.dev 的核心不是扁平模型表，而是类似科学文献引用网络的 provider model graph：模型名称、provider deployment、alias、snapshot、variant、价格、规格和 source record 都通过有向边互相引用。

这个设计让 registry 可以同时表达：

- 同一个模型在不同 provider / gateway / cloud channel 中的真实 API model-id；
- `latest`、日期 snapshot、preview、deployment route 与稳定型号锚点之间的关系；
- 哪些事实来自 OpenRouter，哪些只是 BaseLLM / models.dev 等 secondary source 的补充 observation；
- provider-specific pricing：同一个 model id 可以在不同 provider 下有不同计费模式，例如 token、request、image、audio、video、duration 或自定义单位；
- 冲突或差异不会被覆盖，而是作为带 provenance 的 observation 或关系保留下来。

公开 JSON 中的 `graphModel` 与 `observations` 字段是这条路线的第一步：

```text
graphModel.version = v2-observation-graph
observations.pricing[] = provider-specific pricing facts
observations.providers[] = provider / availability facts
```

现有 `nodes` / `edges` 仍保持兼容；新的 observation layer 用于逐步把价格、provider 可用性和来源证据节点化。

## 当前重构方向

mddb.dev 正在从“全局 canonical model tag 为中心”的目录，重构为更适合 AI gateway 模型管理的 **OpenRouter-first provider graph**。

新的核心 URL 方向是：

```text
/models/<provider-name>/<model-id>
```

其中：

- `author` / 厂牌：模型研发方，例如 Anthropic、OpenAI、Google、Alibaba；
- `provider`：真正部署或提供服务的一方，可以是原厂 API、云厂商、OpenRouter 这类中转站，或用户自己的 new-api 站点；
- `model-id`：该 provider API 中真实使用的模型关键字，mddb.dev 尽量保留 provider 自己的命名习惯；
- 如果两个 provider 的模型规格和价格完全一致，用 `same_as` / `spec_same_as` / `price_same_as` 这类有向关系连接，而不是强行改写成同一个模型 ID。

本阶段暂时暂停 models.dev 与 BaseLLM/NewAPI metadata 的扩展，集中适配 OpenRouter 的 `/api/v1/models`、model endpoint detail、sitemap/page-only 模型发现。

## 核心原则

**Provider-scoped model identity first，author 与 provider 分离，所有规格和价格事实保留 provenance。**

同一个底层模型可能出现在许多 API 路由、云市场、网关别名、日期快照、价格表和 provider 特定命名里。mddb.dev 的目标不是破坏这些命名习惯，而是把它们建模成 provider model node 与有向关系图，同时保留不同来源观察到的 alias、snapshot、variant、deployment、price fact 和 source record。

## OpenRouter provider graph 当前实现

当前 OpenRouter-first 重构把 `/models/` 下的详情页分成两类 node。两类 node 都是有效路径，都保留原始观察，但语义不同。

### Source model paths

`source_model` 表示 OpenRouter 来源层观察到的模型 ID。它回答的问题是：

```text
OpenRouter API、sitemap 或模型页里出现了哪个模型条目？
```

创建标准：

- 来自 `data/openrouter-models.json` 中的 `model.id`；
- 来自 `data/openrouter-sitemap.json` 中的 `modelPages[].id`；
- 两者取并集并去重；
- 每个 source id 生成一个 `nodeKind = source_model` 的 node。

路径规则：

```text
<namespace>/<model-id-within-namespace>
-> /models/<namespace>/<model-id-within-namespace>
```

例子：

```text
google/gemini-2.5-pro
-> /models/google/gemini-2.5-pro

google/gemini-2.5-pro-preview
-> /models/google/gemini-2.5-pro-preview

google/gemini-2.5-pro-preview-05-06
-> /models/google/gemini-2.5-pro-preview-05-06
```

source model node 会保留 OpenRouter API row、endpoint wrapper、sitemap row、page scrape 以及由这些来源推导出的 author、canonical slug、modalities、pricing keys、endpoint count 等信息。

### Endpoint deployment paths

`endpoint_deployment` 表示 OpenRouter endpoint detail 中观察到的具体部署。它回答的问题是：

```text
哪个实际 provider/backend 以哪个 model id 部署了这个模型？
```

创建标准：

- 遍历每个 `source_model` 的 endpoint wrapper；
- 读取 `response.data.endpoints[]`；
- 每个 endpoint row 生成一个 endpoint deployment candidate；
- 按 `<endpoint-provider>/<endpoint-model-id>` 去重；
- 每个唯一 endpoint deployment 生成一个 `nodeKind = endpoint_deployment` 的 node。

路径规则：

```text
provider = normalize(endpoint.tag with / replaced by -)
model-id = model id parsed from endpoint.name after |
route = /models/<provider>/<model-id>
```

例子：

```text
endpoint.tag = google-vertex/global
endpoint.name = Google | google/gemini-2.5-pro

-> provider = google-vertex-global
-> model-id = gemini-2.5-pro
-> /models/google-vertex-global/gemini-2.5-pro
```

如果 endpoint 路径与已有 source model 路径冲突，endpoint 会落到 `/endpoint` 子路径，保证所有 graph node 都有唯一 route。

### Graph edges

两类 node 通过有向边连接，而不是互相覆盖：

- `source_model --has_endpoint--> endpoint_deployment`：表示某个 OpenRouter source model 观察到了这个 endpoint deployment。
- `endpoint_deployment --deployment_of--> source_model`：表示该 endpoint deployment 指向哪个规格/型号节点。
- `source_model --alias_of--> source_model`：表示前者是后者的 alias。
- `source_model --snapshot_of--> source_model`：表示前者是后者的日期或版本 snapshot。
- `source_model --variant_of--> source_model`：表示前者是后者的有意义能力、价格、上下文或服务等级变体。

例如：

```text
google-vertex-global/gemini-2.5-pro
--deployment_of-->
google/gemini-2.5-pro-preview

google/gemini-2.5-pro
--alias_of-->
google/gemini-2.5-pro-preview

google/gemini-2.5-pro-preview-05-06
--snapshot_of-->
google/gemini-2.5-pro-preview
```

### Spec anchor nodes

在这个有向图里，很多 alias、snapshot、deployment、variant 最终都会指向少数更稳定的型号节点。我们把这种被其他 node 指向、用于承载规格/型号语义的节点称为 **spec anchor node**，中文可称为 **型号锚点**。

spec anchor node 必须来自 `source_model`，也就是 source model paths。`endpoint_deployment` 可以指向 spec anchor，但它本身不应成为 spec anchor：endpoint 表示 provider/backend 的部署观察，而不是型号规格本体。

直觉上，spec anchor node 是“有 name tag 的模型型号”：它不是某个云区域、gateway route 或临时别名，而是其他观察最终归向的规格对象。实际计算时需要忽略 `sourced_from`、`same_author_as` 等非身份边，并根据 `alias_of`、`snapshot_of`、`variant_of`、`deployment_of` 这类语义边寻找入度汇聚点。

注意：一个 spec anchor node 仍然可能有 outgoing edges，例如它也有自己的 endpoint observations。因此“只有 incoming、没有 outgoing”是一个有用的图论信号，但不是唯一判定标准。更稳妥的定义是：

```text
spec anchor node = 位于 source model paths 中、被 alias/snapshot/variant/deployment 等语义边指向的规格承载节点。
```

### Counting rules

当前 `/models/` 下的有效详情路径数量按唯一 route 计算：

```text
effective model paths = unique(node.route)
```

在当前部署中：

```text
source model paths: 445
endpoint deployment paths: 799
effective model detail paths: 1244
route collisions: 0
```

## 核心资产是什么

mddb.dev 的核心资产不是一个渲染后的网页，也不是某一个上游原始 JSON 文件，而是：

**带 provenance 的 provider model graph。**

换句话说，registry 应该能回答：

- 这个 provider 暴露的真实 API model-id 是什么？
- 该 model-id 的 author / 厂牌是谁？
- 哪些 provider model node 在规格或价格上相同、继承或互为 alias？
- 哪些差异是有意义的 variant、snapshot、tier 或 endpoint 条件？
- 观察到的价格、上下文窗口、模态、限制和能力是什么？
- 每个事实来自哪个 source，什么时候观察到？
- 哪些候选记录仍然需要人工审核？

网站只是这个 registry 的一种投影。公开的机器可读 JSON 导出是另一种投影。

## 当前数据源

### OpenRouter

- 入口：`https://openrouter.ai/api/v1/models`
- endpoint detail：`/api/v1/models/<model-or-canonical-slug>/endpoints`
- sitemap：`https://openrouter.ai/sitemap.xml`
- 本地快照：`data/openrouter-models.json`
- 刷新命令：`npm run data:openrouter`
- 可选环境变量：
  - `OPENROUTER_MODELS_URL`：覆盖默认 API URL。
  - `OPENROUTER_API_KEY`：可选 Bearer token，用于应对鉴权、限流或未来私有部署。

OpenRouter 是当前重构阶段的基础来源。它提供 OpenRouter 作为 gateway/provider 时的 API route id、显示名、canonical slug、上下文窗口、architecture 字段、supported parameters 和 token pricing。

在当前 OpenRouter-first 实现中，OpenRouter `/api/v1/models` 的每一行首先生成一个 `source_model` 观察节点：

```text
source-id = <row.id>
namespace = first segment of source-id
model-id = remaining segments of source-id
route = /models/<namespace>/<model-id>
```

例如 `anthropic/claude-sonnet-4` 会生成 `/models/anthropic/claude-sonnet-4`。这里的 `anthropic` 主要表示 OpenRouter source id 的 namespace，并可帮助推断 author/厂牌；真正的部署 provider 由 endpoint detail 中的 `endpoint.tag` / `provider_name` 建模为 `endpoint_deployment` 节点。

OpenRouter endpoint detail 用于补充真实部署 provider（如 Anthropic、Google Vertex、Amazon Bedrock）的上下文长度、价格、参数和来源证据。sitemap/page-only 页面用于发现 `/api/v1/models` 未列出的 embedding、rerank、image、video、audio、TTS/STT 等模型类型。

`data/openrouter-model-pages.json` 是从 OpenRouter 模型详情页 HTML 中抽取的 page raw 中间快照，体积较大且可通过 `npm run data:openrouter` 重新生成；它默认不纳入 git。缺少该文件时，build 会退化为只使用 API、endpoint detail 和 sitemap index 中已有的数据。

### models.dev

- 入口：`https://models.dev/api.json`
- 本地快照：`data/models-dev-api.json`

models.dev 当前作为 provider / brand logo enrichment 来源接入。它的 provider/logo 信息可进入 `enrichment.modelsDev.brandLogos`，但 messy model id 不会直接覆盖 OpenRouter-first identity；后续 unmatched rows 会进入候选/审核队列。

### BaseLLM / NewAPI metadata

- 站点：`https://basellm.github.io/llm-metadata/`
- 本地快照：`data/basellm-newapi.json`
- 刷新命令：`npm run data:basellm`

BaseLLM / NewAPI metadata 当前作为价格/可用性补充来源接入：

- 只自动挂接 exact source-id 或 model-id-only match；
- 过滤 `:free` route，不把免费 promotional route 当官方价格；
- 不覆盖 OpenRouter endpoint price；
- 当 OpenRouter 缺 endpoint price 时，详情页可以显示 `BaseLLM / NewAPI 补充价格`；
- 同时写入 `observations.pricing[]` / `observations.providers[]`，保留 provider-specific billing mode，例如 token 与 request 计费可以并存。

NewAPI ratio 换算规则：

```text
500,000 tokens = $1
ratio 1 = $2 / 1M tokens
price_per_1m_usd = ratio * 2
```

## 身份模型（迁移中）

历史实现使用全局 canonical tag 作为 URL 和 join key。接下来的 provider graph schema 会把主身份迁移到 provider-scoped model node：

```text
/models/<provider-name>/<model-id>
```

旧的 canonical tag、alias、snapshot、variant、deployment 概念不会消失，但会从“主实体”降级为 provider model node 之间的关系、引用和 projection helper。

规则：

- 小写 ASCII；
- URL 安全：只使用 `a-z`、`0-9` 和 `-`；
- 在 registry 内全局唯一；
- 跨 snapshot 和 deployment 保持稳定；
- 基于逻辑模型名，并先抽离非身份修饰符；
- 不能被复用于另一个不同逻辑模型。

canonical tag 不应包含：

- `anthropic/`、`openai/`、`google/` 这类 provider route prefix；
- `2024-08-06`、`20250514` 这类日期 snapshot suffix；
- 仅表示部署位置或渠道的 `azure-`、`bedrock-`、`databricks-`、region prefix；
- `@default` 这类 transport / routing suffix；
- period、slash 或 underscore。

例子：

```text
openai/gpt-4o                     -> gpt-4o
openai/gpt-4o-2024-08-06          -> gpt-4o
anthropic/claude-sonnet-4         -> claude-sonnet-4
claude-4-5-haiku                  -> claude-haiku-4-5
gemini-2.5-pro                    -> gemini-2-5-pro
```

### Display name

display name 是给人看的模型名称，可以保留大小写、空格、标点和 period。

例子：

```text
gemini-2-5-pro       -> Gemini 2.5 Pro
claude-haiku-4-5     -> Claude Haiku 4.5
gpt-4o               -> GPT-4o
qwen3-235b-a22b      -> Qwen3 235B A22B
```

### Alias

alias 是可以解析到 canonical tag 的外部字符串，但不会创建新的模型实体。

适合作为 alias 的内容包括官方 API identifier、provider route、aggregator route、cloud SKU、regional deployment ID、dated snapshot ID、拼写变化和常见俗称。

alias 应该可搜索、可展示，但不能抬高 model count。

### Snapshot

snapshot 是同一个逻辑模型下的日期或版本发布记录。

例子：

```text
gpt-4o-2024-08-06       -> canonical gpt-4o, snapshot 2024-08-06
claude-opus-4-6-v1      -> canonical claude-opus-4-6, snapshot v1
```

不要把 snapshot marker 简单 strip 后丢弃；应把它移动到 snapshot 或 source record metadata。

### Variant

variant 是同一个 canonical model 下对用户有意义的差异。只有当行为、能力、上下文窗口、输出限制、价格、服务等级或合规边界有实际区别时，才应该创建 variant。

典型 variant：

- thinking / no-thinking route；
- free、fast、batch、compact、online、priority 等会影响行为或价格的 tier；
- 不同 context window；
- provider-specific limit 或 capability 确实不同；
- 开源模型里的 quantization 或 model-size 差异。

不要因为拼写变化、route namespace、region prefix 或 cloud wrapper 就创建 variant，除非它们确实代表行为或能力差异。

### Deployment

deployment 是 provider、aggregator、cloud、region、route 或 channel 对 canonical model / variant 的服务观察。

例子：Anthropic、OpenRouter、Azure AI Foundry、Google Vertex、Amazon Bedrock、Databricks、regional API route、gateway channel。

deployment 不应创建新的 canonical tag，除非它服务的是一个真正不同的模型。

### Source record 和 provenance

每条上游观察都应该可解释。只要 normalization 删除或转换了信息，就要在 source record 里保留原始值和转换证据。

source record 应保留 raw id、raw name、source provider id、route namespace、被抽离的 region / wrapper prefix、snapshot marker、variant hint、source-specific metadata 和 conflict-lost value。

Normalization 不能变成破坏性清洗。

## 公开 registry 方向

目标公开产物是一组稳定 JSON registry 文件，以及从同一 canonical 数据模型生成的 projection。

可能的目标结构：

```text
data/
  registry/
    models.json
    aliases.json
    snapshots.json
    variants.json
    deployments.json
    prices.json
    source-records.json
    brands.json
    providers.json
  public-api/
    models.json
    aliases.json
    newapi/ratio_config-v1-base.json
    sub2api/models.json
```

当前实现仍在向 registry-first 形态演进。有些数据仍通过 TypeScript gallery structure 渲染，同时 importer、enrichment logic 和测试正在逐步重构。

## 仓库结构

```text
data/
  openrouter-models.json    OpenRouter source snapshot
  openrouter-endpoints.json OpenRouter endpoint detail snapshot
  openrouter-sitemap-models.json OpenRouter sitemap model-page index
  models-dev-api.json       models.dev source snapshot
  basellm-newapi.json       BaseLLM/NewAPI source snapshot
src/
  lib/                      Importer、normalization、enrichment、renderer 和测试
  scripts/                  静态站点 build script
scripts/
  fetch-openrouter-models.mjs
  deploy-static-site.sh
public/                     生成的站点输出，git ignored
.internal/                  本地/私有维护笔记，git ignored
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
