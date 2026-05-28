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
      expect(html).toContain('<div class="navlinks"><a href="https://raw.githubusercontent.com/imphillip/mddb/main/data/models.json" target="_blank" rel="noopener noreferrer">models.json</a></div><a class="githubLink" href="https://github.com/imphillip/mddb"')
      expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">')
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

describe('renderOpenRouterRawDetail metadata code block', () => {
  it('renders metadata as a horizontally scrollable code block with a copy button for the whole JSON section', () => {
    const testGraph = graph()
    const node = testGraph.nodes[0]!
    node.raw.model = {
      ...node.raw.model as Record<string, unknown>,
      long_unbroken_value: 'x'.repeat(240),
    }

    const html = renderOpenRouterRawDetail(testGraph, node)

    expect(html).toContain('<div class="codeBlockShell rawBlockShell">')
    expect(html).toContain('<button class="copyCodeBtn" type="button" data-copy-code-target="metadata-json"')
    expect(html).toContain('<pre id="metadata-json" class="raw codeBlock" tabindex="0"><code>')
    expect(html).toContain('white-space:pre;overflow-x:auto')
    expect(html).toContain('const codeButtons=Array.from(document.querySelectorAll(\'[data-copy-code-target]\'));')
    expect(html).toContain('document.getElementById(targetId)')
  })
})

