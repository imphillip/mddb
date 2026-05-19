import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'
import { renderOpenRouterProviderDetail, renderOpenRouterProviderIndex, renderOpenRouterRawDetail, renderOpenRouterRawHome } from './openrouter-raw-renderer.js'

function sourceNode(sourceId: string, author: string): OpenRouterRawNode {
  const [, modelId = sourceId] = sourceId.split('/')
  return {
    id: `openrouter-source:${sourceId}`,
    nodeKind: 'source_model',
    dataSource: 'openrouter',
    provider: author,
    providerName: author,
    modelId,
    route: `/${author}/${modelId}`,
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

function endpointNode(sourceId: string, provider: string, author: string): OpenRouterRawNode {
  const node = sourceNode(sourceId, provider)
  node.id = `openrouter-endpoint:${sourceId}`
  node.nodeKind = 'endpoint_deployment'
  node.provider = provider
  node.providerName = provider
  node.namespace = provider
  node.displayName = `${provider}: ${node.modelId}`
  node.derived.author = author
  return node
}

function graph(): OpenRouterRawGraph {
  const nodes = [sourceNode('openai/gpt-5.5', 'openai'), sourceNode('qwen/qwen3-max', 'qwen')]
  const openaiOffer = endpointNode('openai/gpt-5.5', 'openai', 'openai')
  openaiOffer.id = 'openrouter-endpoint:openai/gpt-5.5:openai-offer'
  openaiOffer.displayName = 'OpenAI: gpt-5.5 offer'
  nodes.push(openaiOffer)
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    schema: { urlShape: '/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    graphModel: { version: 'v2-observation-graph', identityBoundary: 'openrouter-source-id', pricingPolicy: 'provider-specific-observations-preserve-billing-mode', provenancePolicy: 'facts-are-nodes-or-observations-with-source-links' },
    source: { modelsPath: 'models.json', endpointsPath: 'endpoints.json', sitemapPath: 'sitemap.json', pagesPath: 'pages.json' },
    stats: { apiModels: 2, sitemapModelPages: 2, pageOnlyModels: 0, endpointWrappers: 0, endpointRows: 0, pricingObservations: 0, providerObservations: 0, sourceNodes: 2, endpointNodes: 0, pageRows: 0, nodes: 2, edges: 0 },
    providers: [
      { id: 'openai', name: 'OpenAI', currency: 'USD', raw: { offers: [{ model_id: 'gpt-5.5' }, { model_id: 'gpt-4.1' }] } },
      { id: 'qwen', name: 'Qwen', currency: 'CNY', raw: { offers: [{ model_id: 'qwen3-max' }] } },
      { id: 'novita', name: 'Novita', currency: 'USD', raw: { offers: [] } },
    ],
    nodes,
    edges: [{ id: 'edge:openai-offer:deployment_of:gpt-5.5', from: openaiOffer.id, to: nodes[0]!.id, type: 'deployment_of', label: 'OpenAI offers gpt-5.5' }],
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
      renderOpenRouterProviderDetail(testGraph, 'openai'),
      renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!),
    ]

    for (const html of pages) {
      expect(html).toContain('<header class="topbar"><nav class="nav"><a class="brandmark" href="/">')
      expect(html).toContain('<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / author / source" autocomplete="off"></label>')
      expect(html).toContain('<a class="githubLink" href="https://github.com/imphillip/mddb"')
      expect(html).toContain('<div class="navlinks"><a class="active" href="/">模型广场</a><a href="/providers/">供应商广场</a></div>')
      expect(html).toContain('class="currencyToggle"')
      expect(html).toContain('data-currency-toggle')
      expect(html.indexOf('class="brandmark"')).toBeLessThan(html.indexOf('class="topSearch"'))
      expect(html.indexOf('class="topSearch"')).toBeLessThan(html.indexOf('class="githubLink"'))
      expect(html.indexOf('class="githubLink"')).toBeLessThan(html.indexOf('class="navlinks"'))
      expect(html.indexOf('class="navlinks"')).toBeLessThan(html.indexOf('data-currency-toggle'))
    }
  })
})

