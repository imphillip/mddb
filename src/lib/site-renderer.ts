import { buildModelGallery, getModelDetail, type ModelDetail, type ModelGallery, type ModelMetaItem, type ModelSummary, type ModelVariant } from './model-catalog.js'
import { normalizeModelTagCandidate, stripSnapshotSuffix } from './model-normalization.js'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#fff;--fg:#171717;--muted:#666;--soft:#fafafa;--line:#eaeaea;--line2:#f2f2f2;--blue:#2563eb;--green:#0a7f42;--shadow:rgba(0,0,0,.06) 0 1px 2px,rgba(0,0,0,.04) 0 6px 20px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-feature-settings:'liga'}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1360px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:22px}.brandmark{font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:10px}.brandZh{color:#666;font-weight:500;letter-spacing:0;font-size:14px;border-left:1px solid var(--line);padding-left:10px}.logo{width:22px;height:22px;border-radius:7px;background:#171717;display:inline-grid;place-items:center;color:#fff}.logo svg{width:15px;height:15px;display:block}.topSearch{width:260px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#7a7a7a;display:flex;align-items:center;gap:8px;padding:0 13px;font-size:13px}.navlinks{display:flex;gap:20px;margin-left:auto;font-size:14px;color:#555}.navlinks a,.navlinks span{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#111;border-bottom-color:#111}.navlinks .disabled{color:#aaa;cursor:not-allowed;pointer-events:none;border-bottom-color:transparent}.githubLink{width:34px;height:34px;border:1px solid var(--line);border-radius:999px;display:inline-grid;place-items:center;color:#555;background:#fff}.githubLink:hover{color:#111;border-color:#cfcfcf;background:#fafafa}.githubLink svg{width:18px;height:18px;display:block}.wrap{max-width:1180px;margin:0 auto;padding:0 24px}.homeEmpty{min-height:calc(100vh - 60px);display:grid;place-items:center;text-align:center}.homeEmpty h1{font-size:52px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.homeEmpty p{color:var(--muted);font-size:16px}.eyebrow{font:500 12px 'Geist Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:#777}.modelsShell{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:268px minmax(0,1fr);min-height:calc(100vh - 60px)}.filterPanel{border-right:1px solid var(--line);padding:28px 18px 48px;background:#fff}.filterTitle{font-size:13px;font-weight:600;margin:0 0 12px;color:#333}.filterGroup{border-bottom:1px solid var(--line2);padding:14px 0}.filterHead{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500}.filterMore{margin-top:6px}.filterMore summary{cursor:pointer;color:#666;font-size:13px;padding:8px 0;list-style:none}.filterMore summary::-webkit-details-marker{display:none}.filterMore summary::after{content:'展开';float:right;color:#999}.filterMore[open] summary::after{content:'收起'}.filterMore[open] summary{color:#333}.filterOption{display:flex;align-items:center;gap:9px;padding:8px 0;color:#555;font-size:14px}.filterLogo{width:18px;height:18px;border:1px solid var(--line);border-radius:5px;background:#fff;display:inline-grid;place-items:center;flex:0 0 auto;font-size:10px;font-weight:600;color:#555;overflow:hidden}.filterLogo img{max-width:13px;max-height:13px}.check{width:16px;height:16px;border:1px solid #cfcfcf;border-radius:4px;display:inline-grid;place-items:center;font-size:11px;color:#fff}.check.on{background:#111;border-color:#111}.mainPanel{padding:30px 32px 80px;overflow:hidden}.plazaHead{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.plazaHead h1{font-size:38px;letter-spacing:-1.6px;margin:0}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.modelSearch{width:260px;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit}.btn{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 12px;font-weight:500;color:#333}.iconBtn{width:38px;padding:0}.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:8px;overflow:auto}.tab{display:flex;gap:6px;align-items:center;padding:12px 10px 10px;border-bottom:2px solid transparent;color:#666;font-size:14px;white-space:nowrap}.tab.active{color:#111;border-bottom-color:#111}.tab b{font-weight:500}.tableWrap{overflow:auto}.modelTable{width:100%;border-collapse:collapse;min-width:720px}.modelTable th{text-align:left;color:#777;font-size:12px;font-weight:500;padding:13px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.modelTable td{padding:16px 12px;border-bottom:1px solid var(--line2);vertical-align:middle;font-size:14px}.modelName{display:flex;align-items:center;gap:11px;min-width:270px}.modelIcon{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:#fafafa;display:grid;place-items:center;font-weight:600;font-size:13px;overflow:hidden}.modelIcon img{max-width:20px;max-height:20px}.providerIcon{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);background:#fff;display:inline-grid;place-items:center;vertical-align:middle;margin-right:8px;overflow:hidden;font-size:11px}.providerIcon img{max-width:16px;max-height:16px}.modelLink{font-weight:500}.modelLink:hover{text-decoration:underline;text-underline-offset:3px}.modelSub{color:#777;font-size:12px;margin-top:4px}.modelTagCopy{display:inline-flex;align-items:center;gap:6px;color:#555}.modelTagCopy code{background:#f5f5f5;border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:11px}.copyTagBtn{border:1px solid var(--line);border-radius:999px;background:#fff;color:#555;padding:2px 7px;font:500 11px Geist,system-ui,sans-serif;cursor:pointer}.copyTagBtn:hover{border-color:#cfcfcf;color:#111;background:#fafafa}.pill{display:inline-flex;align-items:center;border-radius:999px;background:#f5f7ff;color:#1d4ed8;padding:2px 8px;font-size:12px;font-weight:500}.mono{font-family:'Geist Mono',ui-monospace,monospace}.muted{color:var(--muted)}.detailHero{border-bottom:1px solid var(--line);padding:64px 0 36px;background:linear-gradient(180deg,#fafafa,#fff)}.detailHero h1{font-size:54px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.detailHero p{max-width:760px;color:#4d4d4d;line-height:1.7;font-size:18px}.detailGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:28px;padding-top:38px;padding-bottom:80px}.toc{display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:24px}.toc a{font-size:14px;color:#666}.toc a:hover{color:#171717}.panel{box-shadow:var(--shadow);border:1px solid var(--line);border-radius:12px;background:#fff;padding:22px;margin-bottom:16px}.panel h2{font-size:28px;letter-spacing:-1px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.metabox{background:#fafafa;border-radius:8px;padding:10px;border:1px solid var(--line)}.metabox span{display:block;color:#808080;font-size:11px;text-transform:uppercase}.metabox b{font-size:13px;overflow-wrap:anywhere}.metaWide{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.providerRow,.variant{border-top:1px solid var(--line);padding:16px 0}.providerRow:first-of-type,.variant:first-of-type{border-top:0}.rowTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.providers{font-size:13px;color:#4d4d4d;line-height:1.5}.providers strong{color:#171717}.priceGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.apiBox{background:#171717;color:#fff;border-radius:10px;padding:16px;font-family:'Geist Mono',monospace;font-size:13px;overflow:auto}.footer{border-top:1px solid var(--line);padding:28px 24px;color:#666;font-size:13px}@media(max-width:900px){.topSearch{display:none}.navlinks{gap:14px}.modelsShell,.detailGrid{grid-template-columns:1fr}.filterPanel{border-right:0;border-bottom:1px solid var(--line)}.plazaHead{align-items:flex-start;flex-direction:column}.modelSearch{width:100%}.meta{grid-template-columns:1fr}.detailHero h1{font-size:42px}}

