import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { liteLLMCanonicalEligible, liteLLMFragment, type LiteLLMModel } from './litellm.js'

const load = (name: string): LiteLLMModel =>
  JSON.parse(readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8')) as LiteLLMModel

describe('liteLLMCanonicalEligible', () => {
  it('accepts clean model-shaped ids', () => {
    expect(liteLLMCanonicalEligible('gpt-4o')).toBe(true)
    expect(liteLLMCanonicalEligible('azure/gpt-4o')).toBe(true)
  })
  it('rejects arn/config/gateway-shaped keys', () => {
    expect(liteLLMCanonicalEligible('bedrock/amazon.nova-canvas-v1:0')).toBe(false)
    expect(liteLLMCanonicalEligible('1024-x-1024/50-steps/bedrock/amazon.nova-canvas-v1:0')).toBe(false)
  })
})

describe('liteLLM chat fragment', () => {
  const fragment = liteLLMFragment(load('litellm-chat.json'), { observedAt: '2026-05-26T00:00:00Z' })

  it('maps token prices (per-token -> per 1M) including cache tiers', () => {
    const price = fragment.offer?.prices[0]
    expect(price?.input).toEqual({ amount: 1, unit: 'per_1m_tokens' })
    expect(price?.output).toEqual({ amount: 5, unit: 'per_1m_tokens' })
    expect(price?.cache_write).toEqual({ amount: 1.25, unit: 'per_1m_tokens' })
    expect(price?.cache_read).toEqual({ amount: 0.1, unit: 'per_1m_tokens' })
  })
  it('derives chat facts and endpoint', () => {
    expect(fragment.facts.tool_calling).toBe(true)
    expect(fragment.facts.output_modalities).toEqual(['text'])
    expect(fragment.facts.context_length).toBe(200000)
    expect(fragment.facts.max_output_tokens).toBe(64000)
    expect(fragment.endpoint).toBe('chat')
  })
  it('buckets non-token cost tiers into other_params (never dropped)', () => {
    expect(fragment.offer?.other_params).toMatchObject({
      litellm_provider: 'bedrock_converse',
      mode: 'chat',
      cache_creation_input_token_cost_above_1hr: 2e-6,
    })
  })
})

describe('liteLLM embedding fragment', () => {
  const fragment = liteLLMFragment(load('litellm-embedding.json'))

  it('classifies output modality as embedding and routes the endpoint', () => {
    expect(fragment.facts.output_modalities).toEqual(['embedding'])
    expect(fragment.endpoint).toBe('embeddings')
  })
  it('maps per-image cost into a price component (not bucketed in other_params)', () => {
    expect(fragment.facts.other_parameters).toEqual({ output_vector_size: 1024 })
    expect(fragment.offer?.prices[0]?.image_input).toEqual({ amount: 6e-5, unit: 'per_image' })
    expect(fragment.offer?.prices[0]?.input).toEqual({ amount: 0.8, unit: 'per_1m_tokens' })
    expect(fragment.offer?.other_params).not.toHaveProperty('input_cost_per_image')
  })
})

describe('liteLLM fragment: zero costs are not prices', () => {
  it('omits an amount:0 component (e.g. embedding output cost) but keeps real ones', () => {
    const f = liteLLMFragment({
      model_name: 'amazon.titan-embed-text-v1',
      mode: 'embedding',
      input_cost_per_token: 1e-7,
      output_cost_per_token: 0,
    } as unknown as LiteLLMModel)
    expect(f.offer?.prices).toEqual([{ input: { amount: 0.1, unit: 'per_1m_tokens' } }])
    expect(f.offer?.prices[0]).not.toHaveProperty('output')
  })
})
