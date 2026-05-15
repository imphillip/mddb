import { describe, expect, it } from 'vitest'
import { buildModelGallery, getModelDetail, type ModelGallery } from './model-catalog.js'
import { renderHomePage, renderModelDetailPage, renderModelsPage } from './site-renderer.js'

describe('site renderer', () => {
  it('renders the root page as an immediate redirect to the model plaza', () => {
    const html = renderHomePage()

    expect(html).toContain('mddb.dev')
    expect(html).toContain('大模型数据库')
    expect(html).toContain('aria-label="数据库"')
    expect(html).toContain('href="https://github.com/imphillip/mddb"')
    expect(html).toContain('aria-label="GitHub 仓库"')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/models/">')
    expect(html).toContain('<link rel="canonical" href="/models/">')
    expect(html).toContain('正在跳转到模型广场')
    expect(html).toContain('href="/models/">进入模型广场</a>')
    expect(html).toContain('<span class="disabled" aria-disabled="true">模型动态</span>')
    expect(html).toContain('<a class="active" href="/models/">模型广场</a>')
    expect(html).not.toContain('首页暂时留空')
    expect(html).not.toContain('href="/">模型动态</a>')
    expect(html).not.toContain('Models</a>')
    expect(html).not.toContain('Providers</a>')
    expect(html).not.toContain('Pricing</a>')
    expect(html).not.toContain('Docs</a>')
  })

  it('renders a Chinese model plaza with only brand filters and a release-sorted table', () => {
    const html = renderModelsPage()

    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('大模型数据库')
    expect(html).toContain('aria-label="数据库"')
    expect(html).toContain('<span class="disabled" aria-disabled="true">模型动态</span>')
    expect(html).toContain('<a class="active" href="/models/">模型广场</a>')
    expect(html).not.toContain('href="/">模型动态</a>')
    expect(html).toContain('<div class="filterTitle">筛选</div>')
    expect(html).toContain('<span>厂牌</span>')
    expect(html).toContain('<details class="filterMore"><summary>更多厂牌（5 个 / 5 个模型）</summary>')
    expect(html).toContain('<span class="filterLogo">A</span><span>Anthropic</span><small>1</small>')
    expect(html).toContain('<span class="filterLogo">O</span><span>OpenAI</span><small>1</small>')
    expect(html).toContain('<span class="filterLogo">D</span><span>DeepSeek</span><small>1</small>')
    expect(html).toContain('data-filter-group="brand"')
    expect(html).not.toContain('placeholder="搜索模型…"')
    expect(html).not.toContain('<span>输入类型</span>')
    expect(html).not.toContain('<span>上下文长度</span>')
    expect(html).not.toContain('<span>部署来源</span>')
    expect(html).not.toContain('data-filter-group="modality"')
    expect(html).not.toContain('data-filter-group="provider"')
    expect(html).not.toContain('Input Modalities')
    expect(html).not.toContain('Context length')
    expect(html).not.toContain('Prompt pricing')
    expect(html).not.toContain('Compare')
    expect(html).not.toContain('Newest')
    expect(html).not.toContain('aria-label="模型类型"')
    expect(html).toContain('<th>模型名称</th>')
    expect(html).not.toContain('<th>Weekly Tokens</th>')
    expect(html).toContain('<th>输入价格</th>')
    expect(html).toContain('<th>输出价格</th>')
    expect(html).toContain('<th>上下文</th>')
    expect(html).toContain('<th>发布日期</th>')
    expect(html).toContain('Claude Sonnet 4')
    expect(html).toContain('href="/models/claude-sonnet-4/"')
    expect(html.indexOf('Claude Sonnet 4')).toBeLessThan(html.indexOf('DeepSeek R1'))
    expect(html.indexOf('DeepSeek R1')).toBeLessThan(html.indexOf('Llama 3.1 405B Instruct'))
    expect(html).toContain('<td>2025年5月22日</td>')
    expect(html).not.toContain('131.072,000')
  })


  it('keeps large brand filters visible, supports curated overrides, and hides remaining small brands behind a disclosure', () => {
    const base = buildModelGallery()
    const gallery: ModelGallery = {
      ...base,
      brands: [
        { slug: 'large', name: 'LargeBrand', description: 'Large test brand', models: [...base.models, base.models[0]!] },
        { slug: 'arcee-ai', name: 'Arcee AI', description: 'Collapsed large test brand', models: [...base.models, base.models[0]!] },
        { slug: 'bytedance', name: 'ByteDance', description: 'Expanded small test brand', models: base.models.slice(0, 4) },
        { slug: 'medium', name: 'MediumBrand', description: 'Medium test brand', models: base.models.slice(0, 5) },
        { slug: 'small', name: 'SmallBrand', description: 'Small test brand', models: base.models.slice(0, 1) },
      ],
    }
    const html = renderModelsPage(gallery)
    const largeIndex = html.indexOf('<span class="filterLogo">L</span><span>LargeBrand</span><small>6</small>')
    const collapsedLargeIndex = html.indexOf('<span class="filterLogo">A</span><span>Arcee AI</span><small>6</small>')
    const expandedSmallIndex = html.indexOf('<span class="filterLogo">B</span><span>ByteDance</span><small>4</small>')
    const disclosureIndex = html.indexOf('<details class="filterMore"><summary>更多厂牌（3 个 / 12 个模型）</summary>')
    const mediumIndex = html.indexOf('<span class="filterLogo">M</span><span>MediumBrand</span><small>5</small>')
    const smallIndex = html.indexOf('<span class="filterLogo">S</span><span>SmallBrand</span><small>1</small>')

    expect(largeIndex).toBeGreaterThan(-1)
    expect(expandedSmallIndex).toBeGreaterThan(-1)
    expect(disclosureIndex).toBeGreaterThan(-1)
    expect(largeIndex).toBeLessThan(disclosureIndex)
    expect(expandedSmallIndex).toBeLessThan(disclosureIndex)
    expect(collapsedLargeIndex).toBeGreaterThan(disclosureIndex)
    expect(mediumIndex).toBeGreaterThan(disclosureIndex)
    expect(smallIndex).toBeGreaterThan(disclosureIndex)
  })

  it('removes internal page-specification prompts from public pages', () => {
    const publicHtml = [renderHomePage(), renderModelsPage(), renderModelDetailPage('claude-sonnet-4')].join('\n')

    expect(publicHtml).not.toContain('默认按模型厂牌分类')
    expect(publicHtml).not.toContain('Provider 被压缩为模型的部署属性')
    expect(publicHtml).not.toContain('只有同一模型在上下文、价格、网络或参数行为上存在差异')
    expect(publicHtml).not.toContain('Provider 是部署属性；只有行为差异才拆成 Variant')
  })

  it('renders copy controls beside model name tags so discussions can reference exact ids', () => {
    const detailHtml = renderModelDetailPage('claude-sonnet-4')
    const plazaHtml = renderModelsPage()

    expect(detailHtml).toContain('class="modelTagCopy"')
    expect(detailHtml).toContain('data-copy-model-tag="claude-sonnet-4"')
    expect(detailHtml).toContain('aria-label="复制模型 tag claude-sonnet-4"')
    expect(detailHtml).toContain('复制')
    expect(detailHtml).toContain('navigator.clipboard.writeText(tag)')
    expect(plazaHtml).toContain('data-copy-model-tag="claude-sonnet-4"')
  })

  it('renders complete official pricing components on model detail pages', () => {
    const model = buildModelGallery().models[0]!
    const detail = getModelDetail(model.tag)!
    const html = renderModelDetailPage(model.tag, [
      {
        ...detail,
        officialPriceSets: [
          {
            priceSetId: 'openrouter:test/model',
            modelTag: model.tag,
            source: 'openrouter',
            sourceModelKey: 'test/model',
            sourceProvider: 'test',
            components: [
              { mode: 'token', scope: 'input', currency: 'USD', amount: 1.25, unit: '1m_tokens', conditions: [], sourceField: 'prompt' },
              { mode: 'request', scope: 'request', currency: 'USD', amount: 0.002, unit: 'request', conditions: [], sourceField: 'request' },
              { mode: 'image', scope: 'image_output', currency: 'USD', amount: 0.01, unit: 'image', conditions: [{ key: 'resolution', value: '1024x1024' }], sourceField: 'image_output' },
            ],
            rawPricing: { prompt: '0.00000125', request: '0.002', image_output: '0.01' },
            warnings: [],
          },
        ],
      },
    ])

    expect(html).toContain('官方价格')
    expect(html).toContain('计价方式')
    expect(html).toContain('范围')
    expect(html).toContain('单位')
    expect(html).toContain('条件')
    expect(html).toContain('来源')
    expect(html).toContain('token')
    expect(html).toContain('按请求')
    expect(html).toContain('图片')
    expect(html).toContain('$1.25')
    expect(html).toContain('$0.002')
    expect(html).toContain('resolution=1024x1024')
    expect(html).toContain('openrouter:test/model')
  })

  it('renders OpenRouter-like model detail sections with providers and provider-specific variants', () => {
    const html = renderModelDetailPage('claude-sonnet-4')

    expect(html).toContain('Claude Sonnet 4')
    expect(html).toContain('href="/models/"')
    expect(html).toContain('返回模型列表')
    expect(html).toContain('大模型数据库')
    expect(html).toContain('概览')
    expect(html).toContain('部署来源')
    expect(html).toContain('变体')
    expect(html).toContain('价格')
    expect(html).toContain('API')
    expect(html).toContain('输入价格')
    expect(html).toContain('输出价格')
    expect(html).toContain('复制模型 tag')
    expect(html).not.toContain('Model page sections')
    expect(html).not.toContain('INPUT PRICE')
    expect(html).not.toContain('MODALITIES')
    expect(html).toContain('标准版')
    expect(html).toContain('Vertex 长上下文版')
    expect(html).toContain('Bedrock 企业版')
  })
})