.detailSingle{display:block;max-width:980px;padding-top:38px;padding-bottom:80px}.backToPlaza{display:inline-flex;margin-bottom:22px}.priceVariantGrid{display:grid;gap:14px}.priceVariantCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px}.priceVariantCard+.priceVariantCard{margin-top:0}.detailHeroCompact{padding:52px 0 30px}.summaryStrip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:24px;max-width:900px}.summaryStrip div{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}.summaryStrip span{display:block;color:#777;font-size:12px;margin-bottom:4px}.summaryStrip b{font-size:18px;letter-spacing:-.3px}.priorityPanel{border-color:#dbe7ff;background:linear-gradient(180deg,#fbfdff,#fff)}.subtlePanel{background:#fcfcfc}.stickyCard{position:sticky;top:82px}.availabilityGrid{display:flex;flex-wrap:wrap;gap:8px}.providerChip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;background:#fafafa;padding:7px 11px;font-size:13px;color:#333;line-height:1}.providerCloud{line-height:1.8}.sourceList{display:grid;gap:8px;margin-top:14px}.sourceItem{display:flex;justify-content:space-between;gap:14px;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fafafa}.sourceItem span{color:#666;font-size:13px}.reviewList{margin:0;padding-left:18px;color:#555;line-height:1.7}.specVariant{border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;background:#fff}.specVariant+.specVariant{border-top:1px solid var(--line)}.moreBlock{margin-top:12px;border:1px dashed var(--line);border-radius:12px;padding:12px;background:#fcfcfc}.moreBlock summary{cursor:pointer;color:#555;font-weight:500}.modelTable th{background:#fafafa}.modelTable td,.modelTable th{line-height:1.45}.modelTable td:nth-child(3){text-align:right}.copyTagBtn svg{width:13px;height:13px;display:block}.copyTagBtn.copied{width:auto;padding:2px 7px}@media(max-width:900px){.summaryStrip{grid-template-columns:repeat(2,1fr)}.stickyCard{position:static}.sourceItem{display:block}.sourceItem span{display:block;margin-top:4px}}
`

type ActivePage = 'home' | 'models'

const expandedBrandFilterNames = new Set(['ByteDance', 'MoonshotAI', 'Xiaomi'])
const collapsedBrandFilterNames = new Set(['Arcee AI', 'NVIDIA'])

function page(title: string, body: string, activePage: ActivePage, headExtra = ''): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${headExtra}<style>${css}</style></head><body>${nav(activePage)}${body}<script>${copyModelTagScript()}</script>${footer()}</body></html>`
}

