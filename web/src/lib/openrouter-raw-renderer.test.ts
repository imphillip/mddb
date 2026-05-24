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
      { id: 'openai', name: 'OpenAI', currency: 'USD', raw: { icon: 'https://models.dev/logos/openai.svg', offers: [{ model_id: 'gpt-5.5' }, { model_id: 'gpt-4.1' }] } },
      { id: 'qwen', name: 'Qwen', currency: 'CNY', raw: { icon: 'https://models.dev/logos/alibaba.svg', offers: [{ model_id: 'qwen3-max' }] } },
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
  it('uses the same brand, search, menu, and GitHub controls on plaza and detail pages', () => {
    const testGraph = graph()
    const pages = [
      renderOpenRouterRawHome(testGraph),
      renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!),
    ]

    for (const html of pages) {
      expect(html).toContain('<header class="topbar"><nav class="nav"><a class="brandmark" href="/">')
      expect(html).toContain('<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / author / source" autocomplete="off"></label>')
      expect(html).toContain('<div class="navlinks"><a href="https://raw.githubusercontent.com/imphillip/mddb/main/data/models.json" target="_blank" rel="noopener noreferrer">models.json</a><a class="githubLink" href="https://github.com/imphillip/mddb"')
      expect(html).not.toContain('<a class="active" href="/">模型广场</a>')
      expect(html).not.toContain('供应商广场')
      expect(html).not.toContain('data-currency-toggle')
      expect(html.indexOf('class="brandmark"')).toBeLessThan(html.indexOf('class="topSearch"'))
      expect(html.indexOf('class="topSearch"')).toBeLessThan(html.indexOf('class="navlinks"'))
      expect(html.indexOf('models.json')).toBeLessThan(html.indexOf('class="githubLink"'))
    }
  })
})