describe('renderOpenRouterRawHome price display', () => {
  it('renders registry CNY prices from Bailian in plaza and detail pages instead of only OpenRouter USD endpoint prices', () => {
    const testGraph = graph()
    const qwen = testGraph.nodes[1]!
    qwen.raw.model = {
      ...qwen.raw.model as Record<string, unknown>,
      mddb_registry: {
        prices: [
          { currency: 'USD', source: 'openrouter', prices: { input: { amount: 0.26, unit: 'per_1m_tokens' }, output: { amount: 0.78, unit: 'per_1m_tokens' } } },
          { currency: 'CNY', source: 'bailian_model_market', prices: { input: { amount: 0.8, unit: 'per_1m_tokens' } } },
          { currency: 'CNY', source: 'bailian_model_market', prices: { output: { amount: 2, unit: 'per_1m_tokens' } } },
        ],
      },
    }

    const plazaHtml = renderOpenRouterRawHome(testGraph)
    const detailHtml = renderOpenRouterRawDetail(testGraph, qwen)

    expect(plazaHtml).not.toContain('<h1>模型广场</h1>')
    expect(plazaHtml).toContain('<th>模型</th><th>上下文</th><th>价格</th><th>发布</th>')
    expect(plazaHtml).not.toContain('<th>来源</th>')
    expect(plazaHtml).toContain('<span class="priceLabel">Input</span>')
    expect(plazaHtml).toContain('<span class="priceLabel">Output</span>')
    expect(plazaHtml).not.toContain('class="sourceCell"')
    expect(plazaHtml).toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">0.8</span>')
    expect(plazaHtml).toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">2</span>')
    expect(detailHtml).toContain('Bailian Model Market')
    expect(detailHtml).toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">0.8</span>')
    expect(detailHtml).toContain('<span class="priceCurrencySymbol">$</span><span class="priceAmount">0.26</span>')
  })
  it('shows only Input and Output as separate lines for token metered list prices', () => {
    const testGraph = graph()
    const qwen = testGraph.nodes[1]!
    qwen.raw.model = {
      ...qwen.raw.model as Record<string, unknown>,
      mddb_registry: {
        prices: [
          { currency: 'CNY', source: 'bailian_model_market', unit_prices: { input: { amount: 12, unit: 'per_1m_tokens' } }, conditions: { label: '输入', bailian_type: 'input_token' } },
          { currency: 'CNY', source: 'bailian_model_market', unit_prices: { output: { amount: 36, unit: 'per_1m_tokens' } }, conditions: { label: '输出', bailian_type: 'output_token' } },
          { currency: 'CNY', source: 'bailian_model_market', unit_prices: { cache_write: { amount: 15, unit: 'per_1m_tokens' } }, conditions: { label: '显式缓存创建', bailian_type: 'input_token_cache_creation_5m' } },
          { currency: 'CNY', source: 'bailian_model_market', unit_prices: { cache_read: { amount: 1.2, unit: 'per_1m_tokens' } }, conditions: { label: '显式缓存命中', bailian_type: 'input_token_cache_read' } },
          { currency: 'CNY', source: 'bailian_model_market', unit_prices: { web_search: { amount: 4, unit: 'per_1k_calls' } }, conditions: { label: 'web_search', bailian_type: 'tool_pricing' } },
        ],
      },
    }

    const plazaHtml = renderOpenRouterRawHome(testGraph)

    const rows = Array.from(plazaHtml.matchAll(/<td class="mono priceCell">([\s\S]*?)<\/td><td class="mono">/gu)).map((match) => match[1] ?? '')
    const priceCell = rows.find((row) => row.includes('12') && row.includes('36')) ?? ''
    expect(priceCell).toContain('<span class="priceLine"><span class="priceLabel">Input</span>')
    expect(priceCell).toContain('<span class="priceLine"><span class="priceLabel">Output</span>')
    expect(priceCell).toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">12</span>')
    expect(priceCell).toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">36</span>')
    expect(priceCell).not.toContain('Cache write')
    expect(priceCell).not.toContain('Cache read')
    expect(priceCell).not.toContain('web_search')
    expect(priceCell).not.toContain('priceSeparator')
    expect(plazaHtml).not.toContain('7 档')
    expect(plazaHtml).not.toContain('<span class="tierCondition">输入</span>')
  })

  it('shows tiered list prices as two price lines plus a compact tier marker', () => {
    const testGraph = graph()
    const qwen = testGraph.nodes[1]!
    qwen.raw.model = {
      ...qwen.raw.model as Record<string, unknown>,
      mddb_registry: {
        prices: [
          { currency: 'USD', source: 'openrouter', unit_prices: { input: { amount: 1.04, unit: 'per_1m_tokens' }, output: { amount: 6.24, unit: 'per_1m_tokens' } } },
          { currency: 'CNY', source: 'bailian_model_market', conditions: { label: '输入<=128k', type: 'input_token', lte: 131072 }, unit_prices: { input: { amount: 9, unit: 'per_1m_tokens' }, output: { amount: 54, unit: 'per_1m_tokens' }, cache_write: { amount: 11.25, unit: 'per_1m_tokens' } } },
          { currency: 'CNY', source: 'bailian_model_market', conditions: { label: '128k<输入<=256k', type: 'input_token', gt: 131072, lte: 262144 }, unit_prices: { input: { amount: 15, unit: 'per_1m_tokens' }, output: { amount: 90, unit: 'per_1m_tokens' } } },
        ],
      },
    }

    const plazaHtml = renderOpenRouterRawHome(testGraph)

    expect(plazaHtml).toContain('<span class="priceLine"><span class="priceLabel">Input</span> <code class="priceValue"><span class="priceCurrencySymbol">￥</span><span class="priceAmount">9</span></code>')
    expect(plazaHtml).toContain('<span class="priceLine"><span class="priceLabel">Output</span> <code class="priceValue"><span class="priceCurrencySymbol">￥</span><span class="priceAmount">54</span></code>')
    expect(plazaHtml).toContain('<span class="tierIcon" title="阶梯价格：2 档" aria-label="阶梯价格：2 档">↕</span>')
    expect(plazaHtml).not.toContain('<span class="priceLine priceTier">')
    expect(plazaHtml).not.toContain('<span class="tierCondition">输入&lt;=128k</span>')
    expect(plazaHtml).not.toContain('<span class="priceCurrencySymbol">￥</span><span class="priceAmount">15</span>')
    expect(plazaHtml).not.toContain('<span class="priceCurrencySymbol">$</span><span class="priceAmount">1.04</span>')
  })
})

