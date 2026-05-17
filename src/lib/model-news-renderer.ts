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

export function renderModelNewsHome(graph: OpenRouterRawGraph, feed: ModelNewsFeed): string {
  const items = feed.items.filter(hasTags).sort(compareNewsItems)
  const initialItems = items.slice(0, NEWS_PAGE_SIZE)
  const groups = groupByDate(initialItems)
  const body = `<main class="newsShell" data-news-page-size="${NEWS_PAGE_SIZE}"><section class="mainPanel newsPanel"><div class="plazaHead newsHead"><div><h1>模型动态</h1><p class="rawIntro">追踪全球 AI 模型发布、更新、评测、使用技巧、用户反馈与应用场景。</p></div></div><div class="newsTimeline" id="newsTimeline">${groups.map(renderDateGroup).join('') || '<p class="muted">暂无已标注模型动态。</p>'}</div><div id="newsSentinel" class="newsSentinel" aria-hidden="true"></div></section></main>${renderNewsPaginationScript(items)}`
  return page('模型动态 · mddb.dev', body, 'home', currencyToggle(graph))
}


function renderNewsPaginationScript(items: ModelNewsItem[]): string {
  if (items.length <= NEWS_PAGE_SIZE) return ''
  const payload = escapeScriptJson(JSON.stringify(items.slice(NEWS_PAGE_SIZE)))
  return `<script type="application/json" id="newsData">${payload}</script><script>(function(){
const pageSize=${NEWS_PAGE_SIZE};
const timeline=document.getElementById('newsTimeline');
const sentinel=document.getElementById('newsSentinel');
const dataNode=document.getElementById('newsData');
let remaining=[];
try{remaining=JSON.parse(dataNode&&dataNode.textContent||'[]')}catch(error){remaining=[]}
function escapeHtml(value){return String(value==null?'':value).replace(/[&<>'"]/g,function(char){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]||char})}
function formatDate(value){if(!value)return '未知日期';return new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',timeZone:'Asia/Shanghai'}).format(new Date(value))}
function formatTime(value){if(!value)return '时间未知';return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'}).format(new Date(value))}
function renderCard(item){
 const providerLabels=(item.tagLabels&&item.tagLabels.providers&&item.tagLabels.providers.length)?item.tagLabels.providers:item.tags.providers;
 const modelLabels=(item.tagLabels&&item.tagLabels.models&&item.tagLabels.models.length)?item.tagLabels.models:item.tags.models;
 const providerTags=providerLabels.map(function(label,index){const providerId=item.tags.providers[index]||label;const route=item.providerRoutes&&item.providerRoutes[providerId];return route?'<a class="newsTag provider" href="'+escapeHtml(route)+'">'+escapeHtml(label)+'</a>':'<span class="newsTag provider">'+escapeHtml(label||providerId||'')+'</span>'}).join('');
 const modelTags=modelLabels.map(function(label,index){const modelId=item.tags.models[index]||label;const route=item.modelRoutes&&item.modelRoutes[modelId];return route?'<a class="newsTag model" href="'+escapeHtml(route)+'">'+escapeHtml(label)+'</a>':'<span class="newsTag model">'+escapeHtml(label)+'</span>'}).join('');
 return '<article class="newsCard" data-news-card><div class="newsMeta"><time datetime="'+escapeHtml(item.publishedAt||'')+'">'+escapeHtml(formatTime(item.publishedAt))+'</time><span>'+escapeHtml(item.source)+'</span></div><h3><a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(item.title)+'</a></h3>'+(item.summary?'<p>'+escapeHtml(item.summary)+'</p>':'')+'<div class="newsTags">'+providerTags+modelTags+'</div><div class="newsActions"><a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener noreferrer">查看原文 ↗</a></div></article>';
}
function appendItems(items){
 const groups=new Map();
 items.forEach(function(item){const date=formatDate(item.publishedAt);if(!groups.has(date))groups.set(date,[]);groups.get(date).push(item)});
 groups.forEach(function(groupItems,date){
   let section=Array.from(timeline.querySelectorAll('.newsDateGroup')).find(function(node){return (node.querySelector('h2')||{}).textContent===date});
   if(!section){section=document.createElement('section');section.className='newsDateGroup';section.innerHTML='<h2>'+escapeHtml(date)+'</h2><div class="newsDateItems"></div>';timeline.appendChild(section)}
   const list=section.querySelector('.newsDateItems');
   list.insertAdjacentHTML('beforeend',groupItems.map(renderCard).join(''));
 });
}
window.loadNextNewsPage=function loadNextNewsPage(){
 if(!remaining.length){if(sentinel)sentinel.remove();return}
 appendItems(remaining.splice(0,pageSize));
 if(!remaining.length&&sentinel)sentinel.remove();
}
if('IntersectionObserver' in window&&sentinel){new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting}))window.loadNextNewsPage()},{rootMargin:'600px'}).observe(sentinel)}
else if(sentinel){window.addEventListener('scroll',function(){if(sentinel.getBoundingClientRect().top<window.innerHeight+600)window.loadNextNewsPage()},{passive:true})}
})();</script>`
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

function renderDateGroup(group: { date: string; items: ModelNewsItem[] }): string {
  return `<section class="newsDateGroup"><h2>${escapeHtml(group.date)}</h2><div class="newsDateItems">${group.items.map(renderNewsCard).join('')}</div></section>`
}

function renderNewsCard(item: ModelNewsItem): string {
  const providerLabels = item.tagLabels?.providers?.length ? item.tagLabels.providers : item.tags.providers
  const modelLabels = item.tagLabels?.models?.length ? item.tagLabels.models : item.tags.models
  const providerTags = providerLabels.map((label, index) => {
    const providerId = item.tags.providers[index] ?? label
    const route = item.providerRoutes?.[providerId]
    return route ? `<a class="newsTag provider" href="${escapeHtml(route)}">${escapeHtml(label)}</a>` : `<span class="newsTag provider">${escapeHtml(label ?? providerId ?? '')}</span>`
  }).join('')
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

const NEWS_PAGE_SIZE = 20

type ActivePage = 'home' | 'models'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#fff;--fg:#171717;--muted:#666;--soft:#fafafa;--line:#eaeaea;--line2:#f2f2f2;--blue:#2563eb;--green:#0a7f42;--shadow:rgba(0,0,0,.06) 0 1px 2px,rgba(0,0,0,.04) 0 6px 20px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-feature-settings:'liga'}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1360px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:22px}.brandmark{font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:10px}.brandZh{color:#666;font-weight:500;letter-spacing:0;font-size:14px;border-left:1px solid var(--line);padding-left:10px}.logo{width:22px;height:22px;border-radius:7px;background:#171717;display:inline-grid;place-items:center;color:#fff}.logo svg{width:15px;height:15px;display:block}.topSearch{width:300px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#7a7a7a;display:flex;align-items:center;gap:8px;padding:0 13px;font-size:13px}.topSearch input{border:0;background:transparent;outline:0;width:100%;font:inherit;color:#333}.topSearch input::placeholder{color:#999}.navlinks{display:flex;gap:20px;margin-left:auto;font-size:14px;color:#555}.navlinks a,.navlinks span{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#111;border-bottom-color:#111}.githubLink{width:34px;height:34px;border:1px solid var(--line);border-radius:999px;display:inline-grid;place-items:center;color:#555;background:#fff;flex:0 0 34px}.githubLink:hover{color:#111;border-color:#cfcfcf;background:#fafafa}.githubLink svg{width:18px;height:18px;display:block}.currencyControl{display:inline-flex;align-items:center}.currencyToggle{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);border-radius:999px;padding:3px;background:#fff}.currencyToggle button{border:0;border-radius:999px;background:transparent;color:#666;font:600 12px Geist,system-ui,sans-serif;padding:6px 10px;cursor:pointer}.currencyToggle button.active{background:#111;color:#fff}.modelsShell{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;max-width:1360px;margin:0 auto;padding:28px 24px 72px}.newsShell{max-width:920px;margin:0 auto;padding:28px 24px 72px}.filterPanel{position:sticky;top:80px;align-self:start;border:1px solid var(--line);border-radius:16px;background:#fff;padding:18px;box-shadow:var(--shadow)}.filterGroup{border-bottom:1px solid var(--line2);padding-bottom:16px;margin-bottom:16px}.filterGroup:last-child{border-bottom:0;margin-bottom:0;padding-bottom:0}.filterGroup h3{font-size:13px;margin:0 0 10px;color:#333}.filterHint{color:#999;font-size:12px;margin-top:8px;line-height:1.7}.mainPanel{min-width:0}.plazaHead{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:4px 0 18px}.plazaHead h1{font-size:32px;letter-spacing:-1px;margin:0}.rawIntro{max-width:880px;color:#666;line-height:1.7;margin:8px 0 0}.listCount{color:#555;font-size:14px}.listCount b{color:#111}.newsTimeline{display:grid;gap:22px}.newsDateGroup{display:grid;grid-template-columns:110px minmax(0,1fr);gap:18px}.newsDateGroup h2{margin:2px 0 0;color:#555;font-size:15px;position:sticky;top:82px;height:max-content}.newsDateItems{display:grid;gap:12px}.newsCard{border:1px solid var(--line);border-radius:16px;background:#fff;padding:16px 18px;box-shadow:var(--shadow)}.newsMeta{display:flex;gap:10px;flex-wrap:wrap;color:#777;font-size:13px}.newsMeta time{color:#555;font-family:Geist Mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.newsCard h3{font-size:19px;line-height:1.38;margin:9px 0;letter-spacing:-.2px}.newsCard h3 a:hover{color:#111;text-decoration:underline}.newsCard p{color:#666;line-height:1.72;margin:0 0 13px}.newsTags{display:flex;gap:8px;flex-wrap:wrap}.newsTag{display:inline-flex;border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:3px 9px;font-size:12px;color:#555}.newsTag.provider{color:var(--green)}.newsTag.model{color:var(--blue)}.newsActions{margin-top:13px}.newsActions a{color:#333;font-size:14px}.newsActions a:hover{text-decoration:underline}.footer{border-top:1px solid var(--line);color:#777;padding:26px 0}.wrap{max-width:1360px;margin:0 auto;padding:0 24px}.muted{color:#777}@media(max-width:900px){.modelsShell{grid-template-columns:1fr}.filterPanel{position:static}.topSearch{display:none}.nav{gap:12px}.brandZh{display:none}.newsDateGroup{grid-template-columns:1fr}.newsDateGroup h2{position:static}.newsShell{padding:24px 18px 64px}}@media(max-width:720px){.nav{height:auto;min-height:56px;padding:10px 14px;gap:10px;flex-wrap:wrap}.brandmark{gap:8px;min-width:0}.brandmark span:not(.logo):not(.brandZh){font-size:15px}.brandZh{display:none}.githubLink{order:2}.navlinks{order:3;margin-left:0;gap:12px;font-size:13px}.navlinks a{padding:8px 0 6px}.currencyControl{order:4;margin-left:auto}.currencyToggle button{padding:5px 8px;font-size:11px}.topSearch{order:5;width:100%;display:flex;height:34px}.newsShell{padding:20px 14px 56px}.plazaHead{align-items:flex-start;flex-direction:column;margin-bottom:16px}.plazaHead h1,.newsHero h1{font-size:34px;letter-spacing:-1.1px}.rawIntro{font-size:14px;line-height:1.6}.newsTimeline{gap:18px}.newsDateGroup{grid-template-columns:1fr;gap:10px}.newsDateGroup h2{position:static;font-size:14px;margin:0;color:#777}.newsCard{padding:16px;border-radius:14px}.newsCard h3{font-size:18px}.newsMeta{font-size:12px}.newsTags{gap:6px}.wrap{padding:0 14px}.footer{padding:22px 0}}
`

function page(title: string, body: string, activePage: ActivePage, navExtra = ''): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${nav(activePage, navExtra)}${body}${footer()}</body></html>`
}

function nav(activePage: ActivePage, navExtra = ''): string {
  const homeClass = activePage === 'home' ? ' class="active"' : ''
  const modelsClass = activePage === 'models' ? ' class="active"' : ''
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/">${databaseLogo()}<span>mddb.dev</span><span class="brandZh">大模型数据库</span></a><label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / author / source" autocomplete="off"></label><a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">${githubLogo()}</a><div class="navlinks"><a${homeClass} href="/">模型动态</a><a${modelsClass} href="/models/">模型广场</a></div>${navExtra}</nav></header>`
}

function currencyToggle(graph: OpenRouterRawGraph): string {
  const currency = graph.currency
  if (!currency) return ''
  const title = `${formatDisplayNumber(1)} USD / ${formatDisplayNumber(currency.rate)} CNY · ${currency.source}`
  return `<div class="currencyControl"><div class="currencyToggle" data-currency-toggle title="${escapeHtml(title)}"><button type="button" class="active" data-currency="USD">1 USD</button><button type="button" data-currency="CNY">${escapeHtml(formatDisplayNumber(currency.rate))} CNY</button></div></div>`
}

function formatDisplayNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(4)))
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
