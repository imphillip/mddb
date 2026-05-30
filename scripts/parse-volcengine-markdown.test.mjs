import { describe, expect, it } from 'vitest'
import { buildModels } from './parse-volcengine-markdown.mjs'

// Minimal stand-ins for the real "复制markdown" exports. Spec rows carry the clean base id in the
// URL's Id= param and the dated snapshot as link text; media sections live under their own heading.
const MODELS_MD = `
# 深度思考能力
## 推荐模型
<span aceTableMode="list"></span>
|模型 |能力 |限制 |限流 |
|---|---|---|---|
|[doubao-seed-2-0-lite-260428](https://x/detail?Id=doubao-seed-2-0-lite) |深度思考<br><br>工具调用 |上下文窗口: 256k<br><br>最大输入: 224k<br><br>最大回答: 32k<br><br>最大思维链: 32k |最大 RPM: 30000<br><br>最大 TPM: 5000000 |

# 视频生成能力
|模型 |能力 |
|---|---|
|[doubao-seedance-2-0-260128](https://x/detail?Id=doubao-seedance-2-0) |多模态生视频 |
|[doubao-seedance-1-0-pro-250528](https://x/detail?Id=doubao-seedance-1-0-pro) |图生视频 |

# 图片生成能力
|模型 |能力 |
|---|---|
|[doubao-seedream-4-0-250828](https://x/detail?Id=doubao-seedream-4-0) | |
`

const PRICING_MD = `
# 大语言模型
## 在线推理（常规）
<span></span>
|模型 |输入长度 |输入(非音频) |x |y |缓存命中(非音频) |z |输出 |
|---|---|---|---|---|---|---|---|
|doubao-seed-2-0-lite |输入长度 [0, 32] |0.6 | | |0.12 | |3.6 |
| |输入长度 (128, 256] |1.8 | | |0.36 | |10.8 |

# 视频生成模型
## 按token单价
|模型 |在线推理<br><br>元/百万token |离线推理<br><br>元/百万token |
|---|---|---|
|doubao\\-seedance\\-2.0<br><br>> 按分辨率定价 |* 输出视频分辨率为 480p，720p<br><br>* 输入不含视频：46.00<br><br>* 输入包含视频：28.00 |暂不支持 |
|doubao\\-seedance\\-1.0\\-pro |15.00 |7.50 |

# 图片生成模型
|模型名称 |单价<br><br>元/张 |
|---|---|
|doubao\\-seedream\\-4.0 |0.2 |
|doubao\\-seedream\\-5.0\\-lite |0.22 |
`

const models = buildModels(MODELS_MD, PRICING_MD)
const byId = new Map(models.map((m) => [m.id, m]))

describe('buildModels: identity + merge', () => {
  it('uses the dash-convention base id (from spec Id=) and folds version dots to dashes', () => {
    expect(byId.has('doubao-seedance-2-0')).toBe(true)
    expect(byId.has('doubao-seedream-4-0')).toBe(true)
    // price-only media model with no spec still normalizes its dotted version to dashes
    expect(byId.has('doubao-seedream-5-0-lite')).toBe(true)
    expect(models.every((m) => !/\d\.\d/.test(m.id))).toBe(true)
  })

  it('merges spec facts (limits, snapshots, capabilities) onto priced models', () => {
    const lite = byId.get('doubao-seed-2-0-lite')
    expect(lite.context_window).toBe(256 * 1024)
    expect(lite.max_input_tokens).toBe(224 * 1024)
    expect(lite.rpm).toBe(30000)
    expect(lite.capabilities).toEqual(expect.arrayContaining(['深度思考', '工具调用']))
    expect(lite.snapshots).toContain('doubao-seed-2-0-lite-260428')
    expect(lite.source_kind).toBe('text')
  })

  it('classifies media kind from the ark-models.md section heading', () => {
    expect(byId.get('doubao-seedance-2-0').source_kind).toBe('video')
    expect(byId.get('doubao-seedream-4-0').source_kind).toBe('image')
  })
})

describe('buildModels: tiered LLM prices', () => {
  it('parses input-length tiers with input/output/cache_read components', () => {
    const lite = byId.get('doubao-seed-2-0-lite')
    expect(lite.prices).toHaveLength(2)
    expect(lite.prices[0].input).toEqual({ amount: 0.6, unit: 'per_1m_tokens' })
    expect(lite.prices[0].output).toEqual({ amount: 3.6, unit: 'per_1m_tokens' })
    expect(lite.prices[0].cache_read).toEqual({ amount: 0.12, unit: 'per_1m_tokens' })
    expect(lite.prices[1].conditions[0]).toMatchObject({ gt: 128 * 1024, lte: 256 * 1024 })
  })
})

describe('buildModels: video pricing never fabricates', () => {
  it('keeps a single bare per-1M-token price for simple rows', () => {
    const pro = byId.get('doubao-seedance-1-0-pro')
    expect(pro.prices).toEqual([{ video: { amount: 15, unit: 'per_1m_tokens' } }])
    expect(pro.pricing_status).toBeUndefined()
  })

  it('does NOT mistake a resolution (480p) for a price; flags needs_review and keeps raw text', () => {
    const m = byId.get('doubao-seedance-2-0')
    expect(m.prices).toEqual([]) // no fabricated price
    expect(m.pricing_status).toBe('needs_review')
    expect(m.pricing_note).toContain('46.00')
    expect(m.pricing_note).not.toMatch(/^480/) // resolution must not lead as if it were a price
    // 480 must never appear as a price amount anywhere
    expect(models.flatMap((x) => x.prices ?? []).some((p) => p.video?.amount === 480)).toBe(false)
  })
})

describe('buildModels: flat per-image prices', () => {
  it('maps 元/张 to image_output per_image', () => {
    expect(byId.get('doubao-seedream-4-0').prices).toEqual([{ image_output: { amount: 0.2, unit: 'per_image' } }])
    expect(byId.get('doubao-seedream-5-0-lite').prices).toEqual([{ image_output: { amount: 0.22, unit: 'per_image' } }])
  })
})
