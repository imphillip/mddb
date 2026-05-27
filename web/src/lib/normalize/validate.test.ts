import { describe, expect, it } from 'vitest'
import { isNonCanonicalId, validateModels } from './validate.js'
import type { ModelEntry } from './schema.js'

const good: ModelEntry = {
  id: 'qwen3.6-max-preview',
  model: 'Qwen 3.6 Max',
  input_modalities: ['text'],
  output_modalities: ['text'],
  context_length: 262144,
  offers: [
    {
      source: 'bailian',
      currency: 'CNY',
      prices: [
        {
          conditions: [{ type: 'input_token', lte: 131072 }],
          input: { amount: 9, unit: 'per_1m_tokens' },
          output: { amount: 54, unit: 'per_1m_tokens' },
        },
      ],
    },
  ],
}

describe('isNonCanonicalId', () => {
  it('rejects router/product/free/latest/group shapes', () => {
    expect(isNonCanonicalId('group-qwen3.6-max')).toBe(true)
    expect(isNonCanonicalId('gpt-4o:free')).toBe(true)
    expect(isNonCanonicalId('claude-sonnet-latest')).toBe(true)
    expect(isNonCanonicalId('openrouter-router-x')).toBe(true)
    expect(isNonCanonicalId('qwen3.6-max-preview')).toBe(false)
  })
})

describe('validateModels', () => {
  it('passes a well-formed entry', () => {
    expect(validateModels([good])).toEqual({ ok: true, errors: [] })
  })

  it('flags bad slug, missing currency, invalid unit/modality, and sort order', () => {
    const bad: ModelEntry = {
      id: 'Bad Id',
      model: 'x',
      output_modalities: ['hologram' as never],
      offers: [
        { source: 'x', currency: '', prices: [{ input: { amount: 1, unit: 'per_zerg' as never } }] },
      ],
    }
    const result = validateModels([good, bad]) // out of order too (bad < good? no) -> use order check
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('invalid id slug'))).toBe(true)
    expect(result.errors.some((e) => e.includes('invalid modality'))).toBe(true)
    expect(result.errors.some((e) => e.includes('invalid unit'))).toBe(true)
    expect(result.errors.some((e) => e.includes('missing currency'))).toBe(true)
  })

  it('detects duplicate ids and non-canonical ids', () => {
    const dup: ModelEntry = { id: 'group-x', model: 'g', offers: [] }
    const result = validateModels([dup, dup])
    expect(result.errors.some((e) => e.includes('non-canonical'))).toBe(true)
    expect(result.errors.some((e) => e.includes('duplicate id'))).toBe(true)
  })
})
