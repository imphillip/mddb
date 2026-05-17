import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'
import { renderOpenRouterProviderDetail, renderOpenRouterRawDetail, renderOpenRouterRawHome } from './openrouter-raw-renderer.js'

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
    graphModel: { version: 'v2-observation-graph', identityBoundary: 'openrouter-source-id', pricingPolicy: 'provider-specific-observations-preserve-billing-mode', provenancePolicy: 'facts-are-nodes-or-observations-with-source-links' },
    source: { modelsPath: 'models.json', endpointsPath: 'endpoints.json', sitemapPath: 'sitemap.json', pagesPath: 'pages.json' },
    stats: { apiModels: 2, sitemapModelPages: 2, pageOnlyModels: 0, endpointWrappers: 0, endpointRows: 0, pricingObservations: 0, providerObservations: 0, sourceNodes: 2, endpointNodes: 0, pageRows: 0, nodes: 2, edges: 0 },
    providers: [],
    nodes,
    edges: [],
    indices: { bySourceId: {}, byRoute: {}, pageOnlyNodeIds: [], apiNodeIds: nodes.map((node) => node.id) },
    currency: {
      base: 'USD',
      quote: 'CNY',
      rate: 6.8,
      rawRate: 6.822857,
      source: 'https://open.er-api.com/v6/latest/USD',
      updatedAt: '2026-05-16T00:02:31.000Z',
    },
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

describe('shared navigation contract', () => {
  it('uses the same brand, search, menu, GitHub and currency controls on plaza, provider and detail pages', () => {
    const testGraph = graph()
    const pages = [
      renderOpenRouterRawHome(testGraph),
      renderOpenRouterProviderDetail(testGraph, 'openai', { generatedAt: '2026-05-17T00:00:00.000Z', source: 'fixture', items: [] }),
      renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!),
    ]

    for (const html of pages) {
      expect(html).toContain('<header class="topbar"><nav class="nav"><a class="brandmark" href="/">')
      expect(html).toContain('<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / author / source" autocomplete="off"></label>')
      expect(html).toContain('<a class="githubLink" href="https://github.com/imphillip/mddb"')
      expect(html).toContain('<div class="navlinks"><a href="/">模型动态</a><a class="active" href="/models/">模型广场</a></div>')
      expect(html).toContain('class="currencyToggle"')
      expect(html).toContain('data-currency-toggle')
      expect(html.indexOf('class="brandmark"')).toBeLessThan(html.indexOf('class="topSearch"'))
      expect(html.indexOf('class="topSearch"')).toBeLessThan(html.indexOf('class="githubLink"'))
      expect(html.indexOf('class="githubLink"')).toBeLessThan(html.indexOf('class="navlinks"'))
      expect(html.indexOf('class="navlinks"')).toBeLessThan(html.indexOf('data-currency-toggle'))
    }
  })
})

describe('renderOpenRouterRawHome currency toggle', () => {
  it('renders a nav currency toggle with inline FX rate and dual USD/CNY prices capped at 4 decimals', () => {
    const testGraph = graph()
    testGraph.nodes[0]!.raw.endpointWrapper = { response: { data: { endpoints: [{ tag: 'openai', provider_name: 'OpenAI', pricing: { prompt: '0.00000125', completion: '0.00001', input_cache_read: '0.000000125' } }] } } }

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).toContain('class="currencyToggle"')
    expect(html).toContain('data-currency-toggle')
    expect(html).toContain('class="githubLink"')
    expect(html).toContain('<a class="brandmark" href="/">')
    expect(html).toContain('<a href="/">模型动态</a>')
    expect(html.indexOf('class="githubLink"')).toBeLessThan(html.indexOf('模型动态'))
    expect(html.indexOf('data-currency-toggle')).toBeGreaterThan(html.indexOf('模型广场'))
    expect(html).toContain('.githubLink{width:34px')
    expect(html).toContain('.githubLink svg{width:18px')
    expect(html).toContain('USD')
    expect(html).toContain('CNY')
    expect(html).toContain('data-usd="1.25"')
    expect(html).toContain('data-cny="8.5"')
    expect(html).toContain('data-usd="10"')
    expect(html).toContain('data-cny="68"')
    expect(html).toContain('>1 USD</button>')
    expect(html).toContain('>6.8 CNY</button>')
    expect(html).not.toContain('1 USD ≈ 6.8 CNY')
  })
})

describe('renderOpenRouterRawHome modality filter counts', () => {
  it('moves total items into the All quick filter and shows counts on each modality section', () => {
    const testGraph = graph()
    testGraph.nodes[0]!.derived.outputModalities = ['text', 'image']
    testGraph.nodes[1]!.derived.outputModalities = ['text']

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).not.toContain('<div class="listCount"><b id="visibleCount">2</b> items</div>')
    expect(html).toContain('<button class="quickFilter active" type="button" data-output-filter="all">全部 <span class="quickFilterCount" id="visibleCount">2</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="text">Text <span class="quickFilterCount">2</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="image">Image <span class="quickFilterCount">1</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="embeddings">Embedding <span class="quickFilterCount">0</span></button>')
    expect(html).toContain('.quickFilterCount')
  })
})


