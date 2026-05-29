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

const priced = (source: string): Offer => ({ source, currency: 'USD', endpoints: 'chat', prices: [{ input: { amount: 1, unit: 'per_1m_tokens' } }] })

describe('mergeGroup offer assembly', () => {
  it('drops the LiteLLM offer when OpenRouter already prices the model', () => {
    const entry = mergeGroup([
      frag('openrouter', priced('openrouter'), 'm'),
      frag('litellm', priced('litellm')),
    ])
    expect(entry!.offers.map((o) => o.source)).toEqual(['openrouter'])
  })

  it('keeps the LiteLLM offer when OpenRouter has no priced offer', () => {
    const orUnpriced: Offer = { source: 'openrouter', currency: 'USD', endpoints: 'chat', prices: [] }
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
