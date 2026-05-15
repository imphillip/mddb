import { describe, expect, it } from 'vitest'
import { buildBaseLlmEnrichmentFromNewApiModels } from './basellm-gallery.js'
import { overlayBaseLlmEnrichment } from './basellm-overlay.js'
import type { OpenRouterGallery } from './openrouter-gallery.js'

function makeOpenRouterGallery(): OpenRouterGallery {
  return {
    models: [
      {
        tag: 'gemini-2-5-pro',
        route: '/models/gemini-2-5-pro',
        name: 'Gemini 2.5 Pro',
        brand: { slug: 'google', name: 'Google', description: 'Google models' },
        description: 'OpenRouter canonical Gemini row',
        modalities: ['文本'],
        contextWindow: '1,000,000',
        inputPrice: '$1.25 / 1M',
        outputPrice: '$10 / 1M',
        providerNames: ['OpenRouter'],
        variantCount: 1,
        weeklyTokens: '—',
        releasedAt: '2025-06-01',
      },
    ],
    details: [
      {
        tag: 'gemini-2-5-pro',
        route: '/models/gemini-2-5-pro',
        name: 'Gemini 2.5 Pro',
        brand: { slug: 'google', name: 'Google', description: 'Google models' },
        description: 'OpenRouter canonical Gemini row',
        longDescription: 'OpenRouter canonical Gemini row',
        modalities: ['文本'],
        contextWindow: '1,000,000',
        inputPrice: '$1.25 / 1M',
        outputPrice: '$10 / 1M',
        providerNames: ['OpenRouter'],
        variantCount: 1,
        weeklyTokens: '—',
        releasedAt: '2025-06-01',
        apiIdentifier: 'google/gemini-2.5-pro',
        variants: [
          {
            id: 'openrouter-default',
            name: 'OpenRouter default',
            summary: 'Canonical OpenRouter pricing',
            contextWindow: '1,000,000',
            inputPrice: '$1.25 / 1M',
            outputPrice: '$10 / 1M',
            differences: ['OpenRouter canonical'],
            providers: [{ slug: 'openrouter', name: 'OpenRouter', region: 'global', uptime: '—', latency: '—', throughput: '—' }],
          },
        ],
        benchmarks: [],
        meta: [],
        officialPriceSets: [],
      },
    ],
    brands: [{ slug: 'google', name: 'Google', description: 'Google models', models: [] }],
    stats: { modelCount: 1, brandCount: 1, providerCount: 1, variantCount: 1 },
    source: { source: 'openrouter', path: 'data/openrouter-models.json', modelRows: 1, floatingAliasRows: 0, skippedRows: 0 },
  }
}

describe('overlayBaseLlmEnrichment', () => {
  it('adds BaseLLM pricing variants to matched canonical models without replacing OpenRouter prices', () => {
    const enrichment = buildBaseLlmEnrichmentFromNewApiModels([
      { model_name: 'gemini-2.5-pro', vendor_name: 'AIHubMix', tags: '1M', price_per_m_input: 1.25, price_per_m_output: 10, ratio_model: 0.625, ratio_completion: 8 },
      { model_name: 'gemini-2.5-pro', vendor_name: 'GitHub Copilot', tags: '128K' },
    ])

    const gallery = overlayBaseLlmEnrichment(makeOpenRouterGallery(), enrichment)
    const detail = gallery.details[0]!

    expect(detail.inputPrice).toBe('$1.25 / 1M')
    expect(detail.variants.map((variant) => variant.id)).toEqual(['openrouter-default', 'basellm:aihubmix:token:1,000,000', 'basellm:github-copilot:unknown:128,000'])
    expect(detail.meta).toContainEqual({ label: 'BaseLLM pricing variants', value: '2' })
    expect(gallery.source.basellm).toMatchObject({ modelRows: 2, matchedRows: 1, variantRows: 2 })
  })
})