function nav(activePage: ActivePage): string {
  const modelsClass = activePage === 'models' ? ' class="active"' : ''
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/models/">${databaseLogo()}<span>mddb.dev</span><span class="brandZh">大模型数据库</span></a><div class="topSearch">⌕ 搜索</div><div class="navlinks"><span class="disabled" aria-disabled="true">模型动态</span><a${modelsClass} href="/models/">模型广场</a></div><a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">${githubLogo()}</a></nav></header>`
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

export function renderHomePage(): string {
  return page('模型广场 · mddb.dev', `<main class="homeEmpty"><div><div class="eyebrow">正在跳转</div><h1>模型广场</h1><p>正在跳转到模型广场。</p><p><a class="btn" href="/models/">进入模型广场</a></p></div></main>`, 'models', '<meta http-equiv="refresh" content="0;url=/models/"><link rel="canonical" href="/models/">')
}

export function renderModelsPage(gallery: ModelGallery = buildModelGallery()): string {
  return page('模型广场 · mddb.dev', `<main class="modelsShell"><aside class="filterPanel" aria-label="模型筛选"><div class="filterTitle">筛选</div>${renderFilterGroups(gallery)}</aside><section class="mainPanel"><div class="plazaHead"><h1>模型广场</h1></div><div class="tableWrap"><table class="modelTable"><thead><tr><th>模型名称</th><th>输入价格</th><th>输出价格</th><th>上下文</th><th>发布日期</th></tr></thead><tbody>${gallery.models.map(renderModelRow).join('')}</tbody></table></div><script>${modelFilterScript()}</script></section></main>`, 'models')
}

function renderFilterGroups(gallery: ModelGallery): string {
  return renderBrandFilterGroup(gallery.brands.map((brand) => ({ label: brand.name, value: brand.slug, count: brand.models.length, logoUrl: brand.logoUrl })))
}

function renderBrandFilterGroup(options: Array<{ label: string; value: string; count: number; logoUrl?: string | undefined }>): string {
  const visibleOptions = options.filter((option) => option.count > 0 && shouldShowBrandFilter(option))
  const groupedOptions = options.filter((option) => option.count > 0 && !shouldShowBrandFilter(option))
  const visibleRendered = visibleOptions.map((option) => renderFilterOption('brand', option)).join('')
  const groupedRendered = groupedOptions.map((option) => renderFilterOption('brand', option)).join('')
  const groupedCount = groupedOptions.reduce((sum, option) => sum + option.count, 0)
  const groupedBlock = groupedOptions.length > 0 ? `<details class="filterMore"><summary>更多厂牌（${groupedOptions.length} 个 / ${groupedCount} 个模型）</summary>${groupedRendered}</details>` : ''

  return `<div class="filterGroup"><div class="filterHead"><span>厂牌</span><span>⌄</span></div>${visibleRendered}${groupedBlock}</div>`
}

function shouldShowBrandFilter(option: { label: string; count: number }): boolean {
  if (expandedBrandFilterNames.has(option.label)) return true
  if (collapsedBrandFilterNames.has(option.label)) return false
  return option.count > 5
}

function renderFilterOption(group: string, option: { label: string; value: string; count: number; logoUrl?: string | undefined }): string {
  return `<label class="filterOption"><input type="checkbox" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(option.value)}">${renderLogoIcon(option.logoUrl, `${option.label} logo`, option.label.slice(0, 1), 'filterLogo')}<span>${escapeHtml(option.label)}</span><small>${option.count}</small></label>`
}

