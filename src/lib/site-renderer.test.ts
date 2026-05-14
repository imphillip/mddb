import { describe, expect, it } from 'vitest'
import { renderHomePage, renderModelDetailPage, renderModelsPage } from './site-renderer.js'

describe('site renderer', () => {
  it('renders the requested primary navigation with model updates as home and model plaza as /models', () => {
    const html = renderHomePage()

    expect(html).toContain('mddb.dev')
    expect(html).toContain('<a class="active" href="/">模型动态</a>')
    expect(html).toContain('<a href="/models/">模型广场</a>')
    expect(html).toContain('首页暂时留空')
    expect(html).not.toContain('Models</a>')
    expect(html).not.toContain('Providers</a>')
    expect(html).not.toContain('Pricing</a>')
    expect(html).not.toContain('Docs</a>')
  })

  it('renders a Chinese model plaza with only brand filters and a release-sorted table', () => {
    const html = renderModelsPage()

    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('<a href="/">模型动态</a>')
    expect(html).toContain('<a class="active" href="/models/">模型广场</a>')
    expect(html).toContain('<div class="filterTitle">筛选</div>')
    expect(html).toContain('<span>厂牌</span>')
    expect(html).toContain('<span>Anthropic</span><small>1</small>')
    expect(html).toContain('<span>OpenAI</span><small>1</small>')
    expect(html).toContain('<span>Google</span><small>1</small>')
    expect(html).toContain('<span>DeepSeek</span><small>1</small>')
    expect(html).toContain('<span>Meta</span><small>1</small>')
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
    expect(html).toContain('<th>Model Name</th>')
    expect(html).not.toContain('<th>Weekly Tokens</th>')
    expect(html).toContain('<th>Input</th>')
    expect(html).toContain('<th>Output</th>')
    expect(html).toContain('<th>Context</th>')
    expect(html).toContain('<th>Released</th>')
    expect(html).toContain('Claude Sonnet 4')
    expect(html).toContain('href="/models/claude-sonnet-4/"')
    expect(html.indexOf('Claude Sonnet 4')).toBeLessThan(html.indexOf('DeepSeek R1'))
    expect(html.indexOf('DeepSeek R1')).toBeLessThan(html.indexOf('Llama 3.1 405B Instruct'))
    expect(html).toContain('<td class="mono">128K</td>')
    expect(html).not.toContain('131.072,000')
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
    expect(detailHtml).toContain('aria-label="复制 model name tag claude-sonnet-4"')
    expect(detailHtml).toContain('复制')
    expect(detailHtml).toContain('navigator.clipboard.writeText(tag)')
    expect(plazaHtml).toContain('data-copy-model-tag="claude-sonnet-4"')
  })

  it('renders OpenRouter-like model detail sections with providers and provider-specific variants', () => {
    const html = renderModelDetailPage('claude-sonnet-4')

    expect(html).toContain('Claude Sonnet 4')
    expect(html).toContain('Overview')
    expect(html).toContain('Providers')
    expect(html).toContain('Variants')
    expect(html).toContain('Pricing')
    expect(html).toContain('API')
    expect(html).toContain('标准版')
    expect(html).toContain('Vertex 长上下文版')
    expect(html).toContain('Bedrock 企业版')
  })
})
