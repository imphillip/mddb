import { buildModelGallery, getModelDetail, type ModelDetail, type ModelGallery, type ModelMetaItem, type ModelSummary, type ModelVariant } from './model-catalog.js'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#fff;--fg:#171717;--muted:#666;--soft:#fafafa;--line:#eaeaea;--line2:#f2f2f2;--blue:#2563eb;--green:#0a7f42;--shadow:rgba(0,0,0,.06) 0 1px 2px,rgba(0,0,0,.04) 0 6px 20px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-feature-settings:'liga'}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1360px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:22px}.brandmark{font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:10px}.logo{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#171717,#737373)}.topSearch{width:260px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#7a7a7a;display:flex;align-items:center;gap:8px;padding:0 13px;font-size:13px}.navlinks{display:flex;gap:20px;margin-left:auto;font-size:14px;color:#555}.navlinks a{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#111;border-bottom-color:#111}.wrap{max-width:1180px;margin:0 auto;padding:0 24px}.homeEmpty{min-height:calc(100vh - 60px);display:grid;place-items:center;text-align:center}.homeEmpty h1{font-size:52px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.homeEmpty p{color:var(--muted);font-size:16px}.eyebrow{font:500 12px 'Geist Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:#777}.modelsShell{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:268px minmax(0,1fr);min-height:calc(100vh - 60px)}.filterPanel{border-right:1px solid var(--line);padding:28px 18px 48px;background:#fff}.filterTitle{font-size:13px;font-weight:600;margin:0 0 12px;color:#333}.filterGroup{border-bottom:1px solid var(--line2);padding:14px 0}.filterHead{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500}.filterOption{display:flex;align-items:center;gap:9px;padding:8px 0;color:#555;font-size:14px}.check{width:16px;height:16px;border:1px solid #cfcfcf;border-radius:4px;display:inline-grid;place-items:center;font-size:11px;color:#fff}.check.on{background:#111;border-color:#111}.mainPanel{padding:30px 32px 80px;overflow:hidden}.plazaHead{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.plazaHead h1{font-size:38px;letter-spacing:-1.6px;margin:0}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.modelSearch{width:260px;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit}.btn{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 12px;font-weight:500;color:#333}.iconBtn{width:38px;padding:0}.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:8px;overflow:auto}.tab{display:flex;gap:6px;align-items:center;padding:12px 10px 10px;border-bottom:2px solid transparent;color:#666;font-size:14px;white-space:nowrap}.tab.active{color:#111;border-bottom-color:#111}.tab b{font-weight:500}.tableWrap{overflow:auto}.modelTable{width:100%;border-collapse:collapse;min-width:720px}.modelTable th{text-align:left;color:#777;font-size:12px;font-weight:500;padding:13px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.modelTable td{padding:16px 12px;border-bottom:1px solid var(--line2);vertical-align:middle;font-size:14px}.modelName{display:flex;align-items:center;gap:11px;min-width:270px}.modelIcon{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:#fafafa;display:grid;place-items:center;font-weight:600;font-size:13px;overflow:hidden}.modelIcon img{max-width:20px;max-height:20px}.providerIcon{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);background:#fff;display:inline-grid;place-items:center;vertical-align:middle;margin-right:8px;overflow:hidden;font-size:11px}.providerIcon img{max-width:16px;max-height:16px}.modelLink{font-weight:500}.modelLink:hover{text-decoration:underline;text-underline-offset:3px}.modelSub{color:#777;font-size:12px;margin-top:4px}.modelTagCopy{display:inline-flex;align-items:center;gap:6px;color:#555}.modelTagCopy code{background:#f5f5f5;border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:11px}.copyTagBtn{border:1px solid var(--line);border-radius:999px;background:#fff;color:#555;padding:2px 7px;font:500 11px Geist,system-ui,sans-serif;cursor:pointer}.copyTagBtn:hover{border-color:#cfcfcf;color:#111;background:#fafafa}.pill{display:inline-flex;align-items:center;border-radius:999px;background:#f5f7ff;color:#1d4ed8;padding:2px 8px;font-size:12px;font-weight:500}.mono{font-family:'Geist Mono',ui-monospace,monospace}.muted{color:var(--muted)}.detailHero{border-bottom:1px solid var(--line);padding:64px 0 36px;background:linear-gradient(180deg,#fafafa,#fff)}.detailHero h1{font-size:54px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.detailHero p{max-width:760px;color:#4d4d4d;line-height:1.7;font-size:18px}.detailGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:28px;padding-top:38px;padding-bottom:80px}.toc{display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:24px}.toc a{font-size:14px;color:#666}.toc a:hover{color:#171717}.panel{box-shadow:var(--shadow);border:1px solid var(--line);border-radius:12px;background:#fff;padding:22px;margin-bottom:16px}.panel h2{font-size:28px;letter-spacing:-1px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.metabox{background:#fafafa;border-radius:8px;padding:10px;border:1px solid var(--line)}.metabox span{display:block;color:#808080;font-size:11px;text-transform:uppercase}.metabox b{font-size:13px;overflow-wrap:anywhere}.metaWide{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.providerRow,.variant{border-top:1px solid var(--line);padding:16px 0}.providerRow:first-of-type,.variant:first-of-type{border-top:0}.rowTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.providers{font-size:13px;color:#4d4d4d;line-height:1.5}.providers strong{color:#171717}.priceGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.apiBox{background:#171717;color:#fff;border-radius:10px;padding:16px;font-family:'Geist Mono',monospace;font-size:13px;overflow:auto}.footer{border-top:1px solid var(--line);padding:28px 24px;color:#666;font-size:13px}@media(max-width:900px){.topSearch{display:none}.navlinks{gap:14px}.modelsShell,.detailGrid{grid-template-columns:1fr}.filterPanel{border-right:0;border-bottom:1px solid var(--line)}.plazaHead{align-items:flex-start;flex-direction:column}.modelSearch{width:100%}.meta{grid-template-columns:1fr}.detailHero h1{font-size:42px}}
`

type ActivePage = 'home' | 'models'

function page(title: string, body: string, activePage: ActivePage): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${nav(activePage)}${body}<script>${copyModelTagScript()}</script>${footer()}</body></html>`
}

