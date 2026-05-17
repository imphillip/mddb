import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph } from './openrouter-raw-graph.js'
import { renderModelNewsHome } from './model-news-renderer.js'
import type { ModelNewsFeed } from './model-news.js'

const emptyGraph = { currency: { base: 'USD', quote: 'CNY', rate: 6.8, rawRate: 6.822857, source: 'https://open.er-api.com/v6/latest/USD', updatedAt: '2026-05-16T00:02:31.000Z' } } as OpenRouterRawGraph

describe('renderModelNewsHome', () => {
  it('renders tagged items and excludes untagged items on the homepage', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain('模型动态')
    expect(html).toContain('追踪全球 AI 模型发布')
    expect(html).toContain('data-news-card')
    expect(html).toContain('Claude 新模型发布')
    expect(html).toContain('<a class="newsTag provider" href="/models/anthropic/">Anthropic</a>')
    expect(html).toContain('<a class="newsTag model" href="/models/anthropic/claude-opus-4.7/">claude-opus-4.7</a>')
    expect(html).not.toContain('泛 AI 行业新闻')
  })

  it('keeps homepage nav active and links 模型广场 to /models/', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain('<a class="active" href="/">模型动态</a>')
    expect(html).toContain('<a href="/models/">模型广场</a>')
    expect(html).not.toContain('/models/news/')
  })

  it('uses the shared header contract and page shell as the model plaza', () => {
    const html = renderModelNewsHome(emptyGraph, feedFixture())

    expect(html).toContain(':root{--bg:#fff;--fg:#171717')
    expect(html).toContain('body{margin:0;background:var(--bg);color:var(--fg)')
    expect(html).toContain('<header class="topbar"><nav class="nav"><a class="brandmark" href="/">')
    expect(html).toContain('<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / author / source" autocomplete="off"></label>')
    expect(html).toContain('<a class="githubLink" href="https://github.com/imphillip/mddb"')
    expect(html).toContain('<div class="navlinks"><a class="active" href="/">模型动态</a><a href="/models/">模型广场</a></div>')
    expect(html).toContain('class="currencyToggle"')
    expect(html).toContain('data-currency-toggle')
    expect(html.indexOf('class="brandmark"')).toBeLessThan(html.indexOf('class="topSearch"'))
    expect(html.indexOf('class="topSearch"')).toBeLessThan(html.indexOf('class="githubLink"'))
    expect(html.indexOf('class="githubLink"')).toBeLessThan(html.indexOf('class="navlinks"'))
    expect(html.indexOf('class="navlinks"')).toBeLessThan(html.indexOf('data-currency-toggle'))
    expect(html).toContain('<main class="newsShell"')
    expect(html).toContain('<section class="mainPanel newsPanel">')
    expect(html).toContain('.newsShell{max-width:920px')
    expect(html).toContain('@media(max-width:720px)')
    expect(html).toContain('.nav{height:auto;min-height:56px')
    expect(html).toContain('.brandZh{display:none}')
    expect(html).toContain('.topSearch{order:5;width:100%')
    expect(html).toContain('.newsShell{padding:20px 14px 56px')
    expect(html).toContain('.newsHero h1{font-size:34px')
    expect(html).toContain('.newsCard{padding:16px')
    expect(html).not.toContain('filterPanel newsInfoPanel')
    expect(html).not.toContain('模型动态说明')
    expect(html).not.toContain('数据源：AIHOT')
    expect(html).not.toContain('条已标注动态')
    expect(html).not.toContain('radial-gradient')
    expect(html).not.toContain('#070b12')
  })

  it('renders the first 20 tagged items and includes an infinite-scroll loader for the next page', () => {
    const html = renderModelNewsHome(emptyGraph, manyTaggedItemsFeed(25))

    const initialHtml = html.split('<script type="application/json" id="newsData">')[0] ?? html
    expect(countOccurrences(initialHtml, '<article class="newsCard" data-news-card>')).toBe(20)
    expect(countOccurrences(html, 'data-news-card')).toBe(21)
    expect(html).toContain('data-news-page-size="20"')
    expect(html).toContain('id="newsSentinel"')
    expect(html).toContain('loadNextNewsPage')
    expect(initialHtml).toContain('第 20 条动态')
    expect(initialHtml).not.toContain('第 21 条动态')
    expect(html).toContain('第 21 条动态')
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
        providerRoutes: { anthropic: '/models/anthropic/' },
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


function manyTaggedItemsFeed(count: number): ModelNewsFeed {
  return {
    generatedAt: '2026-05-17T00:00:00.000Z',
    source: 'https://aihot.virxact.com/api/public/items?mode=all&take=100',
    items: Array.from({ length: count }, (_, index) => {
      const number = index + 1
      const hour = String(23 - (index % 20)).padStart(2, '0')
      return {
        id: `tagged-${number}`,
        title: `第 ${number} 条动态`,
        url: `https://example.com/news-${number}`,
        source: 'AIHOT',
        publishedAt: `2026-05-${String(17 - Math.floor(index / 20)).padStart(2, '0')}T${hour}:00:00.000Z`,
        summary: `第 ${number} 条摘要`,
        category: 'tip',
        tags: { providers: ['openai'], models: [] },
        tagLabels: { providers: ['OpenAI'], models: [] },
      }
    }),
  }
}

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1
}