function renderModelRow(model: ModelSummary): string {
  return `<tr data-model-row data-model-brand="${escapeHtml(model.brand.slug)}" data-model-modalities="${escapeHtml(model.modalities.join(' '))}" data-model-providers="${escapeHtml(model.providerNames.map(providerFilterValue).join(' '))}" data-model-name="${escapeHtml(`${model.brand.name}: ${model.name}`.toLowerCase())}" data-model-released="${escapeHtml(model.releasedAt)}" data-model-provider-count="${model.providerNames.length}"><td><div class="modelName">${renderLogoIcon(model.brand.logoUrl, `${model.brand.name} logo`, model.brand.name.slice(0, 1), 'modelIcon')}<div><a class="modelLink" href="${model.route}/">${escapeHtml(model.brand.name)}: ${escapeHtml(model.name)}</a><div class="modelSub">${renderModelTagCopy(model.tag)}</div><div class="modelSub">${escapeHtml(model.modalities.join(' · '))} · ${escapeHtml(model.providerNames.length.toString())} 个部署来源</div></div></div></td><td class="mono">${escapeHtml(priceShort(model.inputPrice))}</td><td class="mono">${escapeHtml(priceShort(model.outputPrice))}</td><td class="mono">${escapeHtml(contextShort(model.contextWindow))}</td><td>${escapeHtml(formatDate(model.releasedAt))}</td></tr>`
}