function nav(activePage: ActivePage): string {
  const homeClass = activePage === 'home' ? ' class="active"' : ''
  const modelsClass = activePage === 'models' ? ' class="active"' : ''
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/"><span class="logo"></span><span>mddb.dev</span></a><div class="topSearch">⌕ Search</div><div class="navlinks"><a${homeClass} href="/">模型动态</a><a${modelsClass} href="/models/">模型广场</a></div></nav></header>`
}

function footer(): string {
  return `<footer class="footer"><div class="wrap">mddb.dev · Model metadata for humans and machines.</div></footer>`
}

export function renderHomePage(): string {
  return page('模型动态 · mddb.dev', `<main class="homeEmpty"><div><div class="eyebrow">Model Updates</div><h1>模型动态</h1><p>首页暂时留空。</p></div></main>`, 'home')
}

export function renderModelsPage(gallery: ModelGallery = buildModelGallery()): string {
  return page('模型广场 · mddb.dev', `<main class="modelsShell"><aside class="filterPanel" aria-label="模型筛选"><div class="filterTitle">筛选</div>${renderFilterGroups(gallery)}</aside><section class="mainPanel"><div class="plazaHead"><h1>模型广场</h1></div><div class="tableWrap"><table class="modelTable"><thead><tr><th>Model Name</th><th>Input</th><th>Output</th><th>Context</th><th>Released</th></tr></thead><tbody>${gallery.models.map(renderModelRow).join('')}</tbody></table></div><script>${modelFilterScript()}</script></section></main>`, 'models')
}

function renderFilterGroups(gallery: ModelGallery): string {
  return renderFilterGroup('厂牌', 'brand', gallery.brands.map((brand) => ({ label: brand.name, value: brand.slug, count: brand.models.length })))
}

function renderFilterGroup(title: string, group: string, options: Array<{ label: string; value: string; count: number }>): string {
  const renderedOptions = options
    .filter((option) => option.count > 0)
    .map((option) => `<label class="filterOption"><input type="checkbox" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span><small>${option.count}</small></label>`)
    .join('')

  return `<div class="filterGroup"><div class="filterHead"><span>${escapeHtml(title)}</span><span>⌄</span></div>${renderedOptions}</div>`
}

function renderModelRow(model: ModelSummary): string {
  return `<tr data-model-row data-model-brand="${escapeHtml(model.brand.slug)}" data-model-modalities="${escapeHtml(model.modalities.join(' '))}" data-model-providers="${escapeHtml(model.providerNames.map(providerFilterValue).join(' '))}" data-model-name="${escapeHtml(`${model.brand.name}: ${model.name}`.toLowerCase())}" data-model-released="${escapeHtml(model.releasedAt)}" data-model-provider-count="${model.providerNames.length}"><td><div class="modelName">${renderLogoIcon(model.brand.logoUrl, `${model.brand.name} logo`, model.brand.name.slice(0, 1), 'modelIcon')}<div><a class="modelLink" href="${model.route}/">${escapeHtml(model.brand.name)}: ${escapeHtml(model.name)}</a><div class="modelSub">${renderModelTagCopy(model.tag)}</div><div class="modelSub">${escapeHtml(model.modalities.join(' · '))} · ${escapeHtml(model.providerNames.length.toString())} providers</div></div></div></td><td class="mono">${escapeHtml(priceShort(model.inputPrice))}</td><td class="mono">${escapeHtml(priceShort(model.outputPrice))}</td><td class="mono">${escapeHtml(contextShort(model.contextWindow))}</td><td>${escapeHtml(formatDate(model.releasedAt))}</td></tr>`
}

