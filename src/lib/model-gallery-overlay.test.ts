import { describe, expect, it } from 'vitest'
import type { ModelDetail } from './model-catalog.js'
import { overlayModelsDevGallery } from './model-gallery-overlay.js'
import type { ModelsDevGallery } from './models-dev-gallery.js'
import type { OpenRouterGallery } from './openrouter-gallery.js'

const brand = { slug: 'openai', name: 'OpenAI', description: 'OpenAI models' }

function detail(overrides: Partial<ModelDetail> = {}): ModelDetail {
  return {
    tag: 'gpt-4o',
    route: '/models/gpt-4o',
    name: 'GPT-4o',
    brand,
    description: 'OpenRouter primary description',
    longDescription: 'OpenRouter primary long description.',
    modalities: ['文本', '视觉'],
    contextWindow: '128,000',
    inputPrice: '$2.5 / 1M',
    outputPrice: '$10 / 1M',
    providerNames: ['OpenAI'],
    variantCount: 1,
    weeklyTokens: '—',
    releasedAt: '2024-05-13',
    apiIdentifier: 'openai/gpt-4o',
    variants: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        summary: 'OpenRouter record',
        contextWindow: '128,000',
        inputPrice: '$2.5 / 1M',
        outputPrice: '$10 / 1M',
        differences: ['OpenRouter id openai/gpt-4o'],
        providers: [{ slug: 'openai', name: 'OpenAI', region: 'OpenRouter', uptime: '—', latency: '—', throughput: '—' }],
      },
    ],
    benchmarks: [],
    meta: [{ label: 'Source', value: 'openrouter' }],
    ...overrides,
  }
}

describe('overlayModelsDevGallery', () => {
  it('keeps OpenRouter as primary data and overlays matched models.dev providers/provenance', () => {
    const openRouterDetail = detail()
    const openRouterGallery: OpenRouterGallery = {
      brands: [{ ...brand, models: [openRouterDetail] }],
      models: [openRouterDetail],
      details: [openRouterDetail],
      stats: { modelCount: 1, brandCount: 1, providerCount: 1, variantCount: 1 },
      source: { source: 'openrouter', path: 'data/openrouter-models.json', modelRows: 1, floatingAliasRows: 0, skippedRows: 0 },
    }
    const modelsDevDetail = detail({
      providerNames: ['Azure AI Foundry', 'OpenAI'],
      modalities: ['文本', '视觉', '工具'],
      inputPrice: '—',
      outputPrice: '—',
      variants: [
        {
          id: 'gpt-4o-2024-08-06',
          name: 'GPT-4o 2024 08 06',
          summary: 'models.dev snapshot',
          contextWindow: '—',
          inputPrice: '—',
          outputPrice: '—',
          differences: ['snapshot 2024-08-06'],
          providers: [{ slug: 'azure', name: 'Azure AI Foundry', logoUrl: 'https://models.dev/logos/azure.svg', region: '—', uptime: '—', latency: '—', throughput: '—' }],
        },
      ],
      meta: [
        { label: 'Source model ids', value: ['gpt-4o-2024-08-06'] },
        { label: 'Source provider ids', value: ['azure'] },
        { label: 'Updated dates', value: ['2024-08-06'] },
      ],
    })
    const modelsDevGallery: ModelsDevGallery = {
      brands: [{ ...brand, models: [modelsDevDetail] }],
      models: [modelsDevDetail],
      details: [modelsDevDetail],
      stats: { modelCount: 1, brandCount: 1, providerCount: 2, variantCount: 1 },
      source: { path: 'data/models-dev-api.json', modelRows: 1, providerRows: 1 },
    }

    const overlay = overlayModelsDevGallery(openRouterGallery, modelsDevGallery)
    const overlaid = overlay.details[0]!

    expect(overlay.stats.modelCount).toBe(1)
    expect(overlay.source.modelsDev).toMatchObject({ matchedModels: 1, unmatchedModels: 0, addedProviderDeployments: 1 })
    expect(overlaid.inputPrice).toBe('$2.5 / 1M')
    expect(overlaid.providerNames).toEqual(['Azure AI Foundry', 'OpenAI'])
    expect(overlaid.modalities).toEqual(['工具', '文本', '视觉'])
    expect(overlaid.variants.map((variant) => variant.id)).toEqual(['gpt-4o', 'models-dev-observations'])
    expect(overlaid.variants[1]?.providers).toContainEqual({ slug: 'azure', name: 'Azure AI Foundry', logoUrl: 'https://models.dev/logos/azure.svg', region: '—', uptime: '—', latency: '—', throughput: '—' })
    expect(overlaid.meta).toContainEqual({ label: 'models.dev matched', value: 'yes' })
    expect(overlaid.meta).toContainEqual({ label: 'models.dev source ids', value: ['gpt-4o-2024-08-06'] })
  })
})
