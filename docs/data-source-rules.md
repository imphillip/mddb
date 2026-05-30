# mddb.dev 数据源处理规则

本文固定周期性数据补充的源角色、处理顺序与 schema 边界。若导入脚本、临时 memo、历史技能文档与本文冲突，以本文为准；修改规则时先更新本文与对应审计脚本。

## 核心原则

- `data/models.json` 当前数据与当前 schema 是最高约束。
- 数据源没有按币种划分的权限等级：USD 来源不天然高于 CNY 来源，CNY 来源也不天然低于 USD 来源。
- OpenRouter、LiteLLM、百炼、火山引擎都可以在证据充分且能适配当前 schema 时补充 canonical model rows。
- 处理顺序只表示工程 pipeline 的先后，不表示事实权威等级。
- canonical `model_id` 的选择有身份优先级：优先沿用 OpenRouter 身份；没有 OpenRouter 身份时，优先采用人民币官方计价来源（百炼 / 火山）的身份；最后才采用 LiteLLM 身份。
- 不为了单个来源或一次回填新增 schema；源数据无法干净落入现有 schema 时，先停止并说明缺口。
- 保留 source/provenance；避免 alias、gateway、wrapper、router product 污染 canonical model identity。

## Canonical model-id 选择规则

本节只规定模型身份选择，不改变各数据源能补充 facts/prices/offers 的资格。即：一个来源可以补充价格、上下文、modality 或 provider offer，不代表它可以覆盖已有 canonical `model_id`。

1. **OpenRouter 优先**
   - 如果已有模型与 OpenRouter model identity 匹配，canonical `model_id` 应继续使用 OpenRouter 归一化后的身份。
   - 后续百炼、火山、LiteLLM 命中该模型时，只能追加 source/provenance、prices、offers、limits 等补充事实，不应重写 canonical `model_id`。
   - OpenRouter source ID、route ID、alias 可作为 provenance 保留，但 canonical display/name 清理仍需避免 free/router/product 污染。

2. **人民币官方计价来源次之**
   - 当没有可靠 OpenRouter identity 时，百炼 / 火山这类人民币官方计价来源可以提供 canonical `model_id`。
   - 百炼 / 火山身份优先于 LiteLLM 身份，尤其是在 LiteLLM 行看起来像 adapter、gateway、vendor route 或 wrapper 时。
   - 百炼 / 火山创建或确认 canonical row 时，必须保留 source/provenance，且仍受当前 schema 与 canonical cleanup 约束。

3. **LiteLLM 最后**
   - LiteLLM 可以补规格、mode、复杂 USD 价格、非 chat 模型候选和 provider offer。
   - 只有在没有 OpenRouter 身份、也没有百炼 / 火山等官方人民币来源身份，并且 ID 不是低置信 adapter/gateway/wrapper 形态时，LiteLLM 才可作为 canonical `model_id` 来源。
   - LiteLLM 命中已有 OpenRouter 或人民币官方来源模型时，应作为 enrichment/offer source，而不是改名来源。

4. **冲突处理**
   - 同一模型多源命中但 model IDs 不一致时，先按上述身份优先级保留 canonical `model_id`，其他 ID 进入 aliases/source provenance；不要自动改 schema。
   - 如果无法判断是否同一模型，宁可进入 review / waiting，也不要猜测归并。
   - 发现具体反例后，先补文档案例，再按用户确认修改 importer 或审计脚本。

## 数据源角色

### OpenRouter

- 重要 model_id 标准来源之一。
- 美元计价模型与 OpenRouter route/provider offer 的基础来源。
- 应尽量采集完整：models API、endpoint details、sitemap/page 观测。
- 可以创建或更新 canonical model rows，但仍受当前 `models.json` schema 与 canonical cleanup 约束。

### LiteLLM

- 美元计价数据源中的规格与复杂计价补充来源。
- 重点补充 inference/image 以外的模型类型与规格，例如 embedding、rerank、audio transcription/speech、video generation。
- 可补充 USD 阶梯式或条件式计价。
- 可以在高置信匹配或 importer 明确允许的模式下补充 canonical model rows；adapter/gateway-shaped IDs 需要严格过滤。

### models.dev

