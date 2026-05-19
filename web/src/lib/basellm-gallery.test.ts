import { describe, expect, it } from 'vitest'
import { buildBaseLlmEnrichmentFromNewApiModels, ratioToUsdPerMillion } from './basellm-gallery.js'

describe('BaseLLM / NewAPI enrichment', () => {
  it('converts NewAPI ratios to USD per 1M tokens using the 500k tokens = $1 rule', () => {
    expect(ratioToUsdPerMillion(2)).toBe(4)
    expect(ratioToUsdPerMillion(0.5)).toBe(1)
  })

  it('groups same model ids into pricing variants instead of overwriting token/unit/context differences', () => {
    const enrichment = buildBaseLlmEnrichmentFromNewApiModels([
      {
        model_name: 'gemini-2.5-pro',
        vendor_name: 'AIHubMix',
        description: 'Gemini via AIHubMix',
        tags: 'Tools,Files,Vision,1M',
        price_per_m_input: 1.25,
        price_per_m_output: 10,
        ratio_model: 0.625,
        ratio_completion: 8,
        ratio_cache: 0.25,
        price_per_m_cache_read: 0.3125,
        price_per_m_cache_write: null,
      },
      {
        model_name: 'gemini-2.5-pro',
        vendor_name: 'GitHub Copilot',
        description: 'Gemini via GitHub Copilot with shorter context',
        tags: 'Tools,Files,Vision,128K',
        price_per_m_input: null,
        price_per_m_output: null,
        ratio_model: null,
        ratio_completion: null,
        ratio_cache: null,
      },
      {
        model_name: 'qwen-image',
        vendor_name: 'Alibaba',
        description: 'Qwen image generation charged per call',
        tags: 'Vision,Image',
        model_price: 0.25,
      },
    ])

    expect(enrichment.stats).toEqual({ modelRows: 3, modelCount: 2, variantCount: 3, unitPricedRows: 1 })

    const gemini = enrichment.models.get('gemini-2-5-pro')
    expect(gemini?.variants).toHaveLength(2)
    expect(gemini?.variants[0]).toMatchObject({
      sourceModelId: 'gemini-2.5-pro',
      providerName: 'AIHubMix',
      billingKind: 'token',
      contextWindow: '1,000,000',
      pricePerMillionInput: 1.25,
      pricePerMillionOutput: 10,
      ratioModel: 0.625,
      ratioCompletion: 8,
      derivedInputPriceFromRatio: 1.25,
      derivedOutputPriceFromRatio: 10,
    })
    expect(gemini?.variants[1]).toMatchObject({
      providerName: 'GitHub Copilot',
      billingKind: 'unknown',
      contextWindow: '128,000',
    })

    const image = enrichment.models.get('qwen-image')
    expect(image?.variants).toEqual([
      expect.objectContaining({
        providerName: 'Alibaba',
        billingKind: 'unit',
        unitPrice: 0.25,
        unitPriceLabel: '$0.25 / request',
      }),
    ])
  })
})
