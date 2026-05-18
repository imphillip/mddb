import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type Price = {
  currency?: string
  unit?: string
  input?: number
  output?: number
  cache_read?: number
  cache_write?: number
  input_batch?: number
  output_batch?: number
  input_priority?: number
  output_priority?: number
  source?: string
}

type Offer = {
  source?: string
  source_model_id?: string
  api_model_id?: string
  model?: string
  model_match?: string
  mode?: string | null
  path?: string | null
  prices?: Price[]
  limits?: { context_window?: number; max_output_tokens?: number }
  features?: string[]
  endpoint_observations?: Array<Record<string, unknown>>
}

type Provider = {
  id: string
  name?: string
  roles?: string[]
  base_url?: string | null
  source?: string
  offers?: Offer[]
}

type NewRegistry = {
  providers: Provider[]
  offers: Array<Offer & { provider: Provider; route: string; endpoint: string }>
  stats: { providerCount: number; offerCount: number; pricedOfferCount: number; sourceMode: string }
}

export function readNewRegistry(root = process.cwd()): NewRegistry | null {
  const dir = join(root, '.internal', 'next-registry', 'providers')
  if (!existsSync(dir)) return null
  const providers = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Provider)
    .sort((a, b) => a.id.localeCompare(b.id))
  const offers = providers.flatMap((provider) => (provider.offers ?? []).map((offer) => ({
    ...offer,
    provider,
    route: `/new-models/${slug(provider.id)}/${slug(offer.model ?? offer.api_model_id ?? offer.source_model_id ?? 'unknown')}/`,
    endpoint: endpointFor(provider, offer),
  })))
  return {
    providers,
    offers,
    stats: {
      providerCount: providers.length,
      offerCount: offers.length,
      pricedOfferCount: offers.filter((offer) => (offer.prices ?? []).length > 0).length,
      sourceMode: sourceModeFor(root),
    },
  }
}

export function renderNewModelsHome(registry: NewRegistry): string {
  const providerOptions = providerFilterOptions(registry)
  const rows = registry.offers
    .slice()
    .sort((a, b) => providerLabel(a.provider).localeCompare(providerLabel(b.provider)) || displayModel(a).localeCompare(displayModel(b)))
    .map(renderOfferRow)
    .join('')
  const body = `<main class="modelsShell"><aside class="filterPanel" aria-label="新模型筛选"><div class="filterGroup"><div class="filterHead"><span>Provider</span><span>⌄</span></div>${renderProviderFilterOption({ label: '全部', value: 'all', count: registry.offers.length }, true)}${providerOptions.map((option) => renderProviderFilterOption(option)).join('')}</div><div class="filterGroup"><h3>实验数据</h3><p class="filterHint">${escapeHtml(registry.stats.sourceMode)}。用于观察新 schema，不代表正式目录。</p><p class="filterHint">${registry.stats.providerCount} providers · ${registry.stats.offerCount} offers · ${registry.stats.pricedOfferCount} priced</p></div></aside><section class="mainPanel"><div class="plazaHead"><div><h1>New Models 实验目录</h1><p class="rawIntro">基于 .internal/next-registry 的 provider/offer 数据预览。</p></div></div><div class="tableWrap"><table class="modelTable"><thead><tr><th>模型</th><th>上下文</th><th>输入<br><small>/M tokens</small></th><th>输出<br><small>/M tokens</small></th><th>读取<br><small>/M tokens</small></th><th>Endpoint</th></tr></thead><tbody id="rows">${rows}</tbody></table></div><script>${newModelsFilterScript()}</script></section></main>`
  return page('New Models · mddb.dev', body, 'models')
}

export function renderNewModelDetail(registry: NewRegistry, offer: NewRegistry['offers'][number]): string {
  const provider = offer.provider
  const related = registry.offers.filter((candidate) => candidate.model === offer.model).slice(0, 20)
  const relatedLinks = related.map((candidate) => `<a class="relationChip" href="${escapeHtml(candidate.route)}"><small>${escapeHtml(candidate.provider.id)}</small>${escapeHtml(candidate.api_model_id ?? candidate.source_model_id ?? candidate.model ?? 'unknown')}</a>`).join('')
  const body = `<main><section class="detailHero detailHeroCompact"><div class="wrap"><a class="btn backToPlaza" href="/new-models/">← 返回 New Models</a><div class="eyebrow">Provider · ${escapeHtml(providerLabel(provider))}</div><h1>${escapeHtml(displayModel(offer))}</h1><div class="modelIdHero">API Model ID ${renderCopy(offer.api_model_id ?? offer.source_model_id ?? '')}</div>${relatedLinks ? `<div class="heroRelations"><div class="relationChips">${relatedLinks}</div></div>` : ''}</div></section><div class="wrap detailSingle databaseDetail"><article><nav class="toc" aria-label="模型页面章节"><a href="#spec">规格</a><a href="#pricing">价格</a><a href="#endpoint">Endpoint</a><a href="#source">数据来源</a></nav>${renderSpecSection(offer)}${renderPriceSection(offer)}${renderEndpointSection(offer)}${renderSourceSection(offer)}</article></div></main>`
  return page(`${displayModel(offer)} · ${providerLabel(provider)} · mddb.dev`, body, 'models')
}

