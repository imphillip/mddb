import { describe, expect, it } from 'vitest'
import type { OpenRouterGallery } from './openrouter-gallery.js'
import type { ModelsDevGallery } from './models-dev-gallery.js'
import { buildModelsDevEnrichment, overlayModelsDevEnrichment } from './model-gallery-enrichment.js'

const openRouterGallery: OpenRouterGallery = {
  brands: [
    { slug: 'openai', name: 'OpenAI', description: 'OpenAI models.', models: [] },
    { slug: 'writer', name: 'Writer', description: 'Writer models.', models: [] },
  ],
  models: [],
  details: [
    {
      tag: 'gpt-4o',
      route: '/gpt-4o',
      name: 'GPT-4o',
      brand: { slug: 'openai', name: 'OpenAI', description: 'OpenAI models.' },
      description: 'OpenRouter primary GPT-4o row.',
      longDescription: 'OpenRouter primary GPT-4o detail.',
      modalities: ['文本'],
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
          summary: 'OpenRouter standard record.',
          contextWindow: '128,000',
          inputPrice: '$2.5 / 1M',
          outputPrice: '$10 / 1M',
          differences: ['OpenRouter id openai/gpt-4o'],
          providers: [{ slug: 'openai', name: 'OpenAI', region: 'OpenRouter', uptime: '—', latency: '—', throughput: '—' }],
        },
      ],
      benchmarks: [],
      meta: [{ label: 'Source', value: 'openrouter' }],
      officialPriceSets: [],
    },
    {
      tag: 'palmyra-x5',
      route: '/palmyra-x5',
      name: 'Palmyra X5',
      brand: { slug: 'writer', name: 'Writer', description: 'Writer models.' },
      description: 'OpenRouter primary Palmyra row.',
      longDescription: 'OpenRouter primary Palmyra detail.',
      modalities: ['文本'],
      contextWindow: '128,000',
      inputPrice: '$0 / 1M',
      outputPrice: '$0 / 1M',
      providerNames: ['Writer'],
      variantCount: 1,
      weeklyTokens: '—',
      releasedAt: '2025-01-01',
      apiIdentifier: 'writer/palmyra-x5',
      variants: [
        {
          id: 'palmyra-x5',
          name: 'Palmyra X5',
          summary: 'OpenRouter standard record.',
          contextWindow: '128,000',
          inputPrice: '$0 / 1M',
          outputPrice: '$0 / 1M',
          differences: ['OpenRouter id writer/palmyra-x5'],
          providers: [{ slug: 'writer', name: 'Writer', region: 'OpenRouter', uptime: '—', latency: '—', throughput: '—' }],
        },
      ],
      benchmarks: [],
      meta: [{ label: 'Source', value: 'openrouter' }],
      officialPriceSets: [],
    },
  ],
  source: { source: 'openrouter', path: 'data/openrouter-models.json', modelRows: 2, floatingAliasRows: 0, skippedRows: 0 },
  stats: { modelCount: 2, brandCount: 2, providerCount: 2, variantCount: 2 },
}