export function renderModelDetailPage(tag: string, details?: ModelDetail[]): string {
  const model = details?.find((candidate) => candidate.tag === tag) ?? getModelDetail(tag)
  if (model === undefined) {
    return page('模型未找到 · mddb.dev', `<main class="wrap" style="padding:80px 24px"><h1>模型未找到</h1><p class="muted">没有找到 ${escapeHtml(tag)}。</p></main>`, 'models')
  }

  const visibleSpecVariants = displayableVariants(model).filter((variant) => isSnapshotVariant(variant) && !hasPriceDifference(model, variant))
  const body = `<main><section class="detailHero detailHeroCompact"><div class="wrap"><a class="btn backToPlaza" href="/models/">← 返回模型广场</a><div class="eyebrow">${escapeHtml(model.brand.name)} / ${renderModelTagCopy(model.tag)}</div><h1>${escapeHtml(model.name)}</h1><div class="summaryStrip"><div><span>输入价格</span><b>${escapeHtml(model.inputPrice)}</b></div><div><span>输出价格</span><b>${escapeHtml(model.outputPrice)}</b></div><div><span>上下文</span><b>${escapeHtml(model.contextWindow)}</b></div><div><span>Alias</span><b>${aliasValues(model).length}</b></div></div></div></section><div class="wrap detailSingle databaseDetail"><article><nav class="toc" aria-label="模型页面章节"><a href="#specs">模型规格</a><a href="#snapshots">Snapshot 规格差异</a><a href="#pricing">价格</a></nav><section id="specs" class="panel"><h2>模型规格</h2>${renderModelSpecs(model)}</section><section id="snapshots" class="panel subtlePanel"><h2>Snapshot 规格差异</h2>${renderSnapshotSpecs(model, visibleSpecVariants)}</section><section id="pricing" class="panel priorityPanel"><h2>价格</h2>${renderPricingGroups(model)}</section></article></div></main>`
  return page(`${model.name} · mddb.dev`, body, 'models')
}

function uniqueProviderNames(model: ModelDetail): string[] {
  return Array.from(new Set(model.variants.flatMap((variant) => variant.providers.map((provider) => provider.name)).concat(model.providerNames))).filter(Boolean).sort()
}

function renderModelSpecs(model: ModelDetail): string {
  const meta = new Map(model.meta.map((item) => [item.label, formatMetaValue(item.value)]))
  const specItems: Array<[string, string]> = [
    ['规范标签', model.tag],
    ['Alias', joinChinese(aliasValues(model)) || '—'],
    ['显示名称', model.name],
    ['厂牌', model.brand.name],
    ['发布日期', formatDate(model.releasedAt)],
    ['上下文窗口', model.contextWindow],
    ['输入模态', meta.get('输入模态') ?? joinChinese(model.modalities)],
    ['输出模态', meta.get('输出模态') ?? '—'],
    ['API 标识符', model.apiIdentifier],
    ['最大输出 token', meta.get('最大输出 token') ?? meta.get('单请求 completion 限制') ?? '—'],
    ['支持参数', meta.get('支持参数') ?? '—'],
  ]
  return `<div class="meta metaWide">${specItems.map(([label, value]) => `<div class="metabox"><span>${escapeHtml(label)}</span><b>${label === '规范标签' ? renderModelTagCopy(value) : escapeHtml(value)}</b></div>`).join('')}</div>`
}

function aliasValues(model: ModelDetail): string[] {
  const labels = new Set(['OpenRouter 别名', '浮动别名', '模型别名/ID', 'Alias', '别名'])
  const aliases = model.meta
    .filter((item) => labels.has(item.label))
    .flatMap((item) => Array.isArray(item.value) ? item.value : item.value.split(/\s*[、,]\s*/))
    .map((value) => value.trim())
    .filter((value) => value && value !== '—' && value !== model.tag && value !== model.apiIdentifier)
  if (model.apiIdentifier && model.apiIdentifier !== model.tag) aliases.push(model.apiIdentifier)
  return Array.from(new Set(aliases)).sort()
}

function renderSnapshotSpecs(model: ModelDetail, variants: ModelVariant[]): string {
  if (variants.length === 0) return '<p class="muted">暂无只影响规格的 snapshot 差异。</p>'
  return variants.map((variant) => `<div class="variant specVariant"><div class="rowTop"><div><strong>${escapeHtml(variant.name)}</strong><p class="muted">${escapeHtml(variant.summary)}</p></div></div><div class="meta"><div class="metabox"><span>上下文</span><b>${escapeHtml(variant.contextWindow)}</b></div><div class="metabox"><span>输入价格</span><b>${escapeHtml(variant.inputPrice)}</b></div><div class="metabox"><span>输出价格</span><b>${escapeHtml(variant.outputPrice)}</b></div></div><p class="providers"><strong>差异</strong><br>${escapeHtml(joinChinese(meaningfulDifferences(variant)))}</p></div>`).join('')
}

