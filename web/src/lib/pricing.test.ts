import { describe, expect, it } from 'vitest'
import { annotatePriceSetConditions, detectUnexplainedPriceConflicts, parseOpenRouterOfficialPriceSet, summarizeTokenPrice } from './pricing.js'

describe('pricing facts', () => {
  it('converts OpenRouter per-token prices to per-1M official token components', () => {
    const priceSet = parseOpenRouterOfficialPriceSet({
      modelTag: 'gpt-4o',
      sourceModelKey: 'openai/gpt-4o',
      sourceProvider: 'openai',
      pricing: { prompt: '0.0000025', completion: '0.00001', input_cache_read: '0.000001' },
    })

    expect(priceSet.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'token', scope: 'input', amount: 2.5, unit: '1m_tokens', sourceField: 'prompt' }),
        expect.objectContaining({ mode: 'token', scope: 'output', amount: 10, unit: '1m_tokens', sourceField: 'completion' }),
        expect.objectContaining({ mode: 'token', scope: 'cache_read', amount: 1, unit: '1m_tokens', sourceField: 'input_cache_read' }),
      ]),
    )
    expect(summarizeTokenPrice(priceSet.components, 'input')).toBe('$2.5 / 1M')
  })

  it('preserves non-token OpenRouter pricing modes as official price components', () => {
    const priceSet = parseOpenRouterOfficialPriceSet({
      modelTag: 'multi-modal-model',
      sourceModelKey: 'example/multi-modal-model',
      sourceProvider: 'example',
      pricing: {
        prompt: '0.000001',
        request: '0.002',
        image: '0.004',
        image_output: '0.01',
        audio: '0.0002',
        audio_output: '0.0004',
        input_audio_cache: '0.00002',
        internal_reasoning: '0.000003',
        web_search: '0.01',
        discount: 0.5,
      },
    })

    expect(priceSet.rawPricing).toMatchObject({ request: '0.002', image: '0.004', discount: 0.5 })
    expect(priceSet.warnings).toContain('discount-preserved-not-applied')
    expect(priceSet.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: 'request', scope: 'request', amount: 0.002, unit: 'request' }),
        expect.objectContaining({ mode: 'image', scope: 'image_input', amount: 0.004, unit: 'image' }),
        expect.objectContaining({ mode: 'image', scope: 'image_output', amount: 0.01, unit: 'image' }),
        expect.objectContaining({ mode: 'audio', scope: 'audio_input', amount: 0.0002, unit: 'unit' }),
        expect.objectContaining({ mode: 'audio', scope: 'audio_output', amount: 0.0004, unit: 'unit' }),
        expect.objectContaining({ mode: 'audio', scope: 'audio_cache', amount: 0.00002, unit: 'unit' }),
        expect.objectContaining({ mode: 'reasoning', scope: 'internal_reasoning', amount: 3, unit: '1m_tokens' }),
        expect.objectContaining({ mode: 'web_search', scope: 'web_search', amount: 0.01, unit: 'request' }),
      ]),
    )
  })

  it('flags unexplained same-tag same-mode price conflicts when conditions do not differ', () => {
    const first = parseOpenRouterOfficialPriceSet({ modelTag: 'same-model', sourceModelKey: 'a/same-model', sourceProvider: 'a', pricing: { prompt: '0.000001' } })
    const second = parseOpenRouterOfficialPriceSet({ modelTag: 'same-model', sourceModelKey: 'b/same-model', sourceProvider: 'b', pricing: { prompt: '0.000002' } })

    expect(detectUnexplainedPriceConflicts([first, second])).toEqual(['unexplained-price-conflict:same-model:token:input'])
  })

  it('does not flag same-tag price differences explained by context length conditions', () => {
    const shortContext = parseOpenRouterOfficialPriceSet({ modelTag: 'context-priced-model', sourceModelKey: 'provider/context-priced-model-128k', sourceProvider: 'provider', pricing: { prompt: '0.000001' } })
    const longContext = parseOpenRouterOfficialPriceSet({ modelTag: 'context-priced-model', sourceModelKey: 'provider/context-priced-model-1m', sourceProvider: 'provider', pricing: { prompt: '0.000002' } })
    const annotated = annotatePriceSetConditions([
      { priceSet: shortContext, contextLength: 128000 },
      { priceSet: longContext, contextLength: 1000000 },
    ])

    expect(annotated[0]?.components[0]?.conditions).toEqual([{ key: 'context_length', value: '128000' }])
    expect(annotated[1]?.components[0]?.conditions).toEqual([{ key: 'context_length', value: '1000000' }])
    expect(detectUnexplainedPriceConflicts(annotated)).toEqual([])
  })

  it('excludes free route prices from official price components while preserving raw observations', () => {
    const free = parseOpenRouterOfficialPriceSet({ modelTag: 'free-tier-model', sourceModelKey: 'provider/free-tier-model:free', sourceProvider: 'provider', pricing: { prompt: '0', completion: '0' } })
    const paid = parseOpenRouterOfficialPriceSet({ modelTag: 'free-tier-model', sourceModelKey: 'provider/free-tier-model', sourceProvider: 'provider', pricing: { prompt: '0.000001', completion: '0.000002' } })
    const annotated = annotatePriceSetConditions([
      { priceSet: free, contextLength: 128000 },
      { priceSet: paid, contextLength: 128000 },
    ])

    expect(free.components).toEqual([])
    expect(free.rawPricing).toEqual({ prompt: '0', completion: '0' })
    expect(free.warnings).toContain('free-tier-preserved-not-official-price')
    expect(annotated[0]?.components).toEqual([])
    expect(annotated[1]?.components[0]?.conditions).toEqual([])
    expect(detectUnexplainedPriceConflicts(annotated)).toEqual([])
  })
})