function renderOfferRow(offer: NewRegistry['offers'][number]): string {
  const price = firstPrice(offer)
  const modalities = `${offer.mode ?? 'unknown'} · ${offer.source ?? 'source unknown'}`
  return `<tr data-model-row data-model-provider="${escapeHtml(offer.provider.id)}" data-model-name="${escapeHtml(`${displayModel(offer)} ${offer.provider.id} ${offer.api_model_id ?? ''} ${offer.source_model_id ?? ''}`.toLowerCase())}"><td><div class="modelName"><span class="modelIcon">${escapeHtml(providerLabel(offer.provider).slice(0, 1))}</span><div><a class="modelLink" href="${escapeHtml(offer.route)}">${escapeHtml(displayModel(offer))}</a><div class="modelSub">${renderCopy(offer.api_model_id ?? offer.source_model_id ?? '')}</div><div class="modelSub rawSource">${escapeHtml(providerLabel(offer.provider))} · ${escapeHtml(modalities)}</div></div></div></td><td class="mono">${escapeHtml(formatLimit(offer.limits?.context_window))}</td><td class="mono">${formatDirectPrice(price?.input, price?.currency)}</td><td class="mono">${formatDirectPrice(price?.output, price?.currency)}</td><td class="mono">${formatDirectPrice(price?.cache_read, price?.currency)}</td><td class="mono rawSource">${escapeHtml(offer.endpoint || '—')}</td></tr>`
}

function renderSpecSection(offer: NewRegistry['offers'][number]): string {
  return `<section id="spec" class="panel"><h2>规格</h2><div class="specRows"><div class="specRow">${kv('Provider', providerLabel(offer.provider))}${kv('Mode', offer.mode ?? '—')}</div><div class="specRow">${kv('Model match', offer.model_match ?? '—')}${kv('Canonical/Candidate model', offer.model ?? '—')}</div><div class="specRow">${kv('Context length', formatLimit(offer.limits?.context_window))}${kv('Max output tokens', formatLimit(offer.limits?.max_output_tokens))}</div><div class="specRow">${kv('Features', (offer.features ?? []).join(' · ') || '—')}</div></div></section>`
}

function renderPriceSection(offer: NewRegistry['offers'][number]): string {
  const prices = offer.prices ?? []
  const cards = prices.map((price) => `<div class="priceVariantCard"><dl class="priceList">${priceRow('Input', price.input, price.currency)}${priceRow('Output', price.output, price.currency)}${priceRow('Cache read', price.cache_read, price.currency)}${priceRow('Cache write', price.cache_write, price.currency)}${priceRow('Batch input', price.input_batch, price.currency)}${priceRow('Batch output', price.output_batch, price.currency)}${priceRow('Priority input', price.input_priority, price.currency)}${priceRow('Priority output', price.output_priority, price.currency)}</dl><p class="filterHint">${escapeHtml(price.unit ?? '')} · ${price.source ? `<a href="${escapeHtml(price.source)}">source</a>` : 'source unknown'}</p></div>`).join('')
  return `<section id="pricing" class="panel"><h2>价格</h2>${cards || '<p class="muted">暂无结构化价格。</p>'}</section>`
}

function renderEndpointSection(offer: NewRegistry['offers'][number]): string {
  return `<section id="endpoint" class="panel"><h2>Endpoint</h2><div class="meta metaWide">${kv('Base URL', offer.provider.base_url ?? '—')}${kv('Path', offer.path ?? '—')}${kv('Callable endpoint', offer.endpoint || '—')}${kv('API model ID', renderCopy(offer.api_model_id ?? '—'))}</div></section>`
}

function renderSourceSection(offer: NewRegistry['offers'][number]): string {
  return `<section id="source" class="panel subtlePanel"><details><summary><h2>数据来源与源数据</h2></summary><div class="meta metaWide">${kv('Source', offer.source ?? '—')}${kv('Source model ID', renderCopy(offer.source_model_id ?? '—'))}${kv('Provider file', `${offer.provider.id}.json`)}</div><details class="moreBlock"><summary>raw offer</summary><pre class="raw">${escapeHtml(JSON.stringify(offer, null, 2))}</pre></details></details></section>`
}