const modelsDevGallery: ModelsDevGallery = {
  brands: [
    { slug: 'openai', name: 'OpenAI', description: 'OpenAI models.', logoUrl: 'https://models.dev/logos/openai.svg', models: [] },
    { slug: 'azure', name: 'Azure AI Foundry', description: 'Azure provider.', logoUrl: 'https://models.dev/logos/azure.svg', models: [] },
    { slug: 'writer', name: 'Writer', description: 'Writer models.', logoUrl: 'https://models.dev/logos/writer.svg', models: [] },
    { slug: 'liquid-ai', name: 'Liquid AI', description: 'Liquid AI models.', logoUrl: 'https://models.dev/logos/liquid.svg', models: [] },
  ],
  models: [],
  details: [
    {
      tag: 'gpt-4o',
      route: '/gpt-4o',
      name: 'GPT-4o',
      brand: { slug: 'openai', name: 'OpenAI', description: 'OpenAI models.', logoUrl: 'https://models.dev/logos/openai.svg' },
      description: 'models.dev GPT-4o row.',
      longDescription: 'models.dev GPT-4o detail.',
      modalities: ['文本', '视觉', '工具'],
      contextWindow: '—',
      inputPrice: '—',
      outputPrice: '—',
      providerNames: ['Azure AI Foundry', 'OpenAI'],
      variantCount: 2,
      weeklyTokens: '—',
      releasedAt: '2024-05-13',
      apiIdentifier: 'gpt-4o',
      variants: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          summary: 'same model on 2 providers.',
          contextWindow: '—',
          inputPrice: '—',
          outputPrice: '—',
          differences: ['models.dev id gpt-4o'],
          providers: [
            { slug: 'openai', name: 'OpenAI', logoUrl: 'https://models.dev/logos/openai.svg', region: '—', uptime: '—', latency: '—', throughput: '—' },
            { slug: 'azure', name: 'Azure AI Foundry', logoUrl: 'https://models.dev/logos/azure.svg', region: '—', uptime: '—', latency: '—', throughput: '—' },
          ],
        },
      ],
      benchmarks: [],
      meta: [{ label: 'Source', value: 'models.dev' }],
      officialPriceSets: [],
    },
    {
      tag: 'lfm-40b',
      route: '/lfm-40b',
      name: 'LFM 40B',
      brand: { slug: 'liquid-ai', name: 'Liquid AI', description: 'Liquid AI models.', logoUrl: 'https://models.dev/logos/liquid.svg' },
      description: 'Independent Liquid AI model.',
      longDescription: 'Independent Liquid AI model detail.',
      modalities: ['文本'],
      contextWindow: '—',
      inputPrice: '—',
      outputPrice: '—',
      providerNames: ['Liquid AI'],
      variantCount: 1,
      weeklyTokens: '—',
      releasedAt: '2024-12-01',
      apiIdentifier: 'lfm-40b',
      variants: [],
      benchmarks: [],
      meta: [{ label: 'Source', value: 'models.dev' }],
      officialPriceSets: [],
    },
    {
      tag: 'gpt-4o-mini-copy',
      route: '/gpt-4o-mini-copy',
      name: 'GPT-4o Mini Copy',
      brand: { slug: 'other', name: 'Other', description: 'Provider wrapper.' },
      description: 'Provider wrapper alias.',
      longDescription: 'Provider wrapper alias detail.',
      modalities: ['文本'],
      contextWindow: '—',
      inputPrice: '—',
      outputPrice: '—',
      providerNames: ['Acme Gateway'],
      variantCount: 1,
      weeklyTokens: '—',
      releasedAt: '2024-12-02',
      apiIdentifier: 'gpt-4o-mini-copy',
      variants: [],
      benchmarks: [],
      meta: [{ label: 'Source', value: 'models.dev' }],
      officialPriceSets: [],
    },
  ],
  source: { path: 'data/models-dev-api.json', modelRows: 3, providerRows: 4 },
  stats: { modelCount: 3, brandCount: 4, providerCount: 4, variantCount: 3 },
}

describe('buildModelsDevEnrichment', () => {
  it('separates provider/logo enrichment from independent model candidates', () => {
    const enrichment = buildModelsDevEnrichment(openRouterGallery, modelsDevGallery)

    expect(enrichment.matched.get('gpt-4o')).toMatchObject({
      providerNames: ['Azure AI Foundry', 'OpenAI'],
      brandLogoUrl: 'https://models.dev/logos/openai.svg',
    })
    expect(enrichment.brandLogos.get('writer')).toBe('https://models.dev/logos/writer.svg')
    expect(enrichment.independentCandidates.map((candidate) => candidate.tag)).toEqual(['lfm-40b'])
    expect(enrichment.rejectedCandidates.map((candidate) => candidate.tag)).toEqual(['gpt-4o-mini-copy'])
  })
})

describe('overlayModelsDevEnrichment', () => {
  it('adds provider observations and logos without adding models.dev-only candidates to the canonical gallery', () => {
    const enriched = overlayModelsDevEnrichment(openRouterGallery, modelsDevGallery)

    const gpt4o = enriched.details.find((model) => model.tag === 'gpt-4o')
    expect(gpt4o?.brand.logoUrl).toBe('https://models.dev/logos/openai.svg')
    expect(gpt4o?.providerNames).toEqual(['Azure AI Foundry', 'OpenAI'])
    expect(gpt4o?.variants[1]).toMatchObject({
      id: 'models-dev-provider-observations',
      summary: 'models.dev 收录到 2 个 provider 部署，可作为 OpenRouter 之外的 availability 观察。',
    })
    expect(gpt4o?.meta).toContainEqual({ label: 'models.dev providers', value: ['Azure AI Foundry', 'OpenAI'] })

    const palmyra = enriched.details.find((model) => model.tag === 'palmyra-x5')
    expect(palmyra?.brand.logoUrl).toBe('https://models.dev/logos/writer.svg')

    expect(enriched.details.map((model) => model.tag)).toEqual(['gpt-4o', 'palmyra-x5'])
    expect(enriched.models.map((model) => model.tag)).toEqual(['gpt-4o', 'palmyra-x5'])
    expect(enriched.source.modelsDev.independentCandidateRows).toBe(1)
    expect(enriched.source.modelsDev.rejectedCandidateRows).toBe(1)
  })
})
