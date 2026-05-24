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
- `knowledge_cutoff` / `released` / `deprecation`：时间信息；
- `other_parameters`：暂未归类但值得保留的参数；
- `sources`：来源证据。

`data/providers/*.json` 仍可作为采集和校验过程中的辅助数据，但项目的公开重点是 `models.json`。

## 前端

前端只保留两类页面：

- `/`：模型列表页，用于搜索、筛选和快速浏览模型参数；
- `/<provider>/<model-id>/`：模型详情页，展示单个模型的规格、来源、关系和补充信息。

前端不是项目核心，只是 `models.json` 的浏览器视图。

## 数据脚本

`scripts/` 保存数据采集、清洗、合并和质量检查脚本。当前主要覆盖：

- 从 OpenRouter 拉取模型和 endpoint 数据；
- 从 LiteLLM 补充非聊天模型和参数；
- 从 models.dev 补充厂牌 / 图标等轻量信息；
- 归一化组织名、模型 ID、模态和价格字段；
- 生成静态站点；
- 运行数据质量检查。

常用命令：

```bash
npm run data:openrouter
npm run data:litellm
npm run data:models-dev
npm run registry:populate:openrouter
npm run registry:populate:litellm
npm run registry:populate:models-dev
npm run data:quality
npm run build
```

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
  models.json                    核心模型参数表
  providers/*.json               采集 / 校验辅助数据
  schema/*.schema.json           JSON Schema（核心 schema：data/schema/models.schema.json）
scripts/                         数据采集、处理、质量检查脚本
web/src/                         两页静态前端源码
public/                          构建产物，不提交
```

## License

mddb.dev 使用 GNU Affero General Public License v3.0 or later 授权。详见 [`LICENSE`](LICENSE)。