describe('renderOpenRouterRawHome default sorting', () => {
  it('orders brand filters by visible canonical model count after featured brands and orders rows by release date descending', () => {
    const testGraph = graph()
    const qwenNew = sourceNode('qwen/qwen-new', 'qwen')
    qwenNew.raw.model = { ...qwenNew.raw.model as Record<string, unknown>, created: 2_000 }
    const openaiOld = sourceNode('openai/openai-old', 'openai')
    openaiOld.raw.model = { ...openaiOld.raw.model as Record<string, unknown>, created: 1_000 }
    const alphaOne = sourceNode('alpha/alpha-one', 'alpha')
    alphaOne.raw.model = { ...alphaOne.raw.model as Record<string, unknown>, created: 1_500 }
    const alphaTwo = sourceNode('alpha/alpha-two', 'alpha')
    alphaTwo.raw.model = { ...alphaTwo.raw.model as Record<string, unknown>, created: 1_200 }
    const betaOne = sourceNode('beta/beta-one', 'beta')
    betaOne.raw.model = { ...betaOne.raw.model as Record<string, unknown>, created: 1_800 }
    const missingCreatedButDated = sourceNode('zeta/model-2026-05-20', 'zeta')
    missingCreatedButDated.raw.model = { id: missingCreatedButDated.sourceId, pricing: {} }
    testGraph.nodes = [openaiOld, alphaOne, betaOne, qwenNew, alphaTwo, missingCreatedButDated]
    testGraph.edges = []

    const html = renderOpenRouterRawHome(testGraph)

    expect(html.indexOf('data-filter-value="openai"')).toBeLessThan(html.indexOf('data-filter-value="qwen"'))
    expect(html.indexOf('data-filter-value="alpha"')).toBeLessThan(html.indexOf('data-filter-value="beta"'))
    expect(html.indexOf('data-filter-value="beta"')).toBeLessThan(html.indexOf('data-filter-value="zeta"'))
    expect(html.indexOf('model-2026-05-20')).toBeLessThan(html.indexOf('qwen-new'))
    expect(html.indexOf('qwen-new')).toBeLessThan(html.indexOf('beta-one'))
    expect(html.indexOf('beta-one')).toBeLessThan(html.indexOf('alpha-one'))
    expect(html.indexOf('alpha-one')).toBeLessThan(html.indexOf('alpha-two'))
    expect(html.indexOf('alpha-two')).toBeLessThan(html.indexOf('openai-old'))
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

  it('updates quick filter counts from the current search result set instead of static all-model counts', () => {
    const html = renderOpenRouterRawHome(graph())

    expect(html).toContain('const quickFilterCounts=Object.fromEntries(outputButtons.map(button=>[button.dataset.outputFilter||\'all\',button.querySelector(\'.quickFilterCount\')]).filter((entry)=>entry[1]));')
    expect(html).toContain('const facetCounts={all:0};')
    expect(html).toContain('const baseVisible=authorOk&&providerOk&&queryOk&&visibilityOk;')
    expect(html).toContain('if(baseVisible){facetCounts.all+=1;for(const modality of rowOutputModalities(row)){facetCounts[modality]=(facetCounts[modality]||0)+1;}}')
    expect(html).toContain('if(quickFilterCounts[facet])quickFilterCounts[facet].textContent=String(facetCounts[facet]||0);')
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
  it('keeps endpoint-only deployment rows out of the model plaza while preserving provider query hydration', () => {
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

    expect(html).not.toContain('data-model-provider="together"')
    expect(html).not.toContain('data-search-only="true"')
    expect(html).toContain("params.get('provider')")
    expect(html).toContain("/?provider=")
    expect(html).toContain('history.replaceState')
  })
  it('does not expose endpoint-only deployer/provider offers as separate model plaza rows', () => {
    const testGraph = graph()
    const canonical = sourceNode('x-ai/grok-4.20', 'xai')
    canonical.displayName = 'Grok 4.20'
    canonical.derived.author = 'xai'
    const deployerOffer = endpointNode('x-ai/grok-4.20', 'together', 'xai')
    deployerOffer.displayName = 'Together: Grok 4.20'
    testGraph.nodes = [canonical, deployerOffer]
    testGraph.edges = [{ id: 'edge:together:grok-4.20', from: deployerOffer.id, to: canonical.id, type: 'deployment_of', label: 'Together offers Grok 4.20' }]

    const html = renderOpenRouterRawHome(testGraph)

    expect(html).toContain('data-model-name="grok 4.20 xai grok-4.20 x-ai/grok-4.20 xai"')
    expect(html).not.toContain('data-model-provider="together"')
    expect(html).not.toContain('data-search-only="true"')
    expect(html).not.toContain('Together: Grok 4.20')
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
