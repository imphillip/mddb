import type { BaseLlmSupplementalPrice, OpenRouterRawEdge, OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#fff;--fg:#171717;--muted:#666;--soft:#fafafa;--line:#eaeaea;--line2:#f2f2f2;--blue:#2563eb;--green:#0a7f42;--shadow:rgba(0,0,0,.06) 0 1px 2px,rgba(0,0,0,.04) 0 6px 20px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-feature-settings:'liga'}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1360px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:22px}.brandmark{font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:10px}.brandZh{color:#666;font-weight:500;letter-spacing:0;font-size:14px;border-left:1px solid var(--line);padding-left:10px}.logo{width:22px;height:22px;border-radius:7px;background:#171717;display:inline-grid;place-items:center;color:#fff}.logo svg{width:15px;height:15px;display:block}.topSearch{width:300px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#7a7a7a;display:flex;align-items:center;gap:8px;padding:0 13px;font-size:13px}.topSearch input{border:0;background:transparent;outline:0;width:100%;font:inherit;color:#333}.topSearch input::placeholder{color:#999}.navlinks{display:flex;gap:20px;margin-left:auto;font-size:14px;color:#555}.navlinks a,.navlinks span{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#111;border-bottom-color:#111}.navlinks .disabled{color:#aaa;cursor:not-allowed;pointer-events:none;border-bottom-color:transparent}.githubLink{width:34px;height:34px;border:1px solid var(--line);border-radius:999px;display:inline-grid;place-items:center;color:#555;background:#fff;flex:0 0 34px}.githubLink:hover{color:#111;border-color:#cfcfcf;background:#fafafa}.githubLink svg{width:18px;height:18px;display:block}.currencyControl{display:inline-flex;align-items:center}.currencyToggle{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--line);border-radius:999px;padding:3px;background:#fff}.currencyToggle button{border:0;border-radius:999px;background:transparent;color:#666;font:600 12px Geist,system-ui,sans-serif;padding:6px 10px;cursor:pointer}.currencyToggle button.active{background:#111;color:#fff}.priceCurrencySymbol{display:inline}.priceAmount{font-variant-numeric:tabular-nums}.priceUnit{display:none}.wrap{max-width:1180px;margin:0 auto;padding:0 24px}.homeEmpty{min-height:calc(100vh - 60px);display:grid;place-items:center;text-align:center}.homeEmpty h1{font-size:52px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.homeEmpty p{color:var(--muted);font-size:16px}.eyebrow{font:500 12px 'Geist Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:#777}.modelsShell{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:268px minmax(0,1fr);min-height:calc(100vh - 60px)}.filterPanel{border-right:1px solid var(--line);padding:28px 18px 48px;background:#fff}.filterTitle{font-size:13px;font-weight:600;margin:0 0 12px;color:#333}.filterGroup{border-bottom:1px solid var(--line2);padding:14px 0}.filterHead{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500}.filterMore{margin-top:6px}.filterMore summary{cursor:pointer;color:#666;font-size:13px;padding:8px 0;list-style:none}.filterMore summary::-webkit-details-marker{display:none}.filterMore summary::after{content:'展开';float:right;color:#999}.filterMore[open] summary::after{content:'收起'}.filterMore[open] summary{color:#333}.filterOption{display:flex;align-items:center;gap:9px;padding:8px 0;color:#555;font-size:14px}.filterLogo{width:18px;height:18px;border:1px solid var(--line);border-radius:5px;background:#fff;display:inline-grid;place-items:center;flex:0 0 auto;font-size:10px;font-weight:600;color:#555;overflow:hidden}.filterLogo img{max-width:13px;max-height:13px}.check{width:16px;height:16px;border:1px solid #cfcfcf;border-radius:4px;display:inline-grid;place-items:center;font-size:11px;color:#fff}.check.on{background:#111;border-color:#111}.mainPanel{padding:30px 32px 80px;overflow:hidden}.plazaHead{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.plazaHead h1{font-size:38px;letter-spacing:-1.6px;margin:0}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.modelSearch{width:260px;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit}.btn{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 12px;font-weight:500;color:#333}.iconBtn{width:38px;padding:0}.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:8px;overflow:auto}.tab{display:flex;gap:6px;align-items:center;padding:12px 10px 10px;border-bottom:2px solid transparent;color:#666;font-size:14px;white-space:nowrap}.tab.active{color:#111;border-bottom-color:#111}.tab b{font-weight:500}.tableWrap{overflow:auto}.modelTable{width:100%;border-collapse:collapse;min-width:720px}.modelTable th{text-align:left;color:#777;font-size:12px;font-weight:500;padding:13px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.modelTable td{padding:16px 12px;border-bottom:1px solid var(--line2);vertical-align:middle;font-size:14px}.modelName{display:flex;align-items:center;gap:11px;min-width:270px}.modelIcon{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:#fafafa;display:grid;place-items:center;font-weight:600;font-size:13px;overflow:hidden}.modelIcon img{max-width:20px;max-height:20px}.providerIcon{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);background:#fff;display:inline-grid;place-items:center;vertical-align:middle;margin-right:8px;overflow:hidden;font-size:11px}.providerIcon img{max-width:16px;max-height:16px}.modelLink{font-weight:500}.modelLink:hover{text-decoration:underline;text-underline-offset:3px}.modelSub{color:#777;font-size:12px;margin-top:4px}.modelTagCopy{display:inline-flex;align-items:center;gap:6px;color:#555}.modelTagCopy code{background:#f5f5f5;border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:11px}.copyTagBtn{border:1px solid var(--line);border-radius:999px;background:#fff;color:#555;padding:2px 7px;font:500 11px Geist,system-ui,sans-serif;cursor:pointer}.copyTagBtn:hover{border-color:#cfcfcf;color:#111;background:#fafafa}.pill{display:inline-flex;align-items:center;border-radius:999px;background:#f5f7ff;color:#1d4ed8;padding:2px 8px;font-size:12px;font-weight:500}.mono{font-family:'Geist Mono',ui-monospace,monospace}.muted{color:var(--muted)}.detailHero{border-bottom:1px solid var(--line);padding:64px 0 36px;background:linear-gradient(180deg,#fafafa,#fff)}.detailHero h1{font-size:54px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.detailHero p{max-width:760px;color:#4d4d4d;line-height:1.7;font-size:18px}.detailGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:28px;padding-top:38px;padding-bottom:80px}.toc{display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:24px}.toc a{font-size:14px;color:#666}.toc a:hover{color:#171717}.panel{box-shadow:var(--shadow);border:1px solid var(--line);border-radius:12px;background:#fff;padding:22px;margin-bottom:16px}.panel h2{font-size:28px;letter-spacing:-1px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.metabox{background:#fafafa;border-radius:8px;padding:10px;border:1px solid var(--line)}.metabox span{display:block;color:#808080;font-size:11px;text-transform:uppercase}.metabox b{font-size:13px;overflow-wrap:anywhere}.metaWide{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.providerRow,.variant{border-top:1px solid var(--line);padding:16px 0}.providerRow:first-of-type,.variant:first-of-type{border-top:0}.rowTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.providers{font-size:13px;color:#4d4d4d;line-height:1.5}.providers strong{color:#171717}.priceGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.apiBox{background:#171717;color:#fff;border-radius:10px;padding:16px;font-family:'Geist Mono',monospace;font-size:13px;overflow:auto}.footer{border-top:1px solid var(--line);padding:28px 24px;color:#666;font-size:13px}@media(max-width:900px){.topSearch{display:none}.navlinks{gap:14px}.modelsShell,.detailGrid{grid-template-columns:1fr}.filterPanel{border-right:0;border-bottom:1px solid var(--line)}.plazaHead{align-items:flex-start;flex-direction:column}.modelSearch{width:100%}.meta{grid-template-columns:1fr}.detailHero h1{font-size:42px}}

.detailSingle{display:block;max-width:980px;padding-top:38px;padding-bottom:80px}.backToPlaza{display:inline-flex;align-items:center;justify-content:center;margin-bottom:22px}.priceVariantGrid{display:grid;gap:14px}.priceVariantCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px}.priceList{display:grid;gap:10px;margin:0}.priceItem{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line2);padding:8px 0}.priceItem:last-child{border-bottom:0}.priceItem dt{color:#777}.priceItem dd{margin:0;text-align:right}.priceVariantCard+.priceVariantCard{margin-top:0}.detailHeroCompact{padding:52px 0 30px}.summaryStrip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:24px;max-width:900px}.summaryStrip div{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}.summaryStrip span{display:block;color:#777;font-size:12px;margin-bottom:4px}.summaryStrip b{font-size:18px;letter-spacing:-.3px}.priorityPanel{border-color:#dbe7ff;background:linear-gradient(180deg,#fbfdff,#fff)}.subtlePanel{background:#fcfcfc}.stickyCard{position:sticky;top:82px}.availabilityGrid{display:flex;flex-wrap:wrap;gap:8px}.providerChip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;background:#fafafa;padding:7px 11px;font-size:13px;color:#333;line-height:1}.providerCloud{line-height:1.8}.sourceList{display:grid;gap:8px;margin-top:14px}.sourceItem{display:flex;justify-content:space-between;gap:14px;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fafafa}.sourceItem span{color:#666;font-size:13px}.relationChips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.relationChip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:13px;color:#333}.relationChip small{color:#777}.modelIdHero{margin-top:12px;font-size:15px;color:#555}.heroRelations{margin-top:14px}.relationPanel{margin-bottom:16px}.relationPanel .relationChips{margin-bottom:0}.specRows{display:grid;gap:10px;margin-top:16px}.specRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.reviewList{margin:0;padding-left:18px;color:#555;line-height:1.7}.specVariant{border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;background:#fff}.specVariant+.specVariant{border-top:1px solid var(--line)}.moreBlock{margin-top:12px;border:1px dashed var(--line);border-radius:12px;padding:12px;background:#fcfcfc}.moreBlock summary{cursor:pointer;color:#555;font-weight:500}.modelTable th{background:#fafafa}.modelTable td,.modelTable th{line-height:1.45}.modelTable td:nth-child(3){text-align:right}.copyTagBtn svg{width:13px;height:13px;display:block}.copyTagBtn.copied{width:auto;padding:2px 7px}@media(max-width:900px){.summaryStrip{grid-template-columns:repeat(2,1fr)}.stickyCard{position:static}.sourceItem{display:block}.sourceItem span{display:block;margin-top:4px}}
.raw{white-space:pre-wrap;overflow:auto;max-height:680px;background:#0b1020;color:#d8e4ff;border-radius:12px;padding:14px;font-size:12px;line-height:1.45}.badge{display:inline-flex;border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:2px 8px;font-size:12px;margin:2px;color:#555}.badge.api{color:var(--green)}.badge.page_only{color:#b91c1c}.statGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:18px 0 24px}.statCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}.statCard span{display:block;color:#777;font-size:12px;margin-bottom:4px}.statCard b{font-size:20px;letter-spacing:-.3px}.rawIntro{max-width:880px;color:#666;line-height:1.7}.filterHint{color:#999;font-size:12px;margin-top:8px}.edge{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section{margin-bottom:18px}.kv{display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line2)}.kv span{color:#777}.kv b{font-weight:500;word-break:break-word}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.tabs a{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:#fff;color:#333}.modelTable td:nth-child(3){text-align:left}.rawSource{word-break:break-all}.mono,code,pre{font-family:Geist Mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.statusLine{display:flex;flex-wrap:wrap;gap:4px}.providerSummary{color:#777;font-size:12px;margin-top:4px}.searchBox{width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit;margin-bottom:14px}.listToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 18px}.listCount{color:#555;font-size:14px}.listCount b{color:#111}.quickFilters{display:flex;gap:8px;flex-wrap:wrap}.quickFilter{border:1px solid var(--line);border-radius:999px;background:#fff;color:#444;padding:7px 11px;font:500 13px inherit;cursor:pointer}.quickFilter:hover,.quickFilter.active{border-color:#111;color:#111;background:#fafafa}.filterOption input{accent-color:#111}@media(max-width:900px){.statGrid,.two{grid-template-columns:1fr}.kv{grid-template-columns:1fr}.modelTable{min-width:900px}}`

type ActivePage = 'home' | 'models'

export function renderOpenRouterRawHome(graph: OpenRouterRawGraph): string {
  const authorOptions = authorFilterOptions(graph)
  const searchOnlyNodeIds = modelPlazaSearchOnlyNodeIds(graph)
  const visibleRows = graph.nodes.filter((node) => !searchOnlyNodeIds.has(node.id)).length
  const rows = graph.nodes.slice().sort(compareNodesByReleaseDesc).map((node) => renderModelRow(node, searchOnlyNodeIds.has(node.id), graph)).join('')
  const body = `<main class="modelsShell"><aside class="filterPanel" aria-label="模型筛选">${renderAuthorFilterGroup(graph, authorOptions, visibleRows)}</aside><section class="mainPanel"><div class="plazaHead"><div><h1>模型广场</h1></div></div><div class="listToolbar"><div class="listCount"><b id="visibleCount">${visibleRows}</b> items</div><div class="quickFilters" aria-label="模态筛选"><button class="quickFilter active" type="button" data-output-filter="all">全部</button><button class="quickFilter" type="button" data-output-filter="text">Text</button><button class="quickFilter" type="button" data-output-filter="image">Image</button><button class="quickFilter" type="button" data-output-filter="embeddings">Embedding</button><button class="quickFilter" type="button" data-output-filter="audio">Audio</button><button class="quickFilter" type="button" data-output-filter="video">Video</button><button class="quickFilter" type="button" data-output-filter="rerank">Rerank</button><button class="quickFilter" type="button" data-output-filter="speech">Speech</button><button class="quickFilter" type="button" data-output-filter="transcription">Transcription</button></div></div><div class="tableWrap"><table class="modelTable"><thead><tr><th>模型</th><th>上下文</th><th>输入<br><small data-price-unit>/M tokens</small></th><th>输出<br><small data-price-unit>/M tokens</small></th><th>读取<br><small data-price-unit>/M tokens</small></th><th>发布时间</th></tr></thead><tbody id="rows">${rows}</tbody></table></div><script>${modelFilterScript()}${currencyToggleScript()}</script></section></main>`
  return page('模型广场 · mddb.dev', body, 'models', currencyToggle(graph))
}

function compareNodesByReleaseDesc(a: OpenRouterRawNode, b: OpenRouterRawNode): number {
  const diff = modelReleaseTimestamp(b) - modelReleaseTimestamp(a)
  return diff !== 0 ? diff : a.displayName.localeCompare(b.displayName)
}

function modelReleaseTimestamp(node: OpenRouterRawNode): number {
  const created = rawModelField(node, 'created')
  const timestamp = Number(created)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function renderOpenRouterRawDetail(graph: OpenRouterRawGraph, node: OpenRouterRawNode): string {
  const outEdges = graph.edges.filter((edge) => edge.from === node.id)
  const inEdges = graph.edges.filter((edge) => edge.to === node.id && edge.from !== node.id)
  const body = `<main><section class="detailHero detailHeroCompact"><div class="wrap"><a class="btn backToPlaza" href="/models/">← 返回模型广场</a><div class="eyebrow">Author · ${escapeHtml(node.derived.author ?? '—')}</div><h1>${escapeHtml(node.displayName)}</h1><div class="modelIdHero">Model ID ${renderModelTagCopy(node.modelId)}</div><div hidden>${modelDescription(node)}</div>${renderHeroRelations(graph, node, outEdges, inEdges)}</div></section><div class="wrap detailSingle databaseDetail"><article><nav class="toc" aria-label="模型页面章节"><a href="#spec">规格</a><a href="#pricing">价格</a><a href="#source">数据来源与源数据</a></nav>${renderSpecSection(node)}${renderPricingSection(graph, node)}${renderSourceSection(node, outEdges, inEdges)}</article></div></main>`
  return page(`${node.displayName} · mddb.dev`, body, 'models')
}

function renderHeroRelations(graph: OpenRouterRawGraph, node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  const chips = relationChips(graph, outEdges, inEdges)
  return chips ? `<div class="heroRelations">${chips}</div>` : ''
}

function relationChips(graph: OpenRouterRawGraph, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  const anchorEdges = outEdges.filter((edge) => ['deployment_of', 'alias_of', 'snapshot_of', 'variant_of', 'spec_same_as'].includes(edge.type) && edge.from !== edge.to)
  const relatedEdges = inEdges.filter((edge) => ['alias_of', 'snapshot_of', 'variant_of'].includes(edge.type))
  const deploymentEdges = inEdges.filter((edge) => ['deployment_of'].includes(edge.type))
  const seen = new Set<string>()
  const chips = [
    ...anchorEdges.map((edge) => renderRelationChip(graph, edge, relationLabel(edge.type), 'to')),
    ...relatedEdges.map((edge) => renderRelationChip(graph, edge, relationLabel(edge.type), 'from')),
    ...deploymentEdges.map((edge) => renderRelationChip(graph, edge, relationLabel(edge.type), 'from')),
  ].filter((chip) => {
    if (seen.has(chip)) return false
    seen.add(chip)
    return true
  })
  return chips.length > 0 ? `<div class="relationChips">${chips.join('')}</div>` : ''
}

function relationLabel(type: string): string {
  if (type === 'alias_of') return '别称'
  if (type === 'snapshot_of') return '快照'
  if (type === 'deployment_of') return 'provider'
  if (type === 'spec_same_as') return '相同规格'
  if (type === 'variant_of') return '变体'
  return type
}

function renderRelatedModels(graph: OpenRouterRawGraph, node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  const chips = relationChips(graph, outEdges, inEdges)
  return `<section id="relations" class="panel priorityPanel relationPanel"><h2>关联模型</h2>${chips || '<p class="muted">暂无已确认关联；此节点可能是 anchor 或 unresolved source model。</p>'}</section>`
}

function renderRelationChip(graph: OpenRouterRawGraph, edge: OpenRouterRawEdge, label: string, side: 'from' | 'to'): string {
  const target = graph.nodes.find((candidate) => candidate.id === (side === 'from' ? edge.from : edge.to))
  if (!target) return `<span class="relationChip"><small>${escapeHtml(label)}</small>${escapeHtml(edge.label)}</span>`
  return `<a class="relationChip" href="${escapeHtml(target.route)}/"><small>${escapeHtml(label)}</small>${escapeHtml(target.sourceId)}</a>`
}

function renderRelationList(graph: OpenRouterRawGraph, edges: OpenRouterRawEdge[]): string {
  if (edges.length === 0) return '<p class="muted">无</p>'
  return edges.map((edge) => `<div class="edge"><strong>${escapeHtml(edge.type)}</strong> → ${renderEdgeNodeLink(graph, edge.to, edge.label)}<br><small>${escapeHtml(edge.label)}</small>${edge.raw ? `<details><summary>引用标注 / raw edge</summary>${rawBlock(edge.raw)}</details>` : ''}</div>`).join('')
}

function renderEdgeNodeLink(graph: OpenRouterRawGraph, nodeId: string, fallback: string): string {
  const target = graph.nodes.find((candidate) => candidate.id === nodeId)
  if (!target) return `<code>${escapeHtml(nodeId || fallback)}</code>`
  return `<a class="modelLink" href="${escapeHtml(target.route)}/">${escapeHtml(target.sourceId)}</a>`
}

function renderSpecSection(node: OpenRouterRawNode): string {
  return `<section id="spec" class="panel"><h2>规格</h2><div class="specRows"><div class="specRow">${kv('Input modalities', node.derived.inputModalities.join(' · ') || '—')}${kv('Output modalities', node.derived.outputModalities.join(' · ') || '—')}</div><div class="specRow">${kv('Context length', modelContextLength(node))}${kv('Max output tokens', modelMaxOutputTokens(node))}${kv('Tokenizer', rawModelField(node, 'architecture.tokenizer'))}</div><div class="specRow">${kv('Author', node.derived.author ?? '—')}${kv('Knowledge cutoff', rawModelField(node, 'knowledge_cutoff'))}${kv('Released', modelReleasedDate(node))}</div><div class="specRow">${kv('Supported parameters', rawModelArray(node, 'supported_parameters').join(' · ') || '—')}</div></div></section>`
}

function modelContextLength(node: OpenRouterRawNode): string {
  const topProvider = rawModelField(node, 'top_provider.context_length')
  const modelContext = rawModelField(node, 'context_length')
  return topProvider !== '—' ? topProvider : modelContext !== '—' ? modelContext : node.derived.endpointContextLengths.map(String).join(', ') || '—'
}

function modelDescription(node: OpenRouterRawNode): string {
  const description = rawModelField(node, 'description')
  return description === '—' ? '' : `<p>${escapeHtml(description)}</p>`
}

function modelReleasedDate(node: OpenRouterRawNode): string {
  const created = rawModelField(node, 'created')
  if (created === '—') return snapshotDateFromModelId(node.sourceId) ?? snapshotDateFromModelId(node.modelId) ?? '—'
  const timestamp = Number(created)
  if (!Number.isFinite(timestamp)) return escapeHtml(created)
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function snapshotDateFromModelId(value: string): string | null {
  const hyphenated = value.match(/(?:^|[-/])(20\d{2})-(\d{2})-(\d{2})(?:$|[-_:])/u)
  if (hyphenated) return validIsoDate(`${hyphenated[1]}-${hyphenated[2]}-${hyphenated[3]}`)
  const compact = value.match(/(?:^|[-/])(20\d{2})(\d{2})(\d{2})(?:$|[-_:])/u)
  if (compact) return validIsoDate(`${compact[1]}-${compact[2]}-${compact[3]}`)
  return null
}

function validIsoDate(value: string): string | null {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value
}

function modelMaxOutputTokens(node: OpenRouterRawNode): string {
  return rawModelField(node, 'top_provider.max_completion_tokens')
}

function rawModelField(node: OpenRouterRawNode, path: string): string {
  let value: unknown = node.raw.model
  for (const part of path.split('.')) {
    if (!isRecord(value)) return '—'
    value = value[part]
  }
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function rawModelArray(node: OpenRouterRawNode, key: string): string[] {
  if (!isRecord(node.raw.model) || !Array.isArray(node.raw.model[key])) return []
  return node.raw.model[key].map(String)
}

function renderPricingSection(graph: OpenRouterRawGraph, node: OpenRouterRawNode): string {
  const endpointPricing = endpointPricingCards(node)
  const supplementalPricing = endpointPricing ? '' : baseLlmSupplementalPricingCards(graph, node)
  return `<section id="pricing" class="panel"><h2>价格</h2>${endpointPricing || supplementalPricing || '<p class="muted">无结构化 provider pricing；如本节点为 alias/snapshot/deployment，请先看上方关联模型跳转到 anchor。</p>'}</section>`
}

function baseLlmSupplementalPricingCards(graph: OpenRouterRawGraph, node: OpenRouterRawNode): string {
  if (node.sourceId.toLowerCase().endsWith(':free')) return ''
  const prices = graph.enrichment?.baseLlm?.pricingBySourceId?.[node.sourceId] ?? []
  const usable = prices.filter((price) => price.billingKind !== 'unknown')
  if (usable.length === 0) return ''
  return `<div class="priceVariantGrid"><div class="muted">BaseLLM / NewAPI 补充价格；仅用于 OpenRouter 缺失结构化价格时，不覆盖 OpenRouter 官方/endpoint 价格。</div>${usable.map(renderBaseLlmPricingCard).join('')}</div>`
}

function renderBaseLlmPricingCard(price: BaseLlmSupplementalPrice): string {
  const rows = price.billingKind === 'unit' ? [
    priceRow('Request / unit', price.unitPrice, 'USD/direct'),
  ] : [
    priceRow('Input / prompt', price.pricePerMillionInput ?? price.derivedInputPriceFromRatio, 'USD/direct_per_1M'),
    priceRow('Output / completion', price.pricePerMillionOutput ?? price.derivedOutputPriceFromRatio, 'USD/direct_per_1M'),
    priceRow('Cache read', price.pricePerMillionCacheRead, 'USD/direct_per_1M'),
    priceRow('Cache write', price.pricePerMillionCacheWrite, 'USD/direct_per_1M'),
  ]
  const meta = [
    `provider ${price.providerName}`,
    `source ${price.sourceModelId}`,
    `context ${price.contextWindow}`,
    ...price.tags.map((tag) => `tag ${tag}`),
  ].map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('')
  return `<div class="priceVariantCard"><h3>BaseLLM / NewAPI 补充价格 · ${escapeHtml(price.providerName)}</h3><dl class="priceList">${rows.filter(Boolean).join('')}</dl><div class="statusLine">${meta}</div></div>`
}

function endpointPricingCards(node: OpenRouterRawNode): string {
  const endpoints = currentProviderEndpoints(node)
  if (endpoints.length === 0) return ''
  return `<div class="priceVariantGrid">${endpoints.map(renderEndpointPricingCard).join('')}</div>`
}

function currentProviderEndpoints(node: OpenRouterRawNode): Record<string, unknown>[] {
  if (node.nodeKind === 'endpoint_deployment') return isRecord(node.raw.endpoint) ? [node.raw.endpoint] : []
  return endpointList(node).filter((endpoint) => endpointProviderSlug(endpoint) === node.provider)
}

function endpointProviderSlug(endpoint: Record<string, unknown>): string {
  const tag = typeof endpoint.tag === 'string' && endpoint.tag.trim() ? endpoint.tag : String(endpoint.provider_name ?? 'unknown')
  return tag.replace(/\//gu, '-').trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-') || 'unknown'
}

function renderEndpointPricingCard(endpoint: Record<string, unknown>): string {
  const pricing = isRecord(endpoint.pricing) ? endpoint.pricing : {}
  const rows = [
    priceRow('Input / prompt', pricing.prompt, 'USD/1M tokens'),
    priceRow('Output / completion', pricing.completion, 'USD/1M tokens'),
    priceRow('Cache read', pricing.input_cache_read, 'USD/1M tokens'),
    priceRow('Web search', pricing.web_search, 'USD/request'),
  ].filter(Boolean).join('')
  return `<div class="priceVariantCard"><dl class="priceList">${rows}</dl></div>`
}

function priceRow(label: string, value: unknown, unit: string): string {
  if (value === null || value === undefined || value === '') return ''
  return `<div class="priceItem"><dt>${escapeHtml(label)}</dt><dd>${formatPrice(value, unit)}</dd></div>`
}

function formatPrice(value: unknown, unit: string): string {
  if (unit === 'USD/1M tokens') return `${currencyPriceHtml(Number(value) * 1_000_000)} <span class="muted">per 1M tokens</span>`
  if (unit === 'USD/direct_per_1M') return `${currencyPriceHtml(Number(value))} <span class="muted">per 1M tokens</span>`
  if (unit === 'USD/request') return `${currencyPriceHtml(Number(value))} <span class="muted">per request</span>`
  if (unit === 'USD/direct') return `${currencyPriceHtml(Number(value))} <span class="muted">per request</span>`
  return `<code>${escapeHtml(String(value))}</code>${unit ? ` <span class="muted">${escapeHtml(unit)}</span>` : ''}`
}

function formatUsdPerMillionTokens(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return `$${escapeHtml(String(value))}`
  return currencyPriceHtml(numeric * 1_000_000)
}

function currencyPriceHtml(usdValue: number, cnyRate = 7): string {
  if (!Number.isFinite(usdValue)) return '<code>—</code>'
  const usd = formatPriceAmount(usdValue)
  const cny = formatPriceAmount(usdValue * cnyRate)
  return `<code class="priceValue" data-usd="${usd}" data-cny="${cny}"><span class="priceCurrencySymbol">$</span><span class="priceAmount">${usd}</span></code>`
}

function formatPriceAmount(value: number): string {
  return formatDisplayNumber(value)
}

function formatDisplayNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Math.round((value + Number.EPSILON) * 10_000) / 10_000
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '')
}

function sourcePricingBlocks(node: OpenRouterRawNode): string {
  const modelPricing = rawPricingValue(node.raw.model, 'pricing')
  const pagePricing = rawPricingValue(node.raw.page, 'pricing') ?? rawPricingValue(node.raw.page, 'pricing_json')
  const blocks = [
    modelPricing ? `<div class="specVariant"><strong>OpenRouter models API pricing</strong>${rawBlock(modelPricing)}</div>` : '',
    pagePricing ? `<div class="specVariant"><strong>OpenRouter page pricing</strong>${rawBlock(pagePricing)}</div>` : '',
  ].filter(Boolean).join('')
  return blocks || '<p class="muted">无 source-level pricing；查看 endpoint observations 或关联 anchor。</p>'
}

function rawPricingValue(value: unknown, key: string): unknown | null {
  return isRecord(value) && value[key] !== undefined ? value[key] : null
}

function renderSourceSection(node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  return `<section id="source" class="panel subtlePanel"><details><summary><h2>数据来源与源数据</h2></summary><div class="meta metaWide">${kv('Data source', node.dataSource)}${kv('Source ID', renderModelTagCopy(node.sourceId))}${kv('Source URL', `<a href="${escapeHtml(node.sourceUrl)}">${escapeHtml(node.sourceUrl)}</a>`)}${kv('Pricing keys', node.derived.pricingKeys.join(' · ') || '—')}${kv('Outgoing edges', String(outEdges.length))}${kv('Incoming edges', String(inEdges.length))}</div><details class="moreBlock"><summary>节点 raw data</summary>${rawBlock(node.raw)}</details><details class="moreBlock"><summary>Outgoing raw edges</summary>${renderEdges(outEdges)}</details><details class="moreBlock"><summary>Incoming raw edges</summary>${renderEdges(inEdges)}</details></details></section>`
}

function renderModelRow(node: OpenRouterRawNode, searchOnly = false, graph?: OpenRouterRawGraph): string {
  const modalities = `${node.derived.inputModalities.join(' · ') || '—'} → ${node.derived.outputModalities.join(' · ') || '—'}`
  return `<tr data-model-row data-search-only="${searchOnly ? 'true' : 'false'}" data-model-status="${escapeHtml(node.status)}" data-model-provider="${escapeHtml(node.provider)}" data-model-author="${escapeHtml(normalizedAuthorValue(node.derived.author))}" data-output-modalities="${escapeHtml(node.derived.outputModalities.join(' ').toLowerCase())}" data-model-name="${escapeHtml(`${node.displayName} ${node.provider} ${node.modelId} ${node.sourceId} ${node.derived.author ?? ''}`.toLowerCase())}"><td><div class="modelName">${renderLogoIcon(undefined, `${node.providerName} logo`, node.providerName.slice(0, 1), 'modelIcon')}<div><a class="modelLink" href="${escapeHtml(node.route)}/">${escapeHtml(node.displayName)}</a><div class="modelSub">${renderModelTagCopy(node.modelId)}</div><div class="modelSub rawSource">${escapeHtml(node.derived.author ?? '—')} · ${escapeHtml(modalities)}</div></div></div></td><td class="mono">${escapeHtml(modelContextLength(node))}</td><td class="mono">${modelPriceCell(node, 'prompt', graph)}</td><td class="mono">${modelPriceCell(node, 'completion', graph)}</td><td class="mono">${modelPriceCell(node, 'input_cache_read', graph)}</td><td class="mono">${escapeHtml(modelReleasedDate(node))}</td></tr>`
}

function modelPriceCell(node: OpenRouterRawNode, key: string, graph?: OpenRouterRawGraph): string {
  const endpoint = currentProviderEndpoints(node)[0]
  if (!endpoint || !isRecord(endpoint.pricing)) return '—'
  const value = endpoint.pricing[key]
  if (value === null || value === undefined || value === '') return '—'
  return formatUsdPerMillionTokensWithRate(value, graph?.currency?.rate)
}

function formatUsdPerMillionTokensWithRate(value: unknown, cnyRate?: number): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return `$${escapeHtml(String(value))}`
  return currencyPriceHtml(numeric * 1_000_000, cnyRate)
}

function page(title: string, body: string, activePage: ActivePage, navExtra = ''): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body>${nav(activePage, navExtra)}${body}<script>${copyModelTagScript()}</script>${footer()}</body></html>`
}

function nav(activePage: ActivePage, navExtra = ''): string {
  const modelsClass = activePage === 'models' ? ' class="active"' : ''
  const search = activePage === 'models' ? '<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / provider / author / source" autocomplete="off"></label>' : '<div class="topSearch">⌕ 搜索</div>'
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/models/">${databaseLogo()}<span>mddb.dev</span><span class="brandZh">大模型数据库</span></a>${search}<a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">${githubLogo()}</a><div class="navlinks"><span class="disabled" aria-disabled="true">模型动态</span><a${modelsClass} href="/models/">模型广场</a></div>${navExtra}</nav></header>`
}

function currencyToggle(graph: OpenRouterRawGraph): string {
  const currency = graph.currency
  if (!currency) return ''
  const title = `${formatDisplayNumber(1)} USD / ${formatDisplayNumber(currency.rate)} CNY · ${currency.source}`
  return `<div class="currencyControl"><div class="currencyToggle" data-currency-toggle title="${escapeHtml(title)}"><button type="button" class="active" data-currency="USD">1 USD</button><button type="button" data-currency="CNY">${escapeHtml(formatDisplayNumber(currency.rate))} CNY</button></div></div>`
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

function authorFilterOptions(graph: OpenRouterRawGraph): Array<{ label: string; value: string; count: number }> {
  const counts = new Map<string, { label: string; value: string; count: number }>()
  const searchOnlyNodeIds = modelPlazaSearchOnlyNodeIds(graph)
  for (const node of graph.nodes) {
    if (searchOnlyNodeIds.has(node.id)) continue
    const value = normalizedAuthorValue(node.derived.author)
    const label = authorLabel(value)
    const current = counts.get(value)
    if (current === undefined) counts.set(value, { label, value, count: 1 })
    else current.count += 1
  }
  const featured = featuredAuthorValues()
  const rows = Array.from(counts.values()).sort((a, b) => {
    const ai = featured.indexOf(a.value)
    const bi = featured.indexOf(b.value)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return b.count - a.count || a.label.localeCompare(b.label)
  })
  return rows
}

function modelPlazaSearchOnlyNodeIds(graph: OpenRouterRawGraph): Set<string> {
  const resolvedEdgeTypes = new Set(['deployment_of', 'alias_of', 'snapshot_of'])
  return new Set(graph.edges.filter((edge) => edge.from !== edge.to && resolvedEdgeTypes.has(edge.type)).map((edge) => edge.from))
}

function renderAuthorFilterGroup(graph: OpenRouterRawGraph, options: Array<{ label: string; value: string; count: number }>, total: number): string {
  const featured = new Set(featuredAuthorValues())
  const primary = options.filter((option) => featured.has(option.value))
  const other = options.filter((option) => !featured.has(option.value))
  const others = other.length > 0 ? `<details class="filterMore"><summary>其他厂牌 <small>${other.reduce((sum, option) => sum + option.count, 0)}</small></summary>${other.map((option) => renderFilterOption(graph, 'author', option)).join('')}</details>` : ''
  return `<div class="filterGroup"><div class="filterHead"><span>厂牌</span><span>⌄</span></div>${renderFilterOption(graph, 'author', { label: '全部', value: 'all', count: total }, true)}${primary.map((option) => renderFilterOption(graph, 'author', option)).join('')}${others}</div>`
}

function featuredAuthorValues(): string[] {
  return ['openai', 'qwen', 'anthropic', 'google', 'deepseek', 'z-ai', 'minimax', 'bytedance', 'moonshotai', 'xiaomi', 'x-ai']
}

function normalizedAuthorValue(author: string | null | undefined): string {
  const raw = (author ?? 'unknown').trim().toLowerCase() || 'unknown'
  if (raw === 'bytedance-seed') return 'bytedance'
  return raw
}

function authorLabel(value: string): string {
  const labels: Record<string, string> = {
    qwen: 'Qwen',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    deepseek: 'DeepSeek',
    'z-ai': 'Z.ai',
    minimax: 'MiniMax',
    bytedance: 'ByteDance',
    moonshotai: 'Moonshot',
    xiaomi: 'Xiaomi',
    'x-ai': 'xAI',
  }
  return labels[value] ?? value
}

function renderFilterOption(graph: OpenRouterRawGraph, group: string, option: { label: string; value: string; count: number }, checked = false): string {
  return `<label class="filterOption"><input type="radio" name="${escapeHtml(group)}-filter" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(option.value)}"${checked ? ' checked' : ''}>${renderLogoIcon(brandLogoUrl(graph, option.value), `${option.label} logo`, option.label.slice(0, 1), 'filterLogo')}<span>${escapeHtml(option.label)}</span><small>${option.count}</small></label>`
}

function brandLogoUrl(graph: OpenRouterRawGraph, value: string): string | undefined {
  if (value === 'all') return undefined
  return graph.enrichment?.modelsDev?.brandLogos?.[value]
}

function renderLogoIcon(logoUrl: string | undefined, alt: string, fallback: string, className: string): string {
  if (logoUrl) return `<span class="${escapeHtml(className)}"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(alt)}" loading="lazy"></span>`
  return `<span class="${escapeHtml(className)}">${escapeHtml(fallback)}</span>`
}

function stat(label: string, value: string | number): string {
  return `<div class="statCard"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`
}

function kv(label: string, value: string): string {
  return `<div class="metabox"><span>${escapeHtml(label)}</span><b>${value}</b></div>`
}

function renderEdges(edges: OpenRouterRawEdge[]): string {
  if (edges.length === 0) return '<p class="muted">无</p>'
  return edges.map((edge) => `<div class="edge"><strong>${escapeHtml(edge.type)}</strong> → <code>${escapeHtml(edge.to)}</code><br><small>${escapeHtml(edge.label)}</small>${edge.raw ? `<details><summary>raw edge</summary>${rawBlock(edge.raw)}</details>` : ''}</div>`).join('')
}

function endpointList(node: OpenRouterRawNode): Record<string, unknown>[] {
  const wrapper = node.raw.endpointWrapper
  if (!isRecord(wrapper) || !isRecord(wrapper.response) || !isRecord(wrapper.response.data) || !Array.isArray(wrapper.response.data.endpoints)) return []
  return wrapper.response.data.endpoints.filter(isRecord)
}

function rawBlock(value: unknown): string {
  return `<pre class="raw">${escapeHtml(JSON.stringify(value ?? null, null, 2))}</pre>`
}

function renderModelTagCopy(tag: string): string {
  const safeTag = escapeHtml(tag)
  return `<span class="modelTagCopy"><code class="mono">${safeTag}</code><button class="copyTagBtn" type="button" data-copy-model-tag="${safeTag}" aria-label="复制模型 tag ${safeTag}" title="复制模型 tag"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></span>`
}

function copyModelTagScript(): string {
  return String.raw`(function(){
const buttons=Array.from(document.querySelectorAll('[data-copy-model-tag]'));
buttons.forEach(button=>button.addEventListener('click',async()=>{
  const tag=button.dataset.copyModelTag||'';
  try{await navigator.clipboard.writeText(tag);const previous=button.innerHTML;button.classList.add('copied');button.textContent='已复制';setTimeout(()=>{button.innerHTML=previous;button.classList.remove('copied')},1200)}catch(error){button.textContent='复制失败'}
}));
})();`
}

function modelFilterScript(): string {
  return String.raw`(function(){
const filterInputs=Array.from(document.querySelectorAll('[data-filter-group]'));
const outputButtons=Array.from(document.querySelectorAll('[data-output-filter]'));
const modelRows=Array.from(document.querySelectorAll('[data-model-row]'));
const q=document.getElementById('q');
const visibleCount=document.getElementById('visibleCount');
let outputFilter='all';
function selected(group){const input=filterInputs.find(input=>input.dataset.filterGroup===group&&input.checked);return input?input.dataset.filterValue:'all'}
function applyModelFilters(){
  const author=selected('author');
  const query=(q&&q.value||'').toLowerCase();
  let count=0;
  modelRows.forEach(row=>{
    const authorOk=author==='all'||author===(row.dataset.modelAuthor||'');
    const searchOnly=row.dataset.searchOnly==='true';
    const outputOk=outputFilter==='all'||(row.dataset.outputModalities||'').split(/\s+/).includes(outputFilter);
    const queryOk=!query||(row.dataset.modelName||row.innerText||'').toLowerCase().includes(query);
    const visibilityOk=!searchOnly||!!query;
    const visible=authorOk&&outputOk&&queryOk&&visibilityOk;
    row.hidden=!visible;
    if(visible) count+=1;
  });
  if(visibleCount) visibleCount.textContent=String(count);
}
filterInputs.forEach(input=>input.addEventListener('change',applyModelFilters));
outputButtons.forEach(button=>button.addEventListener('click',()=>{outputFilter=button.dataset.outputFilter||'all';outputButtons.forEach(item=>item.classList.toggle('active',item===button));applyModelFilters();}));
if(q) q.addEventListener('input',applyModelFilters);
window.applyModelFilters=applyModelFilters;
applyModelFilters();
})();`
}

function currencyToggleScript(): string {
  return String.raw`
(function(){
const toggle=document.querySelector('[data-currency-toggle]');
if(!toggle)return;
const buttons=Array.from(toggle.querySelectorAll('[data-currency]'));
const prices=Array.from(document.querySelectorAll('[data-usd][data-cny]'));
function setCurrency(currency){
  buttons.forEach(button=>button.classList.toggle('active',button.dataset.currency===currency));
  prices.forEach(price=>{
    const amount=price.querySelector('.priceAmount');
    const symbol=price.querySelector('.priceCurrencySymbol');
    if(amount) amount.textContent=currency==='CNY' ? price.dataset.cny : price.dataset.usd;
    if(symbol) symbol.textContent=currency==='CNY' ? '¥' : '$';
  });
  try{localStorage.setItem('mddb.currency',currency)}catch(error){}
}
buttons.forEach(button=>button.addEventListener('click',()=>setCurrency(button.dataset.currency||'USD')));
let saved='USD';
try{saved=localStorage.getItem('mddb.currency')||'USD'}catch(error){}
setCurrency(saved==='CNY'?'CNY':'USD');
})();`
}

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
