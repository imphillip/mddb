# 火山方舟（Volcengine Ark）价格抓取任务说明

> 给在装有 Playwright 的服务器上接手的智能体（hermes + gpt-5.5）。
> 你的任务只有一件：**把"复制 markdown"这一步用无头浏览器跑通**。其余的解析、归一化、入库都已写好并验证过。

## 1. 背景与为什么需要浏览器

火山方舟两篇文档是这个项目里 ByteDance Doubao / Seed / Seedream / Seedance / 3D / 向量 系列的**唯一人民币官方报价来源**（这些模型大多没有其它价格源）：

| 文档 | document_id | 内容 | 产出文件 |
|---|---|---|---|
| 模型列表 | `1330310` | 模型规格（id、能力、上下文/输入/输出/思维链上限、RPM/TPM） | `sources/raw/volcengine/ark-models.md` |
| 模型价格 | `1544106` | 人民币计价（按 token / 按张 / 按次 / 按向量） | `sources/raw/volcengine/ark-pricing.md` |

URL 形如 `https://www.volcengine.com/docs/82379/<document_id>?lang=zh`。

这两篇文档是 **Feishu/Lark 客户端渲染的 SPA**：原始 HTML 是打乱的 SSR，没有 markdown API，`fetch()` 拿不到表格内容。但页面在每篇文档的 **"···" 溢出菜单**里提供 **"复制 markdown"** 动作，它会把渲染后的表格序列化成**干净的 markdown 表格**。我们要的就是这个 markdown。

> 之前基于普通 `fetch()` 的脚本（`scripts/fetch-volcengine-ark-docs.mjs`）拿到的是打乱的 SSR，已删除；不要再走 `fetch()` 抓 SSR 这条路。

## 2. 你要交付什么

把 **`scripts/fetch-volcengine-markdown.mjs`**（已写好框架，含 best-guess 选择器和 `TODO(playwright-host)` 标记）调通，使其：

1. 用无头 Chromium 打开上面两篇文档；
2. 等待文档正文（渲染后的表格）出现；
3. 打开 "···" 溢出菜单，点击 "复制 markdown"（文案可能是 `复制markdown` / `复制 Markdown` / `Copy as Markdown`）；
4. 通过 `navigator.clipboard.readText()` 读回剪贴板，写入对应的 `.md` 文件；
5. 跑完后自动调用解析脚本（见下）。

**只需要改选择器/交互时序**这部分。脚本的 CLI、输出路径、剪贴板权限、失败截图、调用解析器等骨架都已就绪。失败时会在 `sources/raw/volcengine/fetch-fail-<id>.png` 留截图，用 `--headed --keep-open` 观察真实 DOM 来定位 "···" 触发器和菜单项。

运行方式：

```bash
# 在 fetch 主机上首次安装
npm i -D playwright && npx playwright install chromium

# 抓取并解析（两篇文档）
node scripts/fetch-volcengine-markdown.mjs

# 调试
node scripts/fetch-volcengine-markdown.mjs --headed --keep-open --doc 1330310
```

**登录**：若某篇文档需要登录，导出一次登录态的 Playwright storageState JSON，并设 `MDDB_VOLC_STORAGE_STATE=<path>`，脚本会自动加载。不要把登录态/cookie 提交进仓库。

## 3. DOM 提示（best-guess，需在真实页面确认）

- "···" 溢出触发器通常是文档标题/工具栏附近的图标按钮（`aria-label` 含"更多"/"More"，或 class 含 `more`/`overflow`）。
- 菜单项文案匹配 `/复制\s*markdown|copy\s*as\s*markdown/i`。
- 点击前先等真正的文档内容（一个渲染出来的 `table`）出现，否则可能复制到骨架屏。
- 复制走的是异步剪贴板，context 已授予 `clipboard-read`/`clipboard-write`；读回后脚本会校验长度（<200 字符判失败）。
- Lark 文档有时把动作放在二级菜单或需要先 hover 标题栏才显形——以真实页面为准。

## 4. 解析与归一化（已写好，勿改逻辑，只用来验证）

`.md` 落地后，解析脚本把它们转成结构化数据，供归一化器消费：

```
ark-models.md + ark-pricing.md
        │  scripts/parse-volcengine-markdown.mjs   （确定性解析，纯文本→JSON）
        ▼
sources/raw/volcengine/volcengine.json   { source, count, models[] }
        │  scripts/assemble-sources.mjs            （透传）
        ▼
sources/assembled/volcengine.json
        │  web/src/lib/normalize/adapters/volcengine.ts   （字段级合并进 models.json）
        ▼
data/models.json   （CNY offer：currency=CNY，prices[]，RPM/TPM/pricing_status 入 other_params）
```