describe('mobile responsive layout', () => {
  it('renders mobile CSS that makes nav wrap compactly and keeps plaza/provider/detail pages usable on narrow screens', () => {
    const testGraph = graph()
    const pages = [
      renderOpenRouterRawHome(testGraph),
      renderOpenRouterProviderDetail(testGraph, 'openai'),
      renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!),
    ]

    for (const html of pages) {
      expect(html).toContain('@media(max-width:720px)')
      expect(html).toContain('.nav{height:auto;min-height:56px')
      expect(html).toContain('.brandZh{display:none}')
      expect(html).toContain('.topSearch{order:5;width:100%')
      expect(html).toContain('.navlinks{order:3;margin-left:0')
      expect(html).toContain('.currencyControl{order:4;margin-left:auto')
      expect(html).toContain('.modelsShell{display:block')
      expect(html).toContain('.filterPanel{position:static')
      expect(html).toContain('.mainPanel{padding:20px 14px 56px')
      expect(html).toContain('.tableWrap{margin:0 -14px;padding:0 14px')
      expect(html).toContain('.modelTable{min-width:760px')
      expect(html).toContain('.detailHero h1{font-size:34px')
      expect(html).toContain('.detailSingle{padding-top:22px')
    }
  })
})

describe('renderOpenRouterRawHome currency toggle', () => {
  it('renders a nav currency toggle with inline FX rate and dual USD/CNY prices capped at 4 decimals', () => {
    const testGraph = graph()
    testGraph.nodes[0]!.raw.endpointWrapper = { response: { data: { endpoints: [{ tag: 'openai', provider_name: 'OpenAI', pricing: { prompt: '0.00000125', completion: '0.00001', input_cache_read: '0.000000125' } }] } } }

    const plazaHtml = renderOpenRouterRawHome(testGraph)
    const providerHtml = renderOpenRouterProviderDetail(testGraph, 'openai')
    const detailHtml = renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!)

    for (const html of [plazaHtml, providerHtml, detailHtml]) {
      expect(html).toContain('class="currencyToggle"')
      expect(html).toContain('data-currency-toggle')
      expect(html).toContain('data-usd="1.25"')
      expect(html).toContain('data-cny="8.5"')
      expect(html).toContain('data-usd="10"')
      expect(html).toContain('data-cny="68"')
      expect(html).toContain('const prices=Array.from(document.querySelectorAll(\'[data-usd][data-cny]\'))')
    }

    expect(plazaHtml).toContain('class="githubLink"')
    expect(plazaHtml).toContain('<a class="brandmark" href="/">')
    expect(plazaHtml).not.toContain('模型动态')
    expect(plazaHtml).toContain('<div class="navlinks"><a class="active" href="/">模型广场</a><a href="/providers/">供应商广场</a></div>')
    expect(plazaHtml.indexOf('data-currency-toggle')).toBeGreaterThan(plazaHtml.indexOf('模型广场'))
    expect(plazaHtml).toContain('.githubLink{width:34px')
    expect(plazaHtml).toContain('.githubLink svg{width:18px')
    expect(plazaHtml).toContain('USD')
    expect(plazaHtml).toContain('CNY')
    expect(plazaHtml).toContain('>1 USD</button>')
    expect(plazaHtml).toContain('>6.8 CNY</button>')
    expect(plazaHtml).not.toContain('1 USD ≈ 6.8 CNY')
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


describe('renderOpenRouterRawHome URL query state', () => {
  it('hydrates provider query params so tag links can reveal search-only deployment rows', () => {
    const testGraph = graph()
    const togetherEndpoint = endpointNode('together/gpt-oss-120b', 'together', 'openai')
    testGraph.nodes.push(togetherEndpoint)
    testGraph.edges.push({
      id: 'edge:together:gpt-oss',
      from: togetherEndpoint.id,
      to: testGraph.nodes[0]!.id,
      type: 'deployment_of',
      label: 'endpoint deployment observed via openai/gpt-oss-120b',
    })

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).toContain('data-model-provider="together"')
    expect(html).toContain('data-search-only="true"')
    expect(html).toContain("params.get('provider')")
    expect(html).toContain("/?provider=")
    expect(html).toContain('history.replaceState')
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
  it('renders supplier plaza cards from every registry provider file', () => {
    const html = renderOpenRouterProviderIndex(graph())

    expect(html).toContain('<h1>供应商广场</h1>')
    expect(html).toContain('<div class="navlinks"><a href="/">模型广场</a><a class="active" href="/providers/">供应商广场</a></div>')
    expect(html).toContain('providerPlaza')
    expect(html).toContain('providerDirectoryGrid')
    expect(html).toContain('grid-template-columns:repeat(auto-fill,minmax(220px,1fr))')
    expect(html).toContain('@media(max-width:720px)')
    expect(html).toContain('.providerDirectoryGrid{grid-template-columns:1fr')
    expect(html).not.toContain('<aside class="filterPanel">')
    expect(html).not.toContain('registry/providers/*.json')
    expect(html).not.toContain('<code>openai.json</code>')
    expect(html).not.toContain('openai.json')
    expect(html).toContain('3 个供应商')
    expect(html).toContain('<a class="providerDirectoryLink providerDirectoryCard" href="/openai/">')
    expect(html).toContain('<span>OpenAI</span>')
    expect(html).toContain('自研 1 个模型 · 提供 2 个模型')
    expect(html).toContain('<span>USD</span>')
    expect(html).toContain('<a class="providerDirectoryLink providerDirectoryCard" href="/qwen/">')
    expect(html).toContain('自研 1 个模型 · 提供 1 个模型')
    expect(html).toContain('<a class="providerDirectoryLink providerDirectoryCard" href="/novita/">')
    expect(html).not.toContain('0 个模型 · 0 个 offer')
    expect(html).not.toContain('0 个模型')
    expect(html).not.toContain('offer')
    expect(html).toContain('暂无模型')
    expect(html).toContain('供应商广场 · mddb.dev')
  })

  it('renders provider offer models with the model plaza homepage layout and left brand filters', () => {
    const html = renderOpenRouterProviderDetail(graph(), 'openai')

    expect(html).toContain('OpenAI')
    expect(html).toContain('<aside class="filterPanel" aria-label="模型筛选">')
    expect(html).toContain('<span>厂牌</span>')
    expect(html).toContain('<section class="mainPanel"><div class="plazaHead"><div><h1>OpenAI</h1>')
    expect(html).toContain('<div class="listToolbar"><div class="quickFilters" aria-label="模态筛选"><button class="quickFilter active" type="button" data-output-filter="all">全部 <span class="quickFilterCount" id="visibleCount">2</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="text">Text <span class="quickFilterCount">2</span></button>')
    expect(html).toContain('<div class="tableWrap"><table class="modelTable">')
    expect(html).toContain('<thead><tr><th>模型</th><th>上下文</th><th>输入<br><small data-price-unit>/M tokens</small></th><th>输出<br><small data-price-unit>/M tokens</small></th><th>读取<br><small data-price-unit>/M tokens</small></th><th>发布时间</th></tr></thead>')
    expect(html).toContain('<a class="modelLink" href="/openai/gpt-5.5/">gpt-5.5</a>')
    expect(html).toContain('OpenAI: gpt-5.5 offer')
    expect(html).toContain('data-model-row')
    expect(html).toContain(`${modelFilterScriptMarker()}`)
    expect(html).toContain('href="/"')
    expect(html).not.toContain('class="providerDetailGrid"')
    expect(html).not.toContain('class="filterPanel providerNewsRail"')
    expect(html).not.toContain('← 返回模型广场')
    expect(html).not.toContain('模型动态')
    expect(html).not.toContain('<h2>OpenAI 相关动态</h2>')
    expect(html).toContain('href="/providers/"')
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