export function renderModelDetailPage(tag: string, details?: ModelDetail[]): string {
  const model = details?.find((candidate) => candidate.tag === tag) ?? getModelDetail(tag)
  if (model === undefined) {
    return page('模型未找到 · mddb.dev', `<main class="wrap" style="padding:80px 24px"><h1>模型未找到</h1><p class="muted">没有找到 ${escapeHtml(tag)}。</p></main>`, 'models')
  }

  return page(`${model.name} · mddb.dev`, `<main><section class="detailHero"><div class="wrap"><div class="eyebrow">${escapeHtml(model.brand.name)} / ${renderModelTagCopy(model.tag)}</div><h1>${escapeHtml(model.name)}</h1><p>${escapeHtml(model.longDescription)}</p></div></section><div class="wrap detailGrid"><article><nav class="toc" aria-label="Model page sections"><a href="#overview">Overview</a><a href="#meta">Meta</a><a href="#providers">Providers</a><a href="#variants">Variants</a><a href="#pricing">Pricing</a><a href="#benchmarks">Benchmarks</a><a href="#api">API</a></nav><section id="overview" class="panel"><h2>Overview</h2><p class="muted">${escapeHtml(model.description)}</p><div class="meta"><div class="metabox"><span>MODALITIES</span><b>${escapeHtml(joinChinese(model.modalities))}</b></div><div class="metabox"><span>RELEASED</span><b>${escapeHtml(formatDate(model.releasedAt))}</b></div><div class="metabox"><span>CANONICAL TAG</span><b>${renderModelTagCopy(model.tag)}</b></div></div></section><section id="meta" class="panel"><h2>Meta</h2>${renderModelMeta(model)}</section><section id="providers" class="panel"><h2>Providers</h2>${renderProviders(model)}</section><section id="variants" class="panel"><h2>Variants</h2>${model.variants.map(renderVariant).join('')}</section><section id="benchmarks" class="panel"><h2>Benchmarks</h2>${model.benchmarks.map((b) => `<div class="providerRow"><div class="rowTop"><strong>${escapeHtml(b.name)}</strong><span class="pill">${escapeHtml(b.score)}</span></div><p class="muted">${escapeHtml(b.note)}</p></div>`).join('')}</section><section id="api" class="panel"><h2>API</h2><div class="apiBox">GET /models/${escapeHtml(model.tag)}<br>{<br>&nbsp;&nbsp;"modelTag": "${escapeHtml(model.tag)}",<br>&nbsp;&nbsp;"variants": ${model.variants.length}<br>}</div></section></article><aside><div id="pricing" class="panel"><h2>Pricing</h2><div class="priceGrid"><div class="metabox"><span>INPUT PRICE</span><b>${escapeHtml(model.inputPrice)}</b></div><div class="metabox"><span>OUTPUT PRICE</span><b>${escapeHtml(model.outputPrice)}</b></div><div class="metabox"><span>CONTEXT</span><b>${escapeHtml(model.contextWindow)}</b></div><div class="metabox"><span>VARIANTS</span><b>${model.variants.length}</b></div></div></div><div class="panel"><h2>Providers</h2><p class="muted">${escapeHtml(joinChinese(model.providerNames))}</p></div></aside></div></main>`, 'models')
}

function renderModelTagCopy(tag: string): string {
  const safeTag = escapeHtml(tag)
  return `<span class="modelTagCopy"><code class="mono">${safeTag}</code><button class="copyTagBtn" type="button" data-copy-model-tag="${safeTag}" aria-label="复制 model name tag ${safeTag}">复制</button></span>`
}

function renderLogoIcon(logoUrl: string | undefined, alt: string, fallback: string, className: string): string {
  if (logoUrl) {
    return `<span class="${escapeHtml(className)}"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(alt)}" loading="lazy"></span>`
  }
  return `<span class="${escapeHtml(className)}">${escapeHtml(fallback)}</span>`
}

function renderModelMeta(model: ModelDetail): string {
  if (model.meta.length === 0) return '<p class="muted">暂无更多 meta 信息。</p>'
  return `<div class="meta metaWide">${model.meta.map(renderMetaItem).join('')}</div>`
}

function renderMetaItem(item: ModelMetaItem): string {
  return `<div class="metabox"><span>${escapeHtml(item.label)}</span><b>${escapeHtml(formatMetaValue(item.value))}</b></div>`
}