function providerFilterOptions(registry: NewRegistry): Array<{ label: string; value: string; count: number }> {
  return registry.providers.map((provider) => ({ label: providerLabel(provider), value: provider.id, count: provider.offers?.length ?? 0 })).filter((option) => option.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function renderProviderFilterOption(option: { label: string; value: string; count: number }, checked = false): string {
  return `<label class="filterOption"><input type="radio" name="provider-filter" data-new-provider-filter="${escapeHtml(option.value)}"${checked ? ' checked' : ''}><span>${escapeHtml(option.label)}</span><small>${option.count}</small></label>`
}

function endpointFor(provider: Provider, offer: Offer): string {
  if (!provider.base_url || !offer.path) return ''
  return `${provider.base_url.replace(/\/$/u, '')}/${offer.path.replace(/^\//u, '')}`
}

function sourceModeFor(root: string): string {
  const path = join(root, '.internal', 'next-registry', 'reports', 'source-stats.json')
  if (!existsSync(path)) return 'unknown'
  try {
    const stats = JSON.parse(readFileSync(path, 'utf8')) as { source_mode?: string }
    return stats.source_mode ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function displayModel(offer: Offer): string { return offer.model ?? offer.api_model_id ?? offer.source_model_id ?? 'unknown' }
function providerLabel(provider: Provider): string { return provider.name && provider.name !== provider.id ? provider.name : title(provider.id) }
function title(value: string): string { return value.split(/[-_]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ') }
function firstPrice(offer: Offer): Price | undefined { return (offer.prices ?? [])[0] }
function formatLimit(value: unknown): string { return typeof value === 'number' ? value.toLocaleString('en-US') : '—' }
function formatDirectPrice(value: unknown, currency = 'USD'): string { return typeof value === 'number' ? `<code>${currencySymbol(currency)}${formatNumber(value)}</code>` : '—' }
function currencySymbol(currency = 'USD'): string { return currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} ` }
function formatNumber(value: number): string { return value.toLocaleString('en-US', { maximumFractionDigits: 4 }) }
function priceRow(label: string, value: unknown, currency = 'USD'): string { return typeof value === 'number' ? `<div class="priceItem"><dt>${escapeHtml(label)}</dt><dd>${formatDirectPrice(value, currency)} <span class="muted">per 1M tokens</span></dd></div>` : '' }
function kv(label: string, value: string): string { return `<div class="metabox"><span>${escapeHtml(label)}</span><b>${value}</b></div>` }
function renderCopy(value: string): string { const safe = escapeHtml(value); return `<span class="modelTagCopy"><code class="mono">${safe}</code><button class="copyTagBtn" type="button" data-copy-model-tag="${safe}" aria-label="复制 ${safe}" title="复制">复制</button></span>` }
function slug(value: string): string { return String(value).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/^-|-$/g, '') || 'unknown' }

function newModelsFilterScript(): string {
  return String.raw`(function(){
const inputs=Array.from(document.querySelectorAll('[data-new-provider-filter]'));
const rows=Array.from(document.querySelectorAll('[data-model-row]'));
const q=document.getElementById('q');
function selected(){const input=inputs.find(i=>i.checked);return input?input.dataset.newProviderFilter:'all'}
function apply(){const provider=selected();const query=(q&&q.value||'').toLowerCase();rows.forEach(row=>{const okProvider=provider==='all'||row.dataset.modelProvider===provider;const okQuery=!query||(row.dataset.modelName||row.innerText||'').toLowerCase().includes(query);row.hidden=!(okProvider&&okQuery);});}
inputs.forEach(input=>input.addEventListener('change',apply));
if(q)q.addEventListener('input',apply);
apply();
})();`
}

function page(title: string, body: string, activePage: 'models'): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/assets/new-models.css?v=20260518-scroll"><style>.filterPanel{position:static!important;top:auto!important;align-self:start!important}</style></head><body>${nav(activePage)}${body}<script>${copyModelTagScript()}</script>${footer()}</body></html>`
}

function nav(activePage: 'models'): string {
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/"><span class="logo">◆</span><span>mddb.dev</span><span class="brandZh">大模型数据库</span></a><label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / endpoint" autocomplete="off"></label><a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">GitHub</a><div class="navlinks"><a href="/">模型动态</a><a${activePage === 'models' ? ' class="active"' : ''} href="/models/">模型广场</a><a class="active" href="/new-models/">New Models</a></div></nav></header>`
}
function footer(): string { return `<footer class="footer"><div class="wrap">mddb.dev · New registry experiment.</div></footer>` }
function copyModelTagScript(): string { return String.raw`(function(){document.querySelectorAll('[data-copy-model-tag]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.copyModelTag||'');button.textContent='已复制';setTimeout(()=>button.textContent='复制',1200)}catch(e){button.textContent='失败'}}));})();` }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)) }