解析器要点（已实现，已被 `scripts/parse-volcengine-markdown.test.mjs` 覆盖）：

- **身份**：以 `ark-models.md` 表格链接里的 `Id=<base>` 作为 canonical id（短横线风格，如 `doubao-seed-2-0`）；链接文字里带日期的快照（`-YYMMDD`）作为 snapshot/别名。`ark-pricing.md` 里的点号版本号（`doubao-seedream-4.0`）会被归一为短横线（`doubao-seedream-4-0`）。两篇文档按 matchKey（去分隔符、忽略大小写）对齐。
- **kind**：由 `ark-models.md` 的能力分节标题推断（视频生成→video，图片生成→image，3D生成→3d，向量化→embedding，其余→text）。
- **价格**：大语言模型按"输入长度"分档（input/output/cache_read，元/百万 token）；图片元/张→`image_output` per_image；3D 元/次→`request` per_request；向量元/百万 token→`input`(+`image_input`)。
- **绝不臆造价格**：Seedance 复杂行（2.0 / 2.0-fast / 1.5-pro）按分辨率/有声无声/输入是否含视频分档，**不符合现有 token 价 schema**——这些行**不写价格**，标 `pricing_status: needs_review`，把原始档位文案保留在 `pricing_note` / `pricing_note_offline`，留给人工/后续建模。简单行（1.0-pro=15、1.0-pro-fast=4.2 元/百万 token）正常写价。

## 5. 验收标准

抓到正确的 `.md` 后，整条链路应当复现这些数字（截至本文写作时的文档版本）：

```bash
node scripts/parse-volcengine-markdown.mjs
# 期望：parse-volcengine-markdown: 36 models (31 priced)

npm run data:assemble
npm run build            # tsc + 站点构建
node dist/scripts/build-models.js --sources=sources/assembled
# 期望：fragments 里 volcengine=36；validation: ok
```

抽查（在 `.internal/normalize/models.json` 或 `data/models.json` 里）：

- `doubao-seed-2-0-lite`：3 档输入长度价（[0,32] 0.6/3.6/0.12；(32,128] 0.9/5.4/0.18；(128,256] 1.8/10.8/0.36，元/百万 token），endpoints `["chat"]`。
- `doubao-seedream-4-0`：`image_output` 0.2 元/张，endpoints `["images"]`；`doubao-seedream-5-0-lite`：0.22。
- `doubao-seedance-1-0-pro`：`video` 15 元/百万 token；`doubao-seedance-2-0`：**无价格**、`pricing_status=needs_review`、`pricing_note` 含 46.00/28.00/51.00/31.00。**任何模型的价格里都不应出现 480/720/1080 这类分辨率数字。**
- `doubao-seed3d-2-0`：`request` 2.4 元/次，endpoints `["3d"]`。
- `doubao-embedding-vision`：`input` 0.7 + `image_input` 1.8 元/百万 token，endpoints `["embeddings"]`。

最后跑全套检查（提交前必过）：

```bash
npm test && npm run typecheck && npm run build
```

## 6. 已知盲点 / 可选的后续改进（非本次必须）

- **Seedance 复杂档位**：当前是 `needs_review` + 原文保留。若要真正建模，需要为视频价引入 `分辨率 / 有声无声 / 输入是否含视频 / 离线推理` 等条件维度——这会改 schema，**必须先在 `docs/data-source-rules.md` 记录并人工确认**（项目规则：不为单一数据源随意加 schema 字段）。
- **seedream-5-0 vs 5-0-lite**：`ark-models.md` 把 `doubao-seedream-5-0-lite` 写成 5-0 的"同时支持"，而 `ark-pricing.md` 把 `5.0-lite` 单列计价。当前按两个模型处理（5-0 仅有规格无价、5-0-lite 仅有价）。如需合并/取舍，需人工判定身份。
- **离线推理（批量）价**：视频/文本的"离线推理"列目前只在 `pricing_note_offline` 里留痕，未建成独立 offer/价格组。
- **文档版本漂移**：火山随时可能改版式或加新模型。解析器对列数/分节是宽容的，但若验收数字对不上，先 `git diff sources/raw/volcengine/*.md` 看源端是否变了，再决定是改源数据还是改解析器（改解析器要同步更新 `scripts/parse-volcengine-markdown.test.mjs`）。
