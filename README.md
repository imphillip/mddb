# mddb.dev

mddb.dev 是一个开源的大模型参数库。项目重新聚焦在一个核心文件：`data/models.json`。

目标很简单：把主流大模型的身份、作者、模态、上下文、输出上限、工具调用、推理能力、发布时间、下架状态和来源证据整理成一份可读、可查、可被程序直接消费的 JSON。

公开站点：<https://models.mddb.dev/>

## 核心数据

### `data/models.json`

这是项目的核心产物，也是优先消费入口。

Raw URL：

```text
https://raw.githubusercontent.com/imphillip/mddb/main/data/models.json
```

典型字段：

- `id`：canonical model id，用于 URL slug 和程序引用；
- `model`：模型正式名称；
- `alias`：上游或生态里的别名 / 快照名；
- `author`：模型研发方；
- `input_modalities` / `output_modalities`：输入、输出模态；
- `context_length` / `max_output_tokens`：关键上下文参数；
- `reasoning` / `tool_calling`：能力标记；
- `release_timestamp` / `deprecation`：时间信息；
- `other_parameters`：暂未归类但值得保留的参数（含 `knowledge_cutoff` 知识截止日期）；
- `sources`：来源证据。

价格与调用信息以 `offers[]` 内嵌在每个模型上（每个数据源一条 offer，含币种、计价、endpoint、限流）；各源的原始与合并视图见 `sources/`。项目的公开重点是 `models.json`。

`endpoints` 是模型级字段（各源支持的 API 操作并集，与协议无关），取值：`chat`、`responses`、`embeddings`、`images`、`audio.transcription`、`audio.speech`、`rerank`、`video`、`3d`。人民币官方价只收录**原价**（滤除限时促销折扣）。

**身份与计价归并**：带日期的快照 id（`-YYMMDD` / `-YYYYMMDD` / `-YYYY-MM-DD`）统一折叠到基名，快照 id 进 `alias_id`（折叠不会被误判为下架）。计价主源优先、补充源去重：OpenRouter 已计价则不再收录 LiteLLM 的 offer；Bailian 已用 CNY 计价则不再收录火山的 offer（补充源的事实仍按字段级合并）。

## 前端

前端只保留两类页面：

- `/`：模型列表页，用于搜索、筛选和快速浏览模型参数；
- `/<provider>/<model-id>/`：模型详情页，展示单个模型的规格、来源、关系和补充信息。

前端不是项目核心，只是 `models.json` 的浏览器视图。

## 数据管线

`models.json` 由一条四阶段管线从各数据源生成 / 更新：

```text
① fetch     抓取各源原始数据         → sources/raw/<…>            (scripts/fetch-*.mjs)
② assemble  同一源的多个文件合并为一份 → sources/assembled/<source>.json  (scripts/assemble-sources.mjs)
③ diff      候选 ↔ 现有 models.json   → 变更报告(新增 / 更新 / 下架)   (scripts/diff-models.mjs)
④ apply     合并写入:更新替换、消失模型标 deprecation 保留、护栏拦截异常 → data/models.json
```

数据源:OpenRouter（身份 + 美元价 / endpoint）、LiteLLM（规格与复杂美元价、非聊天模型）、阿里云百炼 / 火山方舟（人民币官方计价）。归一化逻辑在 `web/src/lib/normalize/`（每源一个 adapter → 字段级合并）。

`knowledge_cutoff`（知识截止）不再来自任何活动数据源，作为冻结的 maintainer 静态数据保存在 `data/models-dev-frozen.json`，构建时注入到 `other_parameters.knowledge_cutoff`（仅补空）；同文件还保存了无活动源提供的 `release_timestamp` 兜底值。provider 图标是 `data/provider-icons/*.svg` 静态资源，由站点构建直接拷贝。

**火山方舟例外**:火山的两篇文档是 Feishu/Lark 客户端渲染的 SPA,`fetch()` 拿不到表格,需用无头浏览器触发"复制 markdown"导出 `sources/raw/volcengine/ark-models.md` + `ark-pricing.md`,再由 `scripts/parse-volcengine-markdown.mjs` 解析为结构化 `volcengine.json`。因此火山的**抓取**是一个独立的浏览器步骤(`npm run data:volcengine`,需 Playwright),不进 `data:fetch` 自动链;`.md` 与解析产物均已入库,日常 `assemble → normalize` 直接消费。详见 [`docs/volcengine-pricing-fetch.md`](docs/volcengine-pricing-fetch.md)。

### 日常更新流程（SOP）

```bash
npm run update          # ① fetch → ② assemble → ③ diff（只读,打印新增 / 更新 / 下架报告）
# 审阅报告:确认无异常下架(guardrail 默认 removed>5% 时拦截 apply)
npm run update:apply    # ④ 合并写入 data/models.json（自动标记 deprecation、护栏保护）
git add data/models.json sources/ && git commit
```

- `npm run update` 只读、非破坏:候选写到 `.internal/update/`，不动 `data/models.json`。
- 消失的模型**不删除**,标记 `deprecation: { status: "delisted", since }` 保留。
- 若某源抓取失败 / 版式突变导致大批模型“消失”,护栏会拦截 `apply`，避免误判下架。
- 单源命令(按需单独刷新):`npm run data:openrouter | data:litellm | data:bailian`，随后 `npm run data:assemble`。
- 火山方舟单独刷新(需 Playwright 主机):`npm run data:volcengine`(抓 markdown + 解析);仅重跑解析(已有 `.md`)用 `npm run data:volcengine:parse`。
- 首次运行(无既有 `models.json`)等同重建:diff 把全部模型计为“新增”。

## 本地开发

```bash
npm install
npm test
npm run build
npm run serve
```

私密配置不要提交。需要本地密钥时复制模板：

```bash
cp .env.example .env.local
```

常用变量：

- `OPENROUTER_API_KEY`：OpenRouter 数据抓取 / 更新脚本使用；
- `UPDATE_ADMIN_PASSWORD`：内部 `/update/` 更新管理台密码。

`.env.local` 已在 `.gitignore` 中忽略。

## 仓库结构

```text
data/
  models.json                    核心模型参数表（最终产物）
  schema/                        JSON Schema（核心契约：data/schema/models.schema.json）
sources/
  raw/<source>…                  ① 各源抓取的原始数据（已入库，可追溯源端变动）
  assembled/<source>.json        ② 每源合并后的单一视图（供 build 消费）
scripts/                         fetch-*（抓取）/ assemble-sources / diff-models 等管线脚本
web/src/lib/normalize/           归一化器（每源 adapter + 合并 + 校验）
web/src/                         两页静态前端源码
public/, dist/                   构建产物，不提交
```

## License

mddb.dev 使用 GNU Affero General Public License v3.0 or later 授权。详见 [`LICENSE`](LICENSE)。