- 用于补充厂牌/logo/icon 相关信息，以及**窄白名单 facts 补空**。
- 不作为 canonical model 来源；不根据 models.dev model rows 创建 canonical models。
- 不根据 models.dev offers/prices 覆盖官方商业价格（其 `cost` 字段禁用）。
- **窄白名单补空**：models.dev 可作为**最低优先级**来源，仅补空以下字段，且永不覆盖结构化源已有值：
  - `knowledge_cutoff` ← `knowledge`（其他源都不提供，价值最大；月精度按 `YYYY-MM` 字符串保留，不伪造日精度 epoch）；
  - `release_date`（可选，仅当 OpenRouter/百炼/火山/LiteLLM 均缺失发布时间时）。
- models.dev 数据按 provider 分条、同一 id 多条且不一致：每个白名单字段按**非空值多数表决**（字母序打破平票）确定，冲突无法判定时留空。
- 与 OR/百炼权威字段打架的字段（如 `limit.context`、`cost`）一律不采用。
- models.dev 的贡献记入**单独的来源旁路文件**（不内嵌进 `models.json`，后者保持干净），且不得伪装成模型身份来源。

### 百炼 / Alibaba Bailian

- 人民币计价数据源。
- 可以匹配、补充或创建 canonical model rows，前提是源数据能安全适配当前 `models.json` schema。
- 重点保留 CNY 官方商业价格、阶梯价格、缓存价格、工具计费、上下文、限流、modality 与 source/provenance。

### 火山引擎 / Volcengine Ark

- 人民币计价数据源。
- 可以匹配、补充或创建 canonical model rows，前提是源数据能安全适配当前 `models.json` schema。
- 重点保留 CNY 官方商业价格、输入长度条件、上下文、限流、modality 与 source/provenance。
- 抓取走无头浏览器导出的 markdown（见 `docs/volcengine-pricing-fetch.md`），由 `scripts/parse-volcengine-markdown.mjs` 确定性解析。
- **视频（Seedance）按变体分档计价**：部分模型价格按「输出分辨率 / 是否含视频输入 / 有无声音」分档，不能用 `input_token` 这类按 token 数的条件表达。为此 `PriceCondition.type` 新增取值 `variant`：每个档位是一条 `video` 价格，配 `conditions:[{type:"variant", label:"<档位中文描述>"}]`，分档维度放在 `label`，不带数值阈值。**绝不**把分辨率数字（480/720/1080）当成价格；无法结构化的复杂档位仍标 `pricing_status:needs_review` 并在 `pricing_note` 留原文。离线推理（批量）列为次要信息，保留在 `pricing_note_offline`，不进 `prices[]`。
- 新增 `variant` 取值时已同步：`web/src/lib/normalize/schema.ts`、`web/src/lib/normalize/validate.ts`、`data/schema/models.v2.schema.json` 与解析器测试。

## 推荐处理顺序

推荐顺序如下；它是稳定合并顺序，不是权限排序：

1. 拉取 raw source data：OpenRouter、LiteLLM、models.dev，以及百炼/火山的本地或抓取来源。
2. OpenRouter populate：生成/刷新 OpenRouter 拥有的模型与 provider offer 事实，并保留已有非 OpenRouter 补充事实。
3. LiteLLM populate：补充允许模式的 canonical rows、规格与复杂 USD 计价。
4. models.dev icon enrichment：只补 icon/logo 相关字段。
5. noncanonical prune：移除 router/product/free/latest 等不应作为 canonical model 的行。
6. 百炼 merge：补 CNY facts/prices，必要时补 canonical rows。
7. 火山 merge：补 CNY facts/prices，必要时补 canonical rows。
8. dangling provider offer cleanup：清理所有指向缺失 canonical model IDs 的 provider offers。
9. 运行测试、quality gate、diff check。

## 必须验证的规则

- models.dev 不应成为 canonical model source。
- models.dev 不应创建模型价格或 provider offer 价格。
- models.dev 只能在白名单字段（`knowledge_cutoff`、可选 `release_date`）上以最低优先级补空，且永不覆盖结构化源已有值。
- 百炼与火山允许出现在 canonical model `sources[]`，包括新增模型。
- canonical model source 不应被限制为 OpenRouter/LiteLLM。
- provider offers 的 `model_id` 必须全部指向现有 canonical model。
- provider 内 offer key `model_id|api_model_id|endpoint_path` 必须唯一。
- router/product 型 ID 不应保留为 canonical models。
- free-tier/promotional route 不应作为官方商业价格事实。