describe('mobile responsive layout', () => {
  it('renders mobile CSS that makes nav wrap compactly and keeps plaza/detail pages usable on narrow screens', () => {
    const testGraph = graph()
    const pages = [
      renderOpenRouterRawHome(testGraph),
      renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!),
    ]

    for (const html of pages) {
      expect(html).toContain('@media(max-width:720px)')
      expect(html).toContain('.nav{height:auto;min-height:56px')
      expect(html).toContain('.brandZh{display:none}')
      expect(html).toContain('.topSearch{order:5;width:100%')
      expect(html).toContain('.navlinks{order:3;margin-left:0')
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

describe('renderOpenRouterRawHome price display', () => {
  it('renders explicit currency symbols without a nav currency toggle', () => {
    const testGraph = graph()
    testGraph.nodes[0]!.raw.endpointWrapper = { response: { data: { endpoints: [{ tag: 'openai', provider_name: 'OpenAI', pricing: { prompt: '0.00000125', completion: '0.00001', input_cache_read: '0.000000125' } }] } } }

    const plazaHtml = renderOpenRouterRawHome(testGraph)
    const detailHtml = renderOpenRouterRawDetail(testGraph, testGraph.nodes[0]!)

    for (const html of [plazaHtml, detailHtml]) {
      expect(html).not.toContain('class="currencyToggle"')
      expect(html).not.toContain('data-currency-toggle')
      expect(html).not.toContain('data-usd=')
      expect(html).not.toContain('data-cny=')
      expect(html).not.toContain("localStorage.setItem('mddb.currency'")
      expect(html).toContain('<span class="priceCurrencySymbol">$</span><span class="priceAmount">1.25</span>')
      expect(html).toContain('<span class="priceCurrencySymbol">$</span><span class="priceAmount">10</span>')
    }

    expect(plazaHtml).toContain('class="githubLink"')
    expect(plazaHtml).toContain('<a class="brandmark" href="/">')
    expect(plazaHtml).not.toContain('模型动态')
    expect(plazaHtml).toContain('<div class="navlinks"><a href="https://raw.githubusercontent.com/imphillip/mddb/main/data/models.json" target="_blank" rel="noopener noreferrer">models.json</a><a class="githubLink" href="https://github.com/imphillip/mddb"')
    expect(plazaHtml).not.toContain('<a class="active" href="/">模型广场</a>')
    expect(plazaHtml).not.toContain('供应商广场')
    expect(plazaHtml).toContain('.githubLink{width:34px')
    expect(plazaHtml).toContain('.githubLink svg{width:18px')
    expect(plazaHtml).not.toContain('>1 USD</button>')
    expect(plazaHtml).not.toContain('>6.8 CNY</button>')
  })
})

describe('renderOpenRouterRawHome modality filter counts', () => {
  it('moves total items into the All quick filter and shows counts on non-empty modality sections', () => {
    const testGraph = graph()
    testGraph.nodes[0]!.derived.outputModalities = ['text', 'image']
    testGraph.nodes[1]!.derived.outputModalities = ['text']

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).not.toContain('<div class="listCount"><b id="visibleCount">2</b> items</div>')
    expect(html).toContain('<button class="quickFilter active" type="button" data-output-filter="all">全部 <span class="quickFilterCount" id="visibleCount">2</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="text">Text <span class="quickFilterCount">2</span></button>')
    expect(html).toContain('<button class="quickFilter" type="button" data-output-filter="image">Image <span class="quickFilterCount">1</span></button>')
    expect(html).not.toContain('data-output-filter="embeddings"')
    expect(html).toContain('.quickFilterCount')
  })

  it('normalizes LiteLLM category aliases so non-chat models appear in their plaza filters', () => {
    const testGraph = graph()
    const embedding = sourceNode('openai/text-embedding-3-small', 'openai')
    embedding.derived.outputModalities = ['embedding']
    const rerank = sourceNode('cohere/cohere-rerank-v3.5', 'cohere')
    rerank.derived.outputModalities = ['ranking']
    const transcription = sourceNode('openai/gpt-4o-mini-transcribe', 'openai')
    transcription.derived.outputModalities = ['text']
    transcription.raw.model = { id: transcription.sourceId, pricing: {}, mddb_registry: { other_parameters: { litellm: { mode: 'audio_transcription' } } } }
    const speech = sourceNode('openai/gpt-4o-mini-tts', 'openai')
    speech.derived.outputModalities = ['audio']
    speech.raw.model = { id: speech.sourceId, pricing: {}, mddb_registry: { other_parameters: { litellm: { mode: 'audio_speech' } } } }
    testGraph.nodes = [embedding, rerank, transcription, speech]

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).toContain('data-output-filter="embeddings">Embedding <span class="quickFilterCount">1</span>')
    expect(html).toContain('data-output-filter="rerank">Rerank <span class="quickFilterCount">1</span>')
    expect(html).toContain('data-output-filter="transcription">Transcription <span class="quickFilterCount">1</span>')
    expect(html).toContain('data-output-filter="speech">Speech <span class="quickFilterCount">1</span>')
    expect(html).toContain('data-output-modalities="embeddings"')
    expect(html).toContain('data-output-modalities="rerank"')
    expect(html).toContain('data-output-modalities="text transcription"')
    expect(html).toContain('data-output-modalities="audio speech"')
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
  it('renders provider icons in the plaza brand filter without changing canonical rows', () => {
    const html = renderOpenRouterRawHome(graph())

    expect(html).toContain('src="https://models.dev/logos/openai.svg"')
    expect(html).toContain('src="https://models.dev/logos/alibaba.svg"')
    expect(html).toContain('data-filter-value="openai"')
    expect(html).toContain('data-filter-value="qwen"')
  })
})

describe('provider pages', () => {
  it('does not export provider directory renderers from the open-source frontend', () => {
    const html = renderOpenRouterRawHome(graph())

    expect(html).not.toContain('供应商广场')
    expect(html).not.toContain('href="/providers/"')
    expect(html).not.toContain('providerPlaza')
    expect(html).not.toContain('providerDirectoryGrid')
  })
})

function modelFilterScriptMarker(): string {
  return 'window.applyModelFilters=applyModelFilters;'
}

describe('renderOpenRouterRawDetail LiteLLM supplemental price enrichment', () => {
  it('renders LiteLLM non-chat multimodal and unit prices when no provider price exists', () => {
    const litellmNode = sourceNode('amazon/amazon.nova-2-multimodal-embeddings-v1:0', 'amazon')
    litellmNode.raw.model = {
      id: litellmNode.sourceId,
      pricing: {},
      mddb_registry: {
        other_parameters: {
          litellm: {
            provider: 'bedrock',
            raw_id: 'amazon.nova-2-multimodal-embeddings-v1:0',
            prices: [
              { kind: 'input', amount: 0.135, unit: 'per_1m_tokens', source_key: 'input_cost_per_token' },
              { kind: 'input', amount: 0.27, unit: 'per_1m_tokens', source_key: 'input_cost_per_token_above_200k_tokens', condition: 'above 200k tokens' },
              { kind: 'input_image', amount: 0.00006, unit: 'per_image', source_key: 'input_cost_per_image' },
              { kind: 'input_audio', amount: 0.00014, unit: 'per_audio_second', source_key: 'input_cost_per_audio_per_second' },
            ],
          },
        },
      },
    }

    const html = renderOpenRouterRawDetail(graph(), litellmNode)

    expect(html).toContain('LiteLLM 补充价格')
    expect(html).toContain('Input · above 200k tokens')
    expect(html).toContain('Input Image')
    expect(html).toContain('per image')
    expect(html).toContain('Input Audio')
    expect(html).toContain('per audio second')
  })
})

describe('renderOpenRouterRawDetail BaseLLM price enrichment', () => {
  it('does not render BaseLLM/NewAPI supplemental prices in the open-source frontend', () => {
    const missingPriceNode = sourceNode('jinaai/jina-embeddings-v4', 'jinaai')
    const testGraph: OpenRouterRawGraph = {
      ...graph(),
      nodes: [missingPriceNode],
      enrichment: {
        baseLlm: {
          path: 'data/basellm-newapi.json',
          source: 'https://basellm.github.io/llm-metadata/api/newapi/models.json',
          modelRows: 1,
          uniqueModelNames: 1,
          providerRows: 1,
          tokenPricedRows: 1,
          unitPricedRows: 0,
          unknownPricedRows: 0,
          exactSourceMatches: 1,
          modelIdOnlyMatches: 0,
          normalizedNameMatches: 0,
          pricingBySourceId: {
            'jinaai/jina-embeddings-v4': [{ providerName: 'BaseLLM Provider', sourceModelId: 'jinaai/jina-embeddings-v4', billingKind: 'token', pricePerMillionInput: 0.02, pricePerMillionOutput: 0.02, contextWindow: '8,192', tags: ['Embedding'] }],
          },
        },
      },
    }

    const html = renderOpenRouterRawDetail(testGraph, missingPriceNode)

    expect(html).not.toContain('BaseLLM / NewAPI')
    expect(html).not.toContain('BaseLLM Provider')
    expect(html).not.toContain('$0.02')
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
