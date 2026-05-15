# mddb.dev

mddb.dev 是一个开放的大模型数据库（LLM model registry）。它把分散在模型供应商、聚合网关、价格表和社区数据源里的模型信息，整理成以「规范模型身份」为中心、带来源追踪的数据注册表，供人阅读，也供机器消费。

公开站点：<https://mddb.dev/models/>

## 核心原则

**模型身份优先，Provider 只是观察来源、部署方式或分发渠道。**

同一个底层模型可能出现在许多 API 路由、云市场、网关别名、日期快照、价格表和 provider 特定命名里。mddb.dev 的目标是把这些观察归并到一个稳定的 canonical model identity，同时把不同事实保留为 alias、snapshot、variant、deployment、price fact 和 source record。

## 核心资产是什么

mddb.dev 的核心资产不是一个渲染后的网页，也不是某一个上游原始 JSON 文件，而是：

**带 provenance 的 canonical model identity graph。**

换句话说，registry 应该能回答：

- 稳定的 canonical model tag 是什么？
- 哪些上游字符串、路由、别名和快照指向它？
- 哪些差异是有意义的 variant，而不是新模型？
- 哪些 provider、gateway、cloud 或 region 正在提供它？
- 观察到的价格、上下文窗口、模态、限制和能力是什么？
- 每个事实来自哪个 source，什么时候观察到？
- 哪些候选记录仍然需要人工审核？

网站只是这个 registry 的一种投影。公开的机器可读 JSON 导出是另一种投影。

## 当前数据源

### OpenRouter

- 入口：`https://openrouter.ai/api/v1/models`
- 本地快照：`data/openrouter-models.json`
- 刷新命令：`npm run data:openrouter`
- 可选环境变量：
  - `OPENROUTER_MODELS_URL`：覆盖默认 API URL。
  - `OPENROUTER_API_KEY`：可选 Bearer token，用于应对未来鉴权或限流变化。

OpenRouter 是当前第一阶段的基础目录来源。它提供 route id、显示名、canonical slug、上下文窗口、architecture 字段、supported parameters 和 token pricing。

mddb.dev 把 OpenRouter route 视为一条观察记录。像 `anthropic/claude-sonnet-4` 里的 provider namespace 不会自动成为 canonical identity 的一部分。

### models.dev

- 入口：`https://models.dev/api.json`
- 本地快照：`data/models-dev-api.json`

models.dev 是辅助 enrichment 来源，主要用于 provider availability、logo、metadata、pricing observation，以及发现 OpenRouter 当前未覆盖的候选模型。

如果 models.dev 记录能安全匹配已有 OpenRouter-derived canonical tag，它会作为补充信息叠加。如果无法安全匹配，则进入 waiting list，而不是直接成为 canonical model。

### BaseLLM / NewAPI metadata

- 站点：`https://basellm.github.io/llm-metadata/`
- 本地快照：`data/basellm-newapi.json`

BaseLLM / NewAPI 数据用于补充 NewAPI 生态里的价格和可用性记录。

BaseLLM 记录不会替换 canonical model。安全匹配后，它们会成为同一个 canonical model 下的 pricing / availability variant。

NewAPI ratio 换算规则：

```text
500,000 tokens = $1
ratio 1 = $2 / 1M tokens
price_per_1m_usd = ratio * 2
```

## 身份模型

### Canonical tag

canonical tag 是用于 URL 和 join 的稳定模型 ID。

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
