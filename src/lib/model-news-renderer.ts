import { existsSync, readFileSync } from 'node:fs'
import type { ModelNewsFeed, ModelNewsItem } from './model-news.js'
import type { OpenRouterRawGraph } from './openrouter-raw-graph.js'

export function readModelNews(path: string): ModelNewsFeed {
  if (!existsSync(path)) {
    return { generatedAt: new Date(0).toISOString(), source: '', items: [] }
  }
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as ModelNewsFeed
  return {
    generatedAt: parsed.generatedAt,
    source: parsed.source,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  }
}

export function renderModelNewsHome(_graph: OpenRouterRawGraph, feed: ModelNewsFeed): string {
  const items = feed.items.filter(hasTags).sort(compareNewsItems)
  const groups = groupByDate(items)
  const body = `<main class="newsHome"><section class="newsHero"><div class="wrap"><div class="eyebrow">模型动态</div><h1>追踪全球 AI 模型发布、更新、评测与开源进展</h1><p>来自 AIHOT 的实时动态，经 mddb.dev provider / model-id 标签过滤后发布。</p><div class="newsStats"><span>${items.length} 条已标注动态</span><span>数据源：AIHOT mode=all</span></div></div></section><section class="wrap newsShell"><div class="newsTimeline">${groups.map(renderDateGroup).join('') || '<p class="muted">暂无已标注模型动态。</p>'}</div></section></main>`
  return page('模型动态 · mddb.dev', body, 'home')
}

function renderDateGroup(group: { date: string; items: ModelNewsItem[] }): string {
  return `<section class="newsDateGroup"><h2>${escapeHtml(group.date)}</h2><div class="newsDateItems">${group.items.map(renderNewsCard).join('')}</div></section>`
}

function renderNewsCard(item: ModelNewsItem): string {
  const providerLabels = item.tagLabels?.providers?.length ? item.tagLabels.providers : item.tags.providers
  const modelLabels = item.tagLabels?.models?.length ? item.tagLabels.models : item.tags.models
  const providerTags = providerLabels.map((label, index) => `<span class="newsTag provider">${escapeHtml(label ?? item.tags.providers[index] ?? '')}</span>`).join('')
  const modelTags = modelLabels.map((label, index) => {
    const modelId = item.tags.models[index] ?? label
    const route = item.modelRoutes?.[modelId]
    return route ? `<a class="newsTag model" href="${escapeHtml(route)}">${escapeHtml(label)}</a>` : `<span class="newsTag model">${escapeHtml(label)}</span>`
  }).join('')
  return `<article class="newsCard" data-news-card><div class="newsMeta"><time datetime="${escapeHtml(item.publishedAt ?? '')}">${escapeHtml(formatTime(item.publishedAt))}</time><span>${escapeHtml(item.source)}</span></div><h3><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ''}<div class="newsTags">${providerTags}${modelTags}</div><div class="newsActions"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div></article>`
}

function hasTags(item: ModelNewsItem): boolean {
  return item.tags.providers.length > 0 || item.tags.models.length > 0
}

function compareNewsItems(a: ModelNewsItem, b: ModelNewsItem): number {
  return timestamp(b.publishedAt) - timestamp(a.publishedAt)
}

function groupByDate(items: ModelNewsItem[]): Array<{ date: string; items: ModelNewsItem[] }> {
  const groups = new Map<string, ModelNewsItem[]>()
  for (const item of items) {
    const date = formatDate(item.publishedAt)
    groups.set(date, [...(groups.get(date) ?? []), item])
  }
  return Array.from(groups.entries()).map(([date, groupItems]) => ({ date, items: groupItems }))
}

function timestamp(value: string | null | undefined): number {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '未知日期'
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', timeZone: 'Asia/Shanghai' }).format(new Date(value))
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(new Date(value))
}

