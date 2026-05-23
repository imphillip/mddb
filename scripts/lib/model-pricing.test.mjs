import { describe, expect, it } from 'vitest'
import { isCommercialPrice, normalizeModelPrice, priceDetailScore, selectBestPrice } from './model-pricing.mjs'

describe('model pricing helpers', () => {
  it('scores prices by unit coverage and tier or condition detail', () => {
    const simple = {
      currency: 'USD',
      unit_prices: {
        input: { amount: 3, unit: 'per_1m_tokens' },
        output: { amount: 15, unit: 'per_1m_tokens' },
      },
    }
    const tiered = {
      currency: 'USD',
      unit_prices: {
        input: { amount: 3, unit: 'per_1m_tokens' },
        output: { amount: 15, unit: 'per_1m_tokens' },
        input_batch: { amount: 1.5, unit: 'per_1m_tokens', condition: 'batch requests' },
      },
    }

    expect(priceDetailScore(tiered)).toBeGreaterThan(priceDetailScore(simple))
  })

  it('selects LiteLLM pricing when it carries more detailed tier conditions', () => {
    const openrouter = {
      source: 'openrouter',
      currency: 'USD',
      unit_prices: {
        input: { amount: 3, unit: 'per_1m_tokens' },
        output: { amount: 15, unit: 'per_1m_tokens' },
      },
      endpoint: { provider_id: 'openai', provider_name: 'OpenAI' },
    }
    const litellm = {
      source: 'litellm',
      currency: 'USD',
      unit_prices: {
        input: { amount: 3, unit: 'per_1m_tokens' },
        output: { amount: 15, unit: 'per_1m_tokens' },
        input_above_128k_tokens: { amount: 6, unit: 'per_1m_tokens', condition: 'above 128k tokens' },
      },
      endpoint: { provider_id: 'openai', provider_name: 'OpenAI' },
    }

    expect(selectBestPrice(openrouter, litellm)).toEqual(litellm)
  })

  it('does not choose free or promotional routes over commercial prices', () => {
    const commercial = {
      source: 'openrouter',
      currency: 'USD',
      unit_prices: { input: { amount: 1, unit: 'per_1m_tokens' } },
      endpoint: { provider_id: 'author', provider_name: 'Author' },
    }
    const free = {
      source: 'litellm',
      currency: 'USD',
      source_id: 'author/model:free',
      unit_prices: { input: { amount: 0, unit: 'per_1m_tokens' } },
      endpoint: { provider_id: 'author', provider_name: 'Author' },
    }

    expect(isCommercialPrice(free)).toBe(false)
    expect(selectBestPrice(commercial, free)).toEqual(commercial)
  })

  it('normalizes currency and preserves endpoint attribution', () => {
    const normalized = normalizeModelPrice({
      source: 'openrouter',
      currency: 'usd',
      unit_prices: { input: { amount: '3', unit: 'per_1m_tokens' } },
      endpoint: { provider_id: 'openai', provider_name: 'OpenAI', api_model_id: 'gpt-5' },
    })

    expect(normalized).toEqual({
      source: 'openrouter',
      currency: 'USD',
      unit_prices: { input: { amount: 3, unit: 'per_1m_tokens' } },
      endpoint: { provider_id: 'openai', provider_name: 'OpenAI', api_model_id: 'gpt-5' },
    })
  })
})
