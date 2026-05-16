import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'
import { renderOpenRouterRawDetail, renderOpenRouterRawHome } from './openrouter-raw-renderer.js'

function sourceNode(sourceId: string, author: string): OpenRouterRawNode {
  const [, modelId = sourceId] = sourceId.split('/')
  return {
    id: `openrouter-source:${sourceId}`,
    nodeKind: 'source_model',
    dataSource: 'openrouter',
    provider: author,
    providerName: author,
    modelId,
    route: `/models/${author}/${modelId}`,
    urlProvider: author,
    urlModelId: modelId,
    sourceId,
    sourceUrl: `https://openrouter.ai/${sourceId}`,
    status: 'api',
    namespace: author,
    modelIdWithinNamespace: modelId,
    displayName: modelId,
    raw: { model: { id: sourceId, created: 1, pricing: {} } },
    derived: {
      author,
      canonicalSlug: null,
      pageOnlyType: null,
      endpointCount: 0,
      endpointContextLengths: [],
      endpointProviders: [],
      inputModalities: ['text'],
      outputModalities: ['text'],
      pricingKeys: [],
    },
  }
}

function graph(): OpenRouterRawGraph {
  const nodes = [sourceNode('openai/gpt-5.5', 'openai'), sourceNode('qwen/qwen3-max', 'qwen')]
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    schema: { urlShape: '/models/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    source: { modelsPath: 'models.json', endpointsPath: 'endpoints.json', sitemapPath: 'sitemap.json', pagesPath: 'pages.json' },
    stats: { apiModels: 2, sitemapModelPages: 2, pageOnlyModels: 0, endpointWrappers: 0, endpointRows: 0, sourceNodes: 2, endpointNodes: 0, pageRows: 0, nodes: 2, edges: 0 },
    providers: [],
    nodes,
    edges: [],
    indices: { bySourceId: {}, byRoute: {}, pageOnlyNodeIds: [], apiNodeIds: nodes.map((node) => node.id) },
    enrichment: {
      modelsDev: {
        path: 'data/models-dev-api.json',
        providerRows: 2,
        brandLogos: {
          openai: 'https://models.dev/logos/openai.svg',
          qwen: 'https://models.dev/logos/alibaba.svg',
        },
      },
    },
  }
}

describe('renderOpenRouterRawHome logo enrichment', () => {
  it('renders models.dev brand logos in the plaza brand filter without changing canonical rows', () => {
    const html = renderOpenRouterRawHome(graph())

    expect(html).toContain('src="https://models.dev/logos/openai.svg"')
    expect(html).toContain('src="https://models.dev/logos/alibaba.svg"')
    expect(html).toContain('data-filter-value="openai"')
    expect(html).toContain('data-filter-value="qwen"')
  })
})

describe('renderOpenRouterRawDetail BaseLLM price enrichment', () => {
  it('uses BaseLLM as supplemental pricing for missing OpenRouter prices without replacing canonical endpoint prices or free routes', () => {
    const missingPriceNode = sourceNode('jinaai/jina-embeddings-v4', 'jinaai')
    const openRouterPricedNode = sourceNode('openai/gpt-5.5', 'openai')
    openRouterPricedNode.raw.endpointWrapper = { response: { data: { endpoints: [{ tag: 'openai', provider_name: 'OpenAI', pricing: { prompt: '0.00000125', completion: '0.00001' } }] } } }
    const freeRouteNode = sourceNode('deepseek/deepseek-chat:free', 'deepseek')
    const nodes = [missingPriceNode, openRouterPricedNode, freeRouteNode]
    const testGraph: OpenRouterRawGraph = {
      ...graph(),
      nodes,
      stats: { ...graph().stats, nodes: nodes.length, sourceNodes: nodes.length },
      enrichment: {
        baseLlm: {
          path: 'data/basellm-newapi.json',
          source: 'https://basellm.github.io/llm-metadata/api/newapi/models.json',
          modelRows: 3,
          uniqueModelNames: 3,
          providerRows: 2,
          tokenPricedRows: 3,
          unitPricedRows: 0,
          unknownPricedRows: 0,
          exactSourceMatches: 3,
          modelIdOnlyMatches: 0,
          normalizedNameMatches: 0,
          pricingBySourceId: {
            'jinaai/jina-embeddings-v4': [{ providerName: 'BaseLLM Provider', sourceModelId: 'jinaai/jina-embeddings-v4', billingKind: 'token', pricePerMillionInput: 0.02, pricePerMillionOutput: 0.02, contextWindow: '8,192', tags: ['Embedding'] }],
            'openai/gpt-5.5': [{ providerName: 'Cheap Proxy', sourceModelId: 'openai/gpt-5.5', billingKind: 'token', pricePerMillionInput: 0.01, pricePerMillionOutput: 0.02, contextWindow: '—', tags: [] }],
            'deepseek/deepseek-chat:free': [{ providerName: 'Free Route', sourceModelId: 'deepseek/deepseek-chat:free', billingKind: 'token', pricePerMillionInput: 0, pricePerMillionOutput: 0, contextWindow: '—', tags: ['Free'] }],
          },
        },
      },
    }

    const missingHtml = renderOpenRouterRawDetail(testGraph, missingPriceNode)
    expect(missingHtml).toContain('BaseLLM / NewAPI 补充价格')
    expect(missingHtml).toContain('$0.02')
    expect(missingHtml).toContain('BaseLLM Provider')

    const canonicalHtml = renderOpenRouterRawDetail(testGraph, openRouterPricedNode)
    expect(canonicalHtml).toContain('$1.25')
    expect(canonicalHtml).not.toContain('Cheap Proxy')
    expect(canonicalHtml).not.toContain('$0.01')

    const freeHtml = renderOpenRouterRawDetail(testGraph, freeRouteNode)
    expect(freeHtml).not.toContain('BaseLLM / NewAPI 补充价格')
    expect(freeHtml).not.toContain('Free Route')
  })
})