describe('renderOpenRouterRawHome logo enrichment', () => {
  it('renders models.dev brand logos in the plaza brand filter without changing canonical rows', () => {
    const html = renderOpenRouterRawHome(graph())

    expect(html).toContain('src="https://models.dev/logos/openai.svg"')
    expect(html).toContain('src="https://models.dev/logos/alibaba.svg"')
    expect(html).toContain('data-filter-value="openai"')
    expect(html).toContain('data-filter-value="qwen"')
  })
})

describe('provider pages', () => {
  it('renders provider models with the model plaza table style and puts recent provider news in the left rail', () => {
    const feed = {
      generatedAt: '2026-05-17T00:00:00.000Z',
      source: 'fixture',
      items: Array.from({ length: 12 }, (_, index) => ({
        id: `news-openai-${index}`,
        title: `OpenAI 动态 ${index + 1}`,
        url: `https://example.com/openai-news-${index}`,
        source: 'AIHOT',
        publishedAt: `2026-05-${String(17 - index).padStart(2, '0')}T09:00:00.000Z`,
        summary: 'OpenAI 相关行业动态。',
        tags: { providers: ['openai'], models: ['gpt-5.5'] },
        tagLabels: { providers: ['OpenAI'], models: ['gpt-5.5'] },
      })),
    }

    const html = renderOpenRouterProviderDetail(graph(), 'openai', feed)

    expect(html).toContain('OpenAI')
    expect(html).toContain('<aside class="filterPanel providerNewsRail">')
    expect(html).toContain('<a class="btn backToPlaza" href="/models/">← 返回模型广场</a>')
    expect(html).toContain('<h3>模型动态</h3>')
    expect(html).toContain('OpenAI 动态 1')
    expect(html).toContain('OpenAI 动态 10')
    expect(html).not.toContain('OpenAI 动态 11')
    expect(html).toContain('<section class="mainPanel"><div class="plazaHead"><div><h1>OpenAI</h1>')
    expect(html).toContain('<div class="tableWrap"><table class="modelTable">')
    expect(html).toContain('<thead><tr><th>模型</th><th>上下文</th><th>输入<br><small data-price-unit>/M tokens</small></th><th>输出<br><small data-price-unit>/M tokens</small></th><th>读取<br><small data-price-unit>/M tokens</small></th><th>发布时间</th></tr></thead>')
    expect(html).toContain('<a class="modelLink" href="/models/openai/gpt-5.5/">gpt-5.5</a>')
    expect(html).toContain('data-model-row')
    expect(html).toContain(`${modelFilterScriptMarker()}`)
    expect(html).toContain('href="/models/"')
    expect(html).not.toContain('class="providerDetailGrid"')
    expect(html).not.toContain('<h2>OpenAI 相关动态</h2>')
    expect(html).not.toContain('/models/providers/')
    expect(html).not.toContain('Provider 列表')
    expect(html).not.toContain('qwen3-max')
  })
})

function modelFilterScriptMarker(): string {
  return 'window.applyModelFilters=applyModelFilters;'
}

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
    expect(missingHtml).toContain('data-usd="0.02"')
    expect(missingHtml).toContain('BaseLLM Provider')

    const canonicalHtml = renderOpenRouterRawDetail(testGraph, openRouterPricedNode)
    expect(canonicalHtml).toContain('data-usd="1.25"')
    expect(canonicalHtml).not.toContain('Cheap Proxy')
    expect(canonicalHtml).not.toContain('$0.01')

    const freeHtml = renderOpenRouterRawDetail(testGraph, freeRouteNode)
    expect(freeHtml).not.toContain('BaseLLM / NewAPI 补充价格')
    expect(freeHtml).not.toContain('Free Route')
  })
})

describe('renderOpenRouterRawDetail release date fallback', () => {
  it('uses a date snapshot suffix as Released when OpenRouter created is missing, without overriding existing created timestamps', () => {
    const snapshotNode = sourceNode('openai/gpt-4o-2024-08-06', 'openai')
    snapshotNode.raw.model = { id: snapshotNode.sourceId, pricing: {} }
    const compactSnapshotNode = sourceNode('anthropic/claude-sonnet-4-20250514', 'anthropic')
    compactSnapshotNode.raw.model = { id: compactSnapshotNode.sourceId, pricing: {} }
    const datedNode = sourceNode('google/gemini-2.5-pro-preview-05-06', 'google')
    datedNode.raw.model = { id: datedNode.sourceId, created: 1715558400, pricing: {} }
    const testGraph: OpenRouterRawGraph = { ...graph(), nodes: [snapshotNode, compactSnapshotNode, datedNode] }

    expect(renderOpenRouterRawDetail(testGraph, snapshotNode)).toContain('<span>Released</span><b>2024-08-06</b>')
    expect(renderOpenRouterRawDetail(testGraph, compactSnapshotNode)).toContain('<span>Released</span><b>2025-05-14</b>')
    expect(renderOpenRouterRawDetail(testGraph, datedNode)).toContain('<span>Released</span><b>2024-05-13</b>')
  })
})
