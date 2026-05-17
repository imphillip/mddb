import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph } from './openrouter-raw-graph.js'
import { renderModelNewsHome } from './model-news-renderer.js'
import type { ModelNewsFeed } from './model-news.js'

const emptyGraph = {} as OpenRouterRawGraph

describe('renderModelNewsHome', () => {
  it('renders tagged items and excludes untagged items on the homepage', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain('模型动态')
    expect(html).toContain('追踪全球 AI 模型发布')
    expect(html).toContain('data-news-card')
    expect(html).toContain('Claude 新模型发布')
    expect(html).toContain('Anthropic')
    expect(html).toContain('/models/anthropic/claude-opus-4.7/')
    expect(html).not.toContain('泛 AI 行业新闻')
  })

  it('keeps homepage nav active and links 模型广场 to /models/', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain('<a class="active" href="/">模型动态</a>')
    expect(html).toContain('<a href="/models/">模型广场</a>')
    expect(html).not.toContain('/models/news/')
  })

  it('uses the same light header contract and page shell as the model plaza', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain(':root{--bg:#fff;--fg:#171717')
    expect(html).toContain('body{margin:0;background:var(--bg);color:var(--fg)')
    expect(html).toContain('<header class="topbar"><nav class="nav"><a class="brandmark" href="/">')
    expect(html).toContain('<div class="topSearch">⌕ 搜索模型</div>')
    expect(html).toContain('<a class="githubLink" href="https://github.com/imphillip/mddb"')
    expect(html).toContain('<a class="active" href="/">模型动态</a><a href="/models/">模型广场</a>')
    expect(html).toContain('<main class="newsShell">')
    expect(html).toContain('<section class="mainPanel newsPanel">')
    expect(html).toContain('.newsShell{max-width:920px')
    expect(html).not.toContain('filterPanel newsInfoPanel')
    expect(html).not.toContain('模型动态说明')
    expect(html).not.toContain('数据源：AIHOT')
    expect(html).not.toContain('条已标注动态')
    expect(html).not.toContain('radial-gradient')
    expect(html).not.toContain('#070b12')
  })

  it('groups news by date in descending order', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html.indexOf('5月17日')).toBeLessThan(html.indexOf('5月16日'))
  })
})

function feedFixture(): ModelNewsFeed {
  return {
    generatedAt: '2026-05-17T00:00:00.000Z',
    source: 'https://aihot.virxact.com/api/public/items?mode=all&take=100',
    items: [
      {
        id: 'tagged-newer',
        title: 'Claude 新模型发布',
        url: 'https://example.com/claude',
        source: 'Anthropic Blog',
        publishedAt: '2026-05-17T04:00:00.000Z',
        summary: 'Anthropic 发布 Claude Opus 4.7。',
        category: 'ai-models',
        tags: { providers: ['anthropic'], models: ['claude-opus-4.7'] },
        tagLabels: { providers: ['Anthropic'], models: ['claude-opus-4.7'] },
        modelRoutes: { 'claude-opus-4.7': '/models/anthropic/claude-opus-4.7/' },
      },
      {
        id: 'untagged',
        title: '泛 AI 行业新闻',
        url: 'https://example.com/industry',
        source: 'AIHOT',
        publishedAt: '2026-05-17T03:00:00.000Z',
        summary: '没有模型标签。',
        category: 'industry',
        tags: { providers: [], models: [] },
      },
      {
        id: 'tagged-older',
        title: 'OpenAI API 更新',
        url: 'https://example.com/openai',
        source: 'OpenAI',
        publishedAt: '2026-05-16T03:00:00.000Z',
        summary: 'OpenAI 更新 API。',
        category: 'ai-products',
        tags: { providers: ['openai'], models: [] },
        tagLabels: { providers: ['OpenAI'], models: [] },
      },
    ],
  }
}
