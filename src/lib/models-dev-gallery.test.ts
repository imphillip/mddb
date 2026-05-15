import { describe, expect, it } from 'vitest'
import { buildModelGalleryFromModelsDevIndex, type ModelsDevIndex } from './models-dev-gallery.js'
import { renderModelDetailPage, renderModelsPage } from './site-renderer.js'

function makeIndex(): ModelsDevIndex {
  return {
    providers: [
      { id: 'openai', name: 'OpenAI', modelCount: 2, iconURL: 'https://models.dev/logos/openai.svg' },
      { id: 'azure', name: 'Azure AI Foundry', modelCount: 1, iconURL: 'https://models.dev/logos/azure.svg' },
      { id: 'openrouter', name: 'OpenRouter', modelCount: 1, iconURL: 'https://models.dev/logos/openrouter.svg' },
      { id: 'google', name: 'Google AI', modelCount: 1, iconURL: 'https://models.dev/logos/google.svg' },
      { id: 'acme', name: 'Acme Gateway', modelCount: 1, iconURL: 'https://models.dev/logos/acme.svg' },
      { id: 'anthropic', name: 'Anthropic', modelCount: 2, iconURL: 'https://models.dev/logos/anthropic.svg' },
      { id: 'databricks', name: 'Databricks', modelCount: 1, iconURL: 'https://models.dev/logos/databricks.svg' },
    ],
    models: [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        providerId: 'openai',
        updated: '2024-08-06',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'gpt-4o-2024-08-06',
        name: 'GPT-4o 2024-08-06',
        providerId: 'azure',
        updated: '2024-08-06',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'openai/gpt-4o',
        name: 'OpenAI: GPT-4o',
        providerId: 'openrouter',
        updated: '2024-05-13',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        providerId: 'google',
        updated: '2025-06-05',
        flags: { attachment: true, reasoning: true, tool_call: true },
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        providerId: 'openai',
        updated: '2024-01-25',
        flags: { attachment: false, reasoning: false, tool_call: false },
      },
      {
        id: 'mystery-model',
        name: 'Mystery Model',
        providerId: 'acme',
        inputPrice: 0.25,
        outputPrice: 1.5,
        cacheReadPrice: 0.1,
        cacheWritePrice: 0.4,
        contextWindow: 8192,
        outputLimit: 2048,
        inputModalities: ['text', 'image'],
        outputModalities: ['text'],
        family: 'mystery',
        knowledge: '2024-10',
        releaseDate: '2024-10-31',
        openWeights: true,
        temperature: true,
        structuredOutput: true,
        flags: { attachment: false, reasoning: false, tool_call: false },
      },
      {
        id: 'placeholder-date-model',
        name: 'Placeholder Date Model',
        providerId: 'acme',
        updated: '1970-01-01',
        flags: { attachment: false, reasoning: false, tool_call: false },
      },
      {
        id: 'claude-opus4-7',
        name: 'Claude Opus 4.7',
        providerId: 'anthropic',
        updated: '2026-01-01',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'databricks-claude-opus-4-7',
        name: 'Databricks Claude Opus 4.7',
        providerId: 'databricks',
        updated: '2026-01-02',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'claude-opus-4-7-default',
        name: 'Claude Opus 4.7 Default',
        providerId: 'openrouter',
        updated: '2026-01-03',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'eu-anthropic-claude-opus-4-7',
        name: 'EU Anthropic Claude Opus 4.7',
        providerId: 'azure',
        updated: '2026-01-04',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'jp-anthropic-claude-opus-4-7',
        name: 'JP Anthropic Claude Opus 4.7',
        providerId: 'acme',
        updated: '2026-01-05',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'claude-opus-4-7-thinking',
        name: 'Claude Opus 4.7 Thinking',
        providerId: 'anthropic',
        updated: '2026-01-06',
        flags: { attachment: true, reasoning: true, tool_call: true },
      },
      {
        id: 'claude-4-6-opus',
        name: 'Claude 4.6 Opus',
        providerId: 'anthropic',
        updated: '2025-11-01',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
      {
        id: 'claude-opus-4-6-v1',
        name: 'Claude Opus 4.6 v1',
        providerId: 'openrouter',
        updated: '2025-11-02',
        flags: { attachment: true, reasoning: false, tool_call: true },
      },
    ],
  }
}

