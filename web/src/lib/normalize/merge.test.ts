import { describe, expect, it } from 'vitest'
import { mergeGroup } from './merge.js'
import type { Offer, SourceFragment } from './schema.js'

const frag = (source: string, offer: Offer | null, identityId: string | null = null): SourceFragment => ({
  source,
  matchKey: 'm',
  identityId,
  aliasIds: [],
  aliasNames: [],
  facts: { model: 'M' },
  offer,
  provenance: null,
})

const priced = (source: string): Offer => ({ source, currency: 'USD', prices: [{ input: { amount: 1, unit: 'per_1m_tokens' } }] })

describe('mergeGroup offer assembly', () => {
  it('drops the LiteLLM offer when OpenRouter already prices the model', () => {
    const entry = mergeGroup([
      frag('openrouter', priced('openrouter'), 'm'),
      frag('litellm', priced('litellm')),
    ])
    expect(entry!.offers.map((o) => o.source)).toEqual(['openrouter'])
  })

  it('drops the Volcengine offer when Bailian already prices the model (CNY)', () => {
    const entry = mergeGroup([
      frag('bailian', priced('bailian'), 'm'),
      frag('volcengine', priced('volcengine')),
    ])
    expect(entry!.offers.map((o) => o.source)).toEqual(['bailian'])
  })

  it('keeps the Volcengine offer when Bailian has no priced offer', () => {
    const bailianUnpriced: Offer = { source: 'bailian', currency: 'CNY', prices: [] }
    const entry = mergeGroup([
      frag('bailian', bailianUnpriced, 'm'),
      frag('volcengine', priced('volcengine')),
    ])
    expect(entry!.offers.map((o) => o.source).sort()).toEqual(['bailian', 'volcengine'])
  })

  it('keeps the LiteLLM offer when OpenRouter has no priced offer', () => {
    const orUnpriced: Offer = { source: 'openrouter', currency: 'USD', prices: [] }
    const entry = mergeGroup([
      frag('openrouter', orUnpriced, 'm'),
      frag('litellm', priced('litellm')),
    ])
    expect(entry!.offers.map((o) => o.source).sort()).toEqual(['litellm', 'openrouter'])
  })

  it('keeps the LiteLLM offer when the model has no OpenRouter offer at all', () => {
    const entry = mergeGroup([frag('litellm', priced('litellm'), 'm')])
    expect(entry!.offers.map((o) => o.source)).toEqual(['litellm'])
  })
})
