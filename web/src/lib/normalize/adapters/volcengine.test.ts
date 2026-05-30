import { describe, expect, it } from 'vitest'
import { volcengineFragments, volcengineModelFragment, type VolcengineModel } from './volcengine.js'

// Structured records as produced by scripts/parse-volcengine-markdown.mjs.
const seedLite: VolcengineModel = {
  id: 'doubao-seed-2-0-lite',
  name: 'doubao-seed-2-0-lite',
  source_kind: 'text',
  currency: 'CNY',
  capabilities: ['深度思考', '文本生成', '多模态理解', '工具调用', '结构化输出', '视觉定位'],
  context_window: 262144,
  max_input_tokens: 229376,
  max_output_tokens: 4096,
  max_reasoning_tokens: 32768,
  rpm: 30000,
  tpm: 5000000,
  snapshots: ['doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-lite-260215'],
  prices: [
    {
      conditions: [{ type: 'input_token', label: '输入长度 [0, 32]', lte: 32768 }],
      input: { amount: 0.6, unit: 'per_1m_tokens' },
      output: { amount: 3.6, unit: 'per_1m_tokens' },
      cache_read: { amount: 0.12, unit: 'per_1m_tokens' },
    },
    {
      conditions: [{ type: 'input_token', label: '输入长度 (128, 256]', gt: 131072, lte: 262144 }],
      input: { amount: 1.8, unit: 'per_1m_tokens' },
      output: { amount: 10.8, unit: 'per_1m_tokens' },
      cache_read: { amount: 0.36, unit: 'per_1m_tokens' },
    },
  ],
}

const seedream: VolcengineModel = {
  id: 'doubao-seedream-4.0',
  name: 'doubao-seedream-4.0',
  source_kind: 'image',
  currency: 'CNY',
  prices: [{ image_output: { amount: 0.2, unit: 'per_image' } }],
}

const seed3d: VolcengineModel = {
  id: 'doubao-seed3d-2-0',
  name: 'doubao-seed3d-2-0',
  source_kind: '3d',
  currency: 'CNY',
  capabilities: ['图生3D'],
  snapshots: ['doubao-seed3d-2-0-260328'],
  prices: [{ request: { amount: 2.4, unit: 'per_request' } }],
}

const embedVision: VolcengineModel = {
  id: 'doubao-embedding-vision',
  name: 'doubao-embedding-vision',
  source_kind: 'embedding',
  currency: 'CNY',
  capabilities: ['多模态向量化'],
  prices: [
    { input: { amount: 0.7, unit: 'per_1m_tokens' }, image_input: { amount: 1.8, unit: 'per_1m_tokens' } },
  ],
}

describe('volcengineModelFragment (text)', () => {
  const fragment = volcengineModelFragment(seedLite, {
    observedAt: '2026-05-30T00:00:00Z',
    sourceUrl: 'https://www.volcengine.com/docs/82379/1330310',
  })

  it('mints a low-confidence canonical fragment with derived facts', () => {
    expect(fragment.identityId).toBe('doubao-seed-2-0-lite')
    expect(fragment.facts.reasoning).toBe(true)
    expect(fragment.facts.tool_calling).toBe(true)
    expect(fragment.facts.author).toBe('bytedance')
    expect(fragment.facts.author_id).toBe('bytedance')
    expect(fragment.facts.input_modalities).toEqual(expect.arrayContaining(['text', 'image']))
    expect(fragment.facts.context_length).toBe(262144)
    expect(fragment.facts.max_input_tokens).toBe(229376)
    expect(fragment.facts.other_parameters).toMatchObject({
      source_confidence: 'low',
      max_reasoning_tokens: 32768,
    })
  })

  it('keeps dated snapshots as alias ids (folded, not canonical)', () => {
    expect(fragment.aliasIds).toEqual(
      expect.arrayContaining(['doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-lite-260215']),
    )
    expect(fragment.aliasIds).not.toContain('doubao-seed-2-0-lite')
  })

  it('emits a CNY offer with tiered prices + rate limits, no guessing', () => {
    expect(fragment.offer?.source).toBe('volcengine')
    expect(fragment.offer?.currency).toBe('CNY')
    expect(fragment.offer?.prices).toHaveLength(2)
    expect(fragment.offer?.prices?.[0]?.input).toEqual({ amount: 0.6, unit: 'per_1m_tokens' })
    expect(fragment.offer?.other_params).toEqual({ RPM: 30000, TPM: 5000000 })
    expect(fragment.offer?.url).toBe('https://www.volcengine.com/docs/82379/1330310')
    expect(fragment.offer?.observed_at).toBe('2026-05-30T00:00:00Z')
    expect(fragment.endpoint).toBe('chat')
  })
})

describe('volcengineModelFragment (media + embedding)', () => {
  it('maps image models to an images endpoint with per-image price', () => {
    const f = volcengineModelFragment(seedream)
    expect(f.facts.output_modalities).toEqual(['image'])
    expect(f.endpoint).toBe('images')
    expect(f.offer?.prices?.[0]?.image_output).toEqual({ amount: 0.2, unit: 'per_image' })
    expect(f.facts.author).toBe('bytedance')
  })

  it('maps 3D models to a 3d endpoint with per-request price', () => {
    const f = volcengineModelFragment(seed3d)
    expect(f.endpoint).toBe('3d')
    expect(f.facts.output_modalities).toEqual(['other'])
    expect(f.offer?.prices?.[0]?.request).toEqual({ amount: 2.4, unit: 'per_request' })
  })

  it('maps embedding models to an embeddings endpoint with token + image prices', () => {
    const f = volcengineModelFragment(embedVision)
    expect(f.endpoint).toBe('embeddings')
    expect(f.facts.output_modalities).toEqual(['embedding'])
    expect(f.facts.input_modalities).toEqual(expect.arrayContaining(['text', 'image']))
    expect(f.offer?.prices?.[0]?.input).toEqual({ amount: 0.7, unit: 'per_1m_tokens' })
    expect(f.offer?.prices?.[0]?.image_input).toEqual({ amount: 1.8, unit: 'per_1m_tokens' })
  })
})

describe('volcengineFragments', () => {
  it('maps a batch and skips records without an id', () => {
    const frags = volcengineFragments([seedLite, seedream, { id: '' } as VolcengineModel])
    expect(frags).toHaveLength(2)
    expect(frags.every((f) => f.source === 'volcengine')).toBe(true)
  })
})