describe('buildModelGalleryFromModelsDevIndex', () => {
  it('builds canonical model rows from the local models.dev index without fetching the online API', () => {
    const gallery = buildModelGalleryFromModelsDevIndex(makeIndex(), {
      sourcePath: 'fixtures/models-dev-api.json',
    })

    expect(gallery.stats).toMatchObject({
      modelCount: 7,
      brandCount: 4,
      providerCount: 7,
      variantCount: 9,
    })
    expect(gallery.source).toEqual({
      path: 'fixtures/models-dev-api.json',
      modelRows: 15,
      providerRows: 7,
    })
    expect(gallery.brands.map((brand) => brand.slug)).toEqual(['anthropic', 'google', 'openai', 'other'])

    const gpt4o = gallery.models.find((model) => model.tag === 'gpt-4o')
    expect(gpt4o).toMatchObject({
      tag: 'gpt-4o',
      route: '/models/gpt-4o',
      name: 'GPT-4o',
      brand: { slug: 'openai', name: 'OpenAI' },
      modalities: ['文本', '视觉', '工具'],
      providerNames: ['Azure AI Foundry', 'OpenAI', 'OpenRouter'],
      variantCount: 2,
      releasedAt: '2024-05-13',
    })
    expect(gpt4o?.weeklyTokens).toBe('—')
    expect(gpt4o?.brand.logoUrl).toBe('https://models.dev/logos/openai.svg')

    const mystery = gallery.models.find((model) => model.tag === 'mystery-model')
    expect(mystery?.releasedAt).toBe('—')
    expect(mystery?.inputPrice).toBe('$0.25 / 1M')
    expect(mystery?.outputPrice).toBe('$1.5 / 1M')
    expect(mystery?.contextWindow).toBe('8,192')

    const mysteryDetail = gallery.details.find((model) => model.tag === 'mystery-model')
    expect(mysteryDetail?.meta).toContainEqual({ label: '输出模态', value: ['text'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '模型家族', value: ['mystery'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '知识截止', value: ['2024-10'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '发布日期', value: ['2024-10-31'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '输出 token 限制', value: ['2,048'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '缓存读取价格', value: ['$0.1 / 1M'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '缓存写入价格', value: ['$0.4 / 1M'] })
    expect(mysteryDetail?.meta).toContainEqual({ label: '开放权重', value: '是' })
    expect(mysteryDetail?.meta).toContainEqual({ label: '温度控制', value: '是' })
    expect(mysteryDetail?.meta).toContainEqual({ label: '结构化输出', value: '是' })
    expect(mysteryDetail?.variants[0]?.differences).toEqual(expect.arrayContaining(['模型家族 mystery', '知识截止 2024-10', '输出限制 2,048', '开放权重 是']))

    const placeholderDateModel = gallery.models.find((model) => model.tag === 'placeholder-date-model')
    expect(placeholderDateModel?.releasedAt).toBe('—')

    const detail = gallery.details.find((model) => model.tag === 'gpt-4o')
    expect(detail?.variants.map((variant) => variant.id)).toEqual(['gpt-4o-2024-08-06', 'gpt-4o'])
    expect(detail?.variants[0]).toMatchObject({
      name: 'GPT-4o 2024 08 06',
      summary: 'snapshot 版本 GPT-4o 2024 08 06。',
      providers: [{ slug: 'azure', name: 'Azure AI Foundry', logoUrl: 'https://models.dev/logos/azure.svg' }],
    })
    expect(detail?.variants[1]).toMatchObject({
      name: 'GPT-4o',
      summary: '同一模型版本在 2 个 provider 上可用。',
      providers: [
        { slug: 'openai', name: 'OpenAI', logoUrl: 'https://models.dev/logos/openai.svg' },
        { slug: 'openrouter', name: 'OpenRouter', logoUrl: 'https://models.dev/logos/openrouter.svg' },
      ],
    })

    const claudeOpus47 = gallery.details.find((model) => model.tag === 'claude-opus-4-7')
    expect(claudeOpus47).toMatchObject({
      tag: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      brand: { slug: 'anthropic', name: 'Anthropic' },
      providerNames: ['Acme Gateway', 'Anthropic', 'Azure AI Foundry', 'Databricks', 'OpenRouter'],
      variantCount: 1,
      modalities: ['文本', '视觉', '推理', '工具'],
    })
    expect(claudeOpus47?.variants).toHaveLength(1)
    expect(claudeOpus47?.brand.logoUrl).toBe('https://models.dev/logos/anthropic.svg')
    expect(claudeOpus47?.variants[0]).toMatchObject({
      id: 'claude-opus-4-7-thinking',
      name: 'Claude Opus 4.7 Thinking',
      summary: '同一模型版本在 5 个 provider 上可用。',
      providers: [
        { slug: 'acme', name: 'Acme Gateway', logoUrl: 'https://models.dev/logos/acme.svg' },
        { slug: 'anthropic', name: 'Anthropic', logoUrl: 'https://models.dev/logos/anthropic.svg' },
        { slug: 'azure', name: 'Azure AI Foundry', logoUrl: 'https://models.dev/logos/azure.svg' },
        { slug: 'databricks', name: 'Databricks', logoUrl: 'https://models.dev/logos/databricks.svg' },
        { slug: 'openrouter', name: 'OpenRouter', logoUrl: 'https://models.dev/logos/openrouter.svg' },
      ],
    })
    expect(gallery.details.some((model) => ['claude-opus4-7', 'databricks-claude-opus-4-7', 'eu-anthropic-claude-opus-4-7'].includes(model.tag))).toBe(false)

    const claudeOpus46 = gallery.details.find((model) => model.tag === 'claude-opus-4-6')
    expect(claudeOpus46).toMatchObject({
      tag: 'claude-opus-4-6',
      name: 'Claude 4.6 Opus',
      brand: { slug: 'anthropic', name: 'Anthropic' },
      providerNames: ['Anthropic', 'OpenRouter'],
      variantCount: 2,
    })
    expect(claudeOpus46?.variants.map((variant) => variant.id)).toEqual(['claude-opus-4-6-v1', 'claude-opus-4-6-thinking'])
    expect(claudeOpus46?.variants[0]).toMatchObject({
      id: 'claude-opus-4-6-v1',
      name: 'Claude Opus 4.6 V1',
      summary: 'snapshot 版本 Claude Opus 4.6 V1。',
      providers: [{ slug: 'openrouter', name: 'OpenRouter' }],
    })
    expect(claudeOpus46?.variants[0]?.differences).toContain('快照 v1')
    expect(gallery.details.some((model) => ['claude-4-6-opus', 'claude-opus-4-6-v1'].includes(model.tag))).toBe(false)
  })
})

describe('models.dev-backed rendering', () => {
  it('renders functional brand filter controls and hides the internal source notice', () => {
    const gallery = buildModelGalleryFromModelsDevIndex(makeIndex(), { sourcePath: 'local-index.json' })
    const html = renderModelsPage(gallery)

    expect(html).toContain('data-filter-group="brand"')
    expect(html).toContain('data-filter-value="openai"')
    expect(html).toContain('<span>厂牌</span>')
    expect(html).not.toContain('<span>输入类型</span>')
    expect(html).not.toContain('<span>部署来源</span>')
    expect(html).not.toContain('data-filter-group="modality"')
    expect(html).not.toContain('data-filter-group="provider"')
    expect(html).toContain('data-model-brand="openai"')
    expect(html).not.toContain('id="modelSearch"')
    expect(html).not.toContain('id="modelSort"')
    expect(html).not.toContain('Compare')
    expect(html).not.toContain('aria-label="模型类型"')
    expect(html).toContain('function applyModelFilters()')
    expect(html).toContain('modelRows.forEach')
    expect(html).not.toContain('数据源：本地 models.dev 参考库')
  })

  it('renders models.dev model detail pages and uses dash for missing release dates', () => {
    const gallery = buildModelGalleryFromModelsDevIndex(makeIndex(), { sourcePath: 'local-index.json' })

    const detailHtml = renderModelDetailPage('gpt-4o', gallery.details)
    expect(detailHtml).toContain('<img src="https://models.dev/logos/openai.svg" alt="OpenAI logo"')
    expect(detailHtml).toContain('<img src="https://models.dev/logos/azure.svg" alt="Azure AI Foundry logo"')
    expect(detailHtml).toContain('GPT-4o')
    expect(detailHtml).toContain('概览')
    expect(detailHtml).toContain('部署来源')
    expect(detailHtml).toContain('变体')
    expect(detailHtml).toContain('Azure AI Foundry')
    expect(detailHtml).toContain('OpenRouter')
    expect(detailHtml).toContain('GET /models/gpt-4o')

    const noDateHtml = renderModelDetailPage('mystery-model', gallery.details)
    expect(noDateHtml).toContain('<span>发布日期</span><b>—</b>')
    expect(renderModelsPage(gallery)).toContain('<td>—</td>')
    expect(noDateHtml).not.toContain('1970年1月1日')
  })
})