type ActivePage = 'home' | 'models'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#070b12;--fg:#eef4ff;--muted:#94a3b8;--panel:#0d1422;--panel2:#111a2a;--line:rgba(148,163,184,.18);--accent:#35e0b4;--accent2:#7dd3fc}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#14213d 0,#070b12 36%,#05070b 100%);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(7,11,18,.78);backdrop-filter:blur(16px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1180px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:18px}.brandmark{font-weight:600;display:flex;align-items:center;gap:10px}.brandZh{color:var(--muted);font-size:14px;border-left:1px solid var(--line);padding-left:10px}.logo{width:22px;height:22px;border-radius:7px;background:#fff;color:#05070b;display:inline-grid;place-items:center}.logo svg{width:15px;height:15px}.topSearch{margin-left:auto;width:240px;height:34px;border:1px solid var(--line);border-radius:999px;color:var(--muted);display:flex;align-items:center;padding:0 13px;font-size:13px;background:rgba(255,255,255,.04)}.githubLink{width:34px;height:34px;border:1px solid var(--line);border-radius:999px;display:inline-grid;place-items:center;color:#cbd5e1;flex:0 0 34px}.githubLink svg{width:18px;height:18px}.navlinks{display:flex;gap:18px;font-size:14px;color:#cbd5e1}.navlinks a{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#fff;border-bottom-color:var(--accent)}.wrap{max-width:1100px;margin:0 auto;padding:0 24px}.newsHero{padding:72px 0 34px}.eyebrow{color:var(--accent);font-weight:600;letter-spacing:.16em;font-size:12px;text-transform:uppercase}.newsHero h1{font-size:48px;line-height:1.05;letter-spacing:-2px;max-width:850px;margin:14px 0}.newsHero p{color:var(--muted);font-size:17px;line-height:1.8;max-width:720px}.newsStats{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.newsStats span,.newsTag{border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.05);font-size:13px;color:#cbd5e1}.newsShell{padding-bottom:80px}.newsTimeline{display:grid;gap:30px}.newsDateGroup{display:grid;grid-template-columns:130px minmax(0,1fr);gap:22px}.newsDateGroup h2{margin:4px 0 0;color:#e2e8f0;font-size:18px;position:sticky;top:82px;height:max-content}.newsDateItems{display:grid;gap:14px;border-left:1px solid var(--line);padding-left:22px}.newsCard{position:relative;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(17,26,42,.92),rgba(13,20,34,.92));padding:18px 20px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.newsCard:before{content:'';position:absolute;left:-28px;top:24px;width:10px;height:10px;border-radius:999px;background:var(--accent);box-shadow:0 0 0 5px rgba(53,224,180,.12)}.newsMeta{display:flex;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:13px}.newsMeta time{color:var(--accent2);font-family:Geist Mono,monospace}.newsCard h3{font-size:21px;line-height:1.35;margin:10px 0}.newsCard p{color:#bfccdd;line-height:1.75;margin:0 0 14px}.newsTags{display:flex;gap:8px;flex-wrap:wrap}.newsTag.provider{color:#d9f99d}.newsTag.model{color:#bae6fd}.newsActions{margin-top:14px}.newsActions a{color:var(--accent);font-size:14px}.footer{border-top:1px solid var(--line);color:var(--muted);padding:26px 0}.muted{color:var(--muted)}@media(max-width:760px){.topSearch{display:none}.nav{gap:12px}.brandZh{display:none}.newsHero h1{font-size:34px}.newsDateGroup{grid-template-columns:1fr}.newsDateGroup h2{position:static}.newsDateItems{margin-left:6px}}
`

function page(title: string, body: string, activePage: ActivePage): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${nav(activePage)}${body}${footer()}</body></html>`
}

function nav(activePage: ActivePage): string {
  const homeClass = activePage === 'home' ? ' class="active"' : ''
  const modelsClass = activePage === 'models' ? ' class="active"' : ''
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/">${databaseLogo()}<span>mddb.dev</span><span class="brandZh">大模型数据库</span></a><div class="topSearch">⌕ 搜索动态</div><a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">${githubLogo()}</a><div class="navlinks"><a${homeClass} href="/">模型动态</a><a${modelsClass} href="/models/">模型广场</a></div></nav></header>`
}

function databaseLogo(): string {
  return `<span class="logo" role="img" aria-label="数据库"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 5v10c0 1.7 3.1 3 7 3s7-1.3 7-3V5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>`
}

function githubLogo(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z"/></svg>`
}

function footer(): string {
  return `<footer class="footer"><div class="wrap">mddb.dev · 面向人和机器的大模型元数据。</div></footer>`
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
}
