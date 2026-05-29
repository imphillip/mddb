import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  parseVolcengineMediaModels,
  parseVolcengineSpecs,
  volcengineFragment,
  volcengineMediaFragment,
} from './volcengine.js'

const specsMd = readFileSync(
  new URL('../__fixtures__/volcengine-1330310-specs.md', import.meta.url),
  'utf8',
)
const specs = parseVolcengineSpecs(specsMd)
const byId = new Map(specs.map((s) => [s.id, s]))

describe('parseVolcengineSpecs', () => {
  it('extracts text-model blocks regardless of field order (no markdown noise / no media)', () => {
    expect(specs.length).toBe(23)
    expect(specs.every((s) => /^[a-z][a-z0-9.-]+$/u.test(s.id))).toBe(true)
    expect(byId.has('doubao-seed-1-6-250615')).toBe(true)
    expect(byId.has('deepseek-v4-pro-260425')).toBe(true)
    // image/video/3D blocks must not leak in as text models
    expect(specs.some((s) => s.id.includes('seedream') || s.id.includes('seedance') || s.id.includes('3d'))).toBe(false)
  })

  it('parses limits and k-suffixed token sizes for doubao-seed-1-6-250615', () => {
    const spec = byId.get('doubao-seed-1-6-250615')!
    expect(spec.rpm).toBe(30000)
    expect(spec.tpm).toBe(5000000)
    expect(spec.contextLength).toBe(256 * 1024)
    expect(spec.maxInputTokens).toBe(224 * 1024)
    expect(spec.maxOutputTokens).toBe(32 * 1024)
    expect(spec.maxReasoningTokens).toBe(32 * 1024)
    expect(spec.capabilities).toContain('深度思考')
    expect(spec.capabilities).toContain('工具调用')
  })
})

describe('volcengineFragment', () => {
  const fragment = volcengineFragment(byId.get('doubao-seed-1-6-250615')!, {
    observedAt: '2026-05-26T00:00:00Z',
    sourceUrl: 'https://www.volcengine.com/docs/82379/1330310',
  })

  it('mints a low-confidence canonical fragment with derived facts', () => {
    expect(fragment.identityId).toBe('doubao-seed-1-6-250615')
    expect(fragment.facts.reasoning).toBe(true)
    expect(fragment.facts.tool_calling).toBe(true)
    expect(fragment.facts.author).toBe('bytedance')
    expect(fragment.facts.input_modalities).toEqual(expect.arrayContaining(['text', 'image']))
    expect(fragment.facts.max_input_tokens).toBe(224 * 1024)
    expect(fragment.facts.other_parameters).toMatchObject({
      source_confidence: 'low',
      max_reasoning_tokens: 32 * 1024,
    })
  })

  it('emits a CNY offer with rate limits + needs_review pricing (no guessed prices)', () => {
    expect(fragment.offer?.currency).toBe('CNY')
    expect(fragment.offer?.other_params).toEqual({
      pricing_status: 'needs_review',
      RPM: 30000,
      TPM: 5000000,
    })
    expect(fragment.offer?.prices).toEqual([])
    expect(fragment.offer?.endpoints).toBe('chat')
  })
})

describe('parseVolcengineMediaModels', () => {
  const media = parseVolcengineMediaModels(specsMd)
  const byId = new Map(media.map((m) => [m.id, m]))

  it('extracts Seedream/Seedance/3D by product family, with no text-model false positives', () => {
    const kinds = new Map(media.map((m) => [m.id, m.kind]))
    expect(kinds.get('doubao-seedream-5-0-260128')).toBe('image')
    expect(kinds.get('doubao-seedance-1-0-pro-250528')).toBe('video')
    expect(kinds.get('doubao-seed3d-2-0-260328')).toBe('3d')
    // text models adjacent to media blocks must NOT be misclassified
    expect(byId.has('doubao-1-5-vision-pro-32k-250115')).toBe(false)
    expect(byId.has('doubao-seed-character-251128')).toBe(false)
    expect(media.length).toBe(11)
  })

  it('builds image/video fragments with correct output modality and no guessed prices', () => {
    const seedream = volcengineMediaFragment(byId.get('doubao-seedream-5-0-260128')!)
    expect(seedream.facts.output_modalities).toEqual(['image'])
    expect(seedream.facts.other_parameters).toMatchObject({ source_confidence: 'low', media_type: 'image' })
    expect(seedream.offer?.prices).toEqual([])
    expect(seedream.offer?.other_params).toEqual({ pricing_status: 'needs_review' })

    const seedance = volcengineMediaFragment(byId.get('doubao-seedance-1-0-pro-250528')!)
    expect(seedance.facts.output_modalities).toEqual(['video'])
    expect(seedance.offer?.endpoints).toBe('video')
  })
})