function renderPricingGroups(model: ModelDetail): string {
  const { mainSets, variantSets } = splitPriceSets(model)
  const variants = displayableVariants(model).filter((variant) => hasPriceDifference(model, variant) || !isSnapshotVariant(variant))
  const cards = [
    renderMainPriceCard(model, mainSets),
    ...variantSets.map((group) => renderPriceSetVariantCard(group)),
    ...variants.map((variant) => renderPriceVariantCard(model, variant)),
  ]
  return `<div class="priceVariantGrid"><div class="muted">价格差异</div>${cards.join('')}</div>`
}

function splitPriceSets(model: ModelDetail): { mainSets: ModelDetail['officialPriceSets']; variantSets: Array<{ name: string; sets: ModelDetail['officialPriceSets'] }> } {
  const mainSets: ModelDetail['officialPriceSets'] = []
  const variantMap = new Map<string, ModelDetail['officialPriceSets']>()
  for (const priceSet of model.officialPriceSets) {
    if (isSnapshotPriceSetKey(priceSet.sourceModelKey)) {
      continue
    }
    if (isMainPriceSet(model, priceSet)) {
      mainSets.push(priceSet)
    } else {
      const name = priceSet.sourceModelKey.replace(/^[^/]+\//, '')
      const current = variantMap.get(name)
      if (current === undefined) variantMap.set(name, [priceSet])
      else current.push(priceSet)
    }
  }
  return { mainSets, variantSets: Array.from(variantMap.entries()).map(([name, sets]) => ({ name, sets })) }
}

function isMainPriceSet(model: ModelDetail, priceSet: ModelDetail['officialPriceSets'][number]): boolean {
  const key = priceSet.sourceModelKey.replace(/^[^/]+\//, '')
  const api = model.apiIdentifier.replace(/^[^/]+\//, '')
  return key === model.tag || key === api || key.endsWith(`/${model.tag}`) || key.endsWith(`/${api}`)
}

function renderMainPriceCard(model: ModelDetail, priceSets: ModelDetail['officialPriceSets'] = model.officialPriceSets): string {
  return `<div class="priceVariantCard"><div class="rowTop"><div><strong>标准价格</strong><p class="muted">${escapeHtml(model.name)} 主记录</p></div></div><div class="priceGrid"><div class="metabox"><span>输入</span><b>${escapeHtml(model.inputPrice)}</b></div><div class="metabox"><span>输出</span><b>${escapeHtml(model.outputPrice)}</b></div><div class="metabox"><span>上下文</span><b>${escapeHtml(model.contextWindow)}</b></div><div class="metabox"><span>价格记录</span><b>${priceSets.length}</b></div></div>${renderOfficialPricing(priceSets)}</div>`
}

function renderPriceSetVariantCard(group: { name: string; sets: ModelDetail['officialPriceSets'] }): string {
  const components = group.sets.flatMap((set) => set.components)
  const input = components.find((component) => component.scope === 'input')
  const output = components.find((component) => component.scope === 'output')
  return `<div class="priceVariantCard"><div class="rowTop"><div><strong>${escapeHtml(group.name)}</strong><p class="muted">价格差异</p></div></div><div class="priceGrid"><div class="metabox"><span>输入</span><b>${input ? escapeHtml(formatMoney(input.amount)) + ' / 1M' : '—'}</b></div><div class="metabox"><span>输出</span><b>${output ? escapeHtml(formatMoney(output.amount)) + ' / 1M' : '—'}</b></div><div class="metabox"><span>价格记录</span><b>${group.sets.length}</b></div></div>${renderOfficialPricing(group.sets)}</div>`
}

function renderPriceVariantCard(model: ModelDetail, variant: ModelVariant): string {
  const label = hasPriceDifference(model, variant) ? '价格差异' : '规格/部署差异'
  return `<div class="priceVariantCard"><div class="rowTop"><div><strong>${escapeHtml(variant.name)}</strong><p class="muted">${escapeHtml(label)}</p></div></div><div class="priceGrid"><div class="metabox"><span>输入</span><b>${escapeHtml(variant.inputPrice)}</b></div><div class="metabox"><span>输出</span><b>${escapeHtml(variant.outputPrice)}</b></div><div class="metabox"><span>上下文</span><b>${escapeHtml(variant.contextWindow)}</b></div><div class="metabox"><span>差异</span><b>${escapeHtml(joinChinese(meaningfulDifferences(variant)) || '—')}</b></div></div></div>`
}

function displayableVariants(model: ModelDetail): ModelVariant[] {
  return model.variants.filter((variant) => !isSameAsMainRecord(model, variant))
}

function isSameAsMainRecord(model: ModelDetail, variant: ModelVariant): boolean {
  return normalizeComparable(model.contextWindow) === normalizeComparable(variant.contextWindow)
    && normalizeComparable(model.inputPrice) === normalizeComparable(variant.inputPrice)
    && normalizeComparable(model.outputPrice) === normalizeComparable(variant.outputPrice)
    && meaningfulDifferences(variant).length === 0
}

function hasPriceDifference(model: ModelDetail, variant: ModelVariant): boolean {
  return normalizeComparable(model.inputPrice) !== normalizeComparable(variant.inputPrice)
    || normalizeComparable(model.outputPrice) !== normalizeComparable(variant.outputPrice)
}

function isSnapshotPriceSetKey(sourceModelKey: string): boolean {
  const key = sourceModelKey.split(':').pop() ?? sourceModelKey
  return stripSnapshotSuffix(normalizeModelTagCandidate(key)).snapshot !== null
}

function isSnapshotVariant(variant: ModelVariant): boolean {
  return variant.id.includes('snapshot') || variant.id.includes('202') || variant.differences.some((difference) => /快照|snapshot|20\d{6}|20\d{2}-\d{2}-\d{2}/i.test(difference))
}

function meaningfulDifferences(variant: ModelVariant): string[] {
  return variant.differences.filter((difference) => !/相同模型能力|provider availability|not used as canonical|source model|billing token|billing unknown|ratio_|tag |provider |OpenRouter ID/i.test(difference))
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/,/g, '').replace(/\s+/g, '').replace(/\.0(?=\D|$)/g, '')
}

function renderSourceSummary(model: ModelDetail): string {
  const sources = Array.from(new Set(model.officialPriceSets.map((priceSet) => priceSet.source).concat(['curated']))).sort()
  const sourceRows = sources.map((source) => `<div class="sourceItem"><strong>${escapeHtml(source)}</strong><span>${source === 'curated' ? '模型身份、展示文案与人工规则' : '官方价格或来源观测'}</span></div>`).join('')
  return `<p class="muted">从数据源引入但暂不展示的冗余字段会有序保管为 raw observation，后续需要重新格式化时可继续提取使用。</p><div class="sourceList">${sourceRows}</div>`
}

function renderReviewSummary(model: ModelDetail): string {
  const reviewItems = model.meta.filter((item) => item.label.includes('审核') || item.label.includes('冲突'))
  const warnings = model.officialPriceSets.flatMap((priceSet) => priceSet.warnings.map((warning) => `${priceSet.sourceModelKey}: ${warning}`))
  const items = [...reviewItems.map((item) => formatMetaValue(item.value)), ...warnings]
  if (items.length === 0) return '<p class="muted">当前没有阻塞展示的审核提示。free tier 与 provider 性能观测不会进入官方价格事实。</p>'
  return `<ul class="reviewList">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function renderModelTagCopy(tag: string): string {
  const safeTag = escapeHtml(tag)
  return `<span class="modelTagCopy"><code class="mono">${safeTag}</code><button class="copyTagBtn" type="button" data-copy-model-tag="${safeTag}" aria-label="复制模型 tag ${safeTag}" title="复制模型 tag"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></span>`
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
  return renderProviderChips(uniqueProviderNames(model))
}

function renderProviderChips(providerNames: string[]): string {
  const rows = providerNames.map((name) => `<span class="providerChip">${escapeHtml(name)}</span>`).join('')
  return rows ? `<div class="availabilityGrid">${rows}</div>` : '<p class="muted">暂无可用 provider 观测。</p>'
}

function renderVariant(variant: ModelVariant): string {
  return `<div class="variant specVariant"><div class="rowTop"><div><strong>${escapeHtml(variant.name)}</strong><p class="muted">${escapeHtml(variant.summary)}</p></div><span class="pill">${variant.providers.length || '私有'} 个可用来源</span></div><div class="meta"><div class="metabox"><span>上下文</span><b>${escapeHtml(variant.contextWindow)}</b></div><div class="metabox"><span>输入价格</span><b>${escapeHtml(variant.inputPrice)}</b></div><div class="metabox"><span>输出价格</span><b>${escapeHtml(variant.outputPrice)}</b></div></div><p class="providers"><strong>规格差异</strong><br>${escapeHtml(joinChinese(variant.differences))}</p><p class="providers"><strong>可用来源</strong><br>${escapeHtml(joinChinese(variant.providers.map((p) => p.name)) || '自托管 / 私有化')}</p></div>`
}

function renderOfficialPricing(priceSets: ModelDetail['officialPriceSets']): string {
  const rows = priceSets.flatMap((priceSet) =>
    priceSet.components.map((component) => `<tr><td>${escapeHtml(formatPricingMode(component.mode))}</td><td>${escapeHtml(formatPricingScope(component.scope))}</td><td class="mono">${escapeHtml(formatMoney(component.amount))}</td><td>${escapeHtml(formatPricingUnit(component.unit))}</td><td>${escapeHtml(formatPricingConditions(component.conditions))}</td></tr>`),
  )
  if (rows.length === 0) return '<p class="muted">暂无可结构化展示的官方价格组件。</p>'
  return `<div class="tableWrap"><table class="modelTable"><thead><tr><th>计价方式</th><th>范围</th><th>价格</th><th>单位</th><th>条件</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}

function formatPricingMode(mode: string): string {
  const labels: Record<string, string> = { token: 'token', request: '按请求', image: '图片', audio: '音频', time: '时长', web_search: '联网搜索', reasoning: '推理', other: '其他' }
  return labels[mode] ?? mode
}

function formatPricingScope(scope: string): string {
  const labels: Record<string, string> = { input: '输入', output: '输出', cache_read: '缓存读取', cache_write: '缓存写入', request: '请求', image_input: '图片输入', image_output: '图片输出', image_token: '图片 token', audio_input: '音频输入', audio_output: '音频输出', audio_cache: '音频缓存', internal_reasoning: '内部推理', web_search: '联网搜索', other: '其他' }
  return labels[scope] ?? scope
}

function formatPricingUnit(unit: string): string {
  const labels: Record<string, string> = { '1m_tokens': '每 1M tokens', request: '每次请求', image: '每张图片', audio_second: '每秒音频', audio_minute: '每分钟音频', hour: '每小时', unit: '每单位' }
  return labels[unit] ?? unit
}

function formatPricingConditions(conditions: Array<{ key: string; value: string }>): string {
  return conditions.length > 0 ? conditions.map((condition) => `${condition.key}=${condition.value}`).join(' · ') : '默认'
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 12 })}`
}

function countByModality(models: ModelSummary[], modality: string): number {
  return models.filter((model) => model.modalities.includes(modality)).length
}

function priceShort(value: string): string {
  return value.replace(' / 1M', '')
}

function contextShort(value: string): string {
  return value
}

function formatDate(value: string): string {
  if (value === '—' || value === '-' || value === 'N/A' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '—'
  }
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
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
    const previous=button.innerHTML;
    button.classList.add('copied');
    button.textContent='已复制';
    setTimeout(()=>{button.innerHTML=previous;button.classList.remove('copied')},1200);
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