function formatMetaValue(value: string | string[]): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(' · ') : '—'
  return value || '—'
}

function renderProviders(model: ModelDetail): string {
  const providers = new Map<string, { name: string; logoUrl?: string | undefined; region: string; uptime: string; latency: string; throughput: string }>()
  for (const variant of model.variants) {
    for (const deployment of variant.providers) providers.set(deployment.slug, deployment)
  }
  return Array.from(providers.values()).map((p) => `<div class="providerRow"><div class="rowTop"><strong>${renderLogoIcon(p.logoUrl, `${p.name} logo`, p.name.slice(0, 1), 'providerIcon')}${escapeHtml(p.name)}</strong><span class="pill">Uptime ${escapeHtml(p.uptime)}</span></div><div class="meta"><div class="metabox"><span>Region</span><b>${escapeHtml(p.region)}</b></div><div class="metabox"><span>Latency</span><b>${escapeHtml(p.latency)}</b></div><div class="metabox"><span>Throughput</span><b>${escapeHtml(p.throughput)}</b></div></div></div>`).join('')
}

function renderVariant(variant: ModelVariant): string {
  return `<div class="variant"><div class="rowTop"><div><strong>${escapeHtml(variant.name)}</strong><p class="muted">${escapeHtml(variant.summary)}</p></div><span class="pill">${variant.providers.length || '私有'} 个 Provider</span></div><div class="meta"><div class="metabox"><span>Context</span><b>${escapeHtml(variant.contextWindow)}</b></div><div class="metabox"><span>Input</span><b>${escapeHtml(variant.inputPrice)}</b></div><div class="metabox"><span>Output</span><b>${escapeHtml(variant.outputPrice)}</b></div></div><p class="providers"><strong>差异</strong><br>${escapeHtml(joinChinese(variant.differences))}</p><p class="providers"><strong>Provider</strong><br>${escapeHtml(joinChinese(variant.providers.map((p) => p.name)) || '自托管 / 私有化')}</p></div>`
}

function countByModality(models: ModelSummary[], modality: string): number {
  return models.filter((model) => model.modalities.includes(modality)).length
}

function priceShort(value: string): string {
  return value.replace(' / 1M', '')
}

function contextShort(value: string): string {
  return value.replaceAll('K', ',000').replaceAll('M', ',000,000')
}

function formatDate(value: string): string {
  if (value === '—' || value === '-' || value === 'N/A' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '—'
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

function countOptions(items: Array<{ label: string; value: string }>): Array<{ label: string; value: string; count: number }> {
  const counts = new Map<string, { label: string; value: string; count: number }>()
  for (const item of items) {
    const current = counts.get(item.value)
    if (current === undefined) {
      counts.set(item.value, { ...item, count: 1 })
    } else {
      current.count += 1
    }
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function modalityFilterValue(modality: string): string {
  const map: Record<string, string> = { 文本: 'text', 视觉: 'visual', 推理: 'reasoning', 工具: 'tool', 结构化输出: 'structured-output', 音频: 'audio', 视频: 'video' }
  return map[modality] ?? slugify(modality)
}

function providerFilterValue(provider: string): string {
  return provider
    .toLowerCase()
    .replace(/\b(ai|api|llm|gateway|foundry|models?|cloud|platform|service|services)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)[0] ?? slugify(provider)
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function copyModelTagScript(): string {
  return String.raw`(function(){
const buttons=Array.from(document.querySelectorAll('[data-copy-model-tag]'));
buttons.forEach(button=>button.addEventListener('click',async()=>{
  const tag=button.dataset.copyModelTag||'';
  try{
    await navigator.clipboard.writeText(tag);
    const previous=button.textContent;
    button.textContent='已复制';
    setTimeout(()=>{button.textContent=previous||'复制'},1200);
  }catch(error){
    button.textContent='复制失败';
  }
}));
})();`
}

function modelFilterScript(): string {
  return String.raw`(function(){
const filterInputs=Array.from(document.querySelectorAll('[data-filter-group]'));
const modelRows=Array.from(document.querySelectorAll('[data-model-row]'));
function selected(group){return filterInputs.filter(input=>input.dataset.filterGroup===group&&input.checked).map(input=>input.dataset.filterValue)}
function applyModelFilters(){
  const brands=selected('brand');
  modelRows.forEach(row=>{
    const visible=brands.length===0||brands.includes(row.dataset.modelBrand||'');
    row.hidden=!visible;
  });
}
filterInputs.forEach(input=>input.addEventListener('change',applyModelFilters));
window.applyModelFilters=applyModelFilters;
applyModelFilters();
})();`
}

function joinChinese(values: string[]): string {
  return values.join('、')
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
