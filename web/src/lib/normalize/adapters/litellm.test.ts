import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { authorFromLiteLLM, cleanLiteLLMId, liteLLMCanonicalEligible, liteLLMFragment, type LiteLLMModel } from './litellm.js'

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

describe('authorFromLiteLLM', () => {
  it('derives the developer from the id prefix, incl. bedrock/vertex/databricks-prefixed ids', () => {
    expect(authorFromLiteLLM('anthropic.claude-3-opus', 'bedrock')).toBe('anthropic')
    expect(authorFromLiteLLM('amazon.titan-embed-text-v1', 'bedrock')).toBe('amazon')
    expect(authorFromLiteLLM('us.anthropic.claude-opus-4-7', 'bedrock')).toBe('anthropic')
    expect(authorFromLiteLLM('databricks-claude-opus-4', 'databricks')).toBe('anthropic')
    expect(authorFromLiteLLM('codellama-70b', 'fireworks_ai')).toBe('meta-llama')
    expect(authorFromLiteLLM('codestral-2', 'mistral')).toBe('mistralai')
    expect(authorFromLiteLLM('grok-2', 'xai')).toBe('x-ai')
    expect(authorFromLiteLLM('flux-pro', 'fal_ai')).toBe('black-forest-labs')
    expect(authorFromLiteLLM('kimi-k2-0905-preview', 'moonshot')).toBe('moonshotai')
  })

  it('reads a vendor namespace prefix as the author even when the model part is opaque', () => {
    expect(authorFromLiteLLM('openai.gpt-5', 'azure')).toBe('openai')
    expect(authorFromLiteLLM('nvidia.nemotron-nano-9b-v2', 'bedrock')).toBe('nvidia')
    expect(authorFromLiteLLM('zai.glm-5', 'fireworks_ai')).toBe('z-ai')
    expect(authorFromLiteLLM('xai.grok-3', 'bedrock')).toBe('x-ai')
  })

  it('falls back to litellm_provider only when it is itself a developer (not a gateway)', () => {
    expect(authorFromLiteLLM('base', 'deepgram')).toBe('deepgram') // generic ASR name, dev via provider
    expect(authorFromLiteLLM('mystery-model', 'bedrock')).toBeNull() // gateway provider -> no guess
    expect(authorFromLiteLLM('some-thing', undefined)).toBeNull()
  })
})

describe('cleanLiteLLMId', () => {
  it('strips bedrock/vertex/databricks/region vendor namespace prefixes', () => {
    expect(cleanLiteLLMId('amazon.titan-embed-text-v1')).toBe('titan-embed-text-v1')
    expect(cleanLiteLLMId('anthropic.claude-opus-4-7')).toBe('claude-opus-4-7')
    expect(cleanLiteLLMId('us.anthropic.claude-opus-4-7')).toBe('claude-opus-4-7')
    expect(cleanLiteLLMId('databricks-claude-opus-4')).toBe('claude-opus-4')
    expect(cleanLiteLLMId('databricks-meta-llama-3-70b-instruct')).toBe('llama-3-70b-instruct')
    expect(cleanLiteLLMId('anthropic-claude-3-opus')).toBe('claude-3-opus')
    expect(cleanLiteLLMId('cohere.command-r-08-2024')).toBe('command-r-08-2024')
    expect(cleanLiteLLMId('qwen.qwen3-coder-next')).toBe('qwen3-coder-next')
  })

  it('does NOT strip a dash-vendor that is the model-name root', () => {
    expect(cleanLiteLLMId('mistral-7b-instruct-v0.1')).toBe('mistral-7b-instruct-v0.1')
    expect(cleanLiteLLMId('qwen-3-32b')).toBe('qwen-3-32b')
    expect(cleanLiteLLMId('deepseek-coder')).toBe('deepseek-coder')
    expect(cleanLiteLLMId('databricks-mistral-large')).toBe('mistral-large')
  })

  it('strips openai/xai/nvidia/zai namespaces but never a version dot', () => {
    expect(cleanLiteLLMId('openai.gpt-5')).toBe('gpt-5')
    expect(cleanLiteLLMId('xai.grok-3')).toBe('grok-3')
    expect(cleanLiteLLMId('nvidia.nemotron-nano-9b-v2')).toBe('nemotron-nano-9b-v2')
    expect(cleanLiteLLMId('zai.glm-5')).toBe('glm-5')
    // version dots must survive (qwen3.5, llama3.1, wan2.2, sd3.5, flux.2 are NOT vendor prefixes)
    expect(cleanLiteLLMId('qwen3.5-27b')).toBe('qwen3.5-27b')
    expect(cleanLiteLLMId('llama3.1-405b')).toBe('llama3.1-405b')
    expect(cleanLiteLLMId('wan2.2-i2v-flash')).toBe('wan2.2-i2v-flash')
    expect(cleanLiteLLMId('sd3.5-large')).toBe('sd3.5-large')
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
