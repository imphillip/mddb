import type { OpenRouterRawEdge, OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'
import { PRICE_COMPONENT_KEYS } from './normalize/schema.js'

const css = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');
:root{--bg:#fff;--fg:#171717;--muted:#666;--soft:#fafafa;--line:#eaeaea;--line2:#f2f2f2;--blue:#2563eb;--green:#0a7f42;--shadow:rgba(0,0,0,.06) 0 1px 2px,rgba(0,0,0,.04) 0 6px 20px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--fg);font-family:Geist,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-feature-settings:'liga'}a{color:inherit;text-decoration:none}.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}.nav{height:60px;max-width:1360px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:22px}.brandmark{font-weight:600;letter-spacing:-.4px;display:flex;align-items:center;gap:10px}.brandZh{color:#666;font-weight:500;letter-spacing:0;font-size:14px;border-left:1px solid var(--line);padding-left:10px}.logo{width:22px;height:22px;border-radius:7px;background:#171717;display:inline-grid;place-items:center;color:#fff}.logo svg{width:15px;height:15px;display:block}.topSearch{width:300px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#7a7a7a;display:flex;align-items:center;gap:8px;padding:0 13px;font-size:13px}.topSearch input{border:0;background:transparent;outline:0;width:100%;font:inherit;color:#333}.topSearch input::placeholder{color:#999}.navlinks{display:flex;align-items:center;gap:14px;margin-left:auto;font-size:14px;color:#555}.navlinks a,.navlinks span{padding:20px 0 18px;border-bottom:2px solid transparent}.navlinks a.active{color:#111;border-bottom-color:#111}.navlinks .disabled{color:#aaa;cursor:not-allowed;pointer-events:none;border-bottom-color:transparent}.githubLink{width:34px;height:34px;border:1px solid var(--line);border-radius:999px;display:inline-grid;place-items:center;color:#555;background:#fff;flex:0 0 34px;padding:0}.githubLink:hover{color:#111;border-color:#cfcfcf;background:#fafafa}.githubLink svg{width:18px;height:18px;display:block}.priceLine{display:block;white-space:nowrap}.priceLine+.priceLine{margin-top:3px}.priceTier{color:#999;font-size:12px;margin-top:4px}.tierIcon{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:6px;border:1px solid var(--line);border-radius:999px;background:#fafafa;color:#777;font-size:11px;line-height:1;vertical-align:-1px}.wrap{max-width:1180px;margin:0 auto;padding:0 24px}.homeEmpty{min-height:calc(100vh - 60px);display:grid;place-items:center;text-align:center}.homeEmpty h1{font-size:52px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.homeEmpty p{color:var(--muted);font-size:16px}.eyebrow{font:500 12px 'Geist Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em;color:#777}.modelsShell{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:268px minmax(0,1fr);min-height:calc(100vh - 60px)}.filterPanel{border-right:1px solid var(--line);padding:28px 18px 48px;background:#fff}.filterTitle{font-size:13px;font-weight:600;margin:0 0 12px;color:#333}.filterGroup{border-bottom:1px solid var(--line2);padding:14px 0}.filterHead{display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500}.filterMore{margin-top:6px}.filterMore summary{cursor:pointer;color:#666;font-size:13px;padding:8px 0;list-style:none}.filterMore summary::-webkit-details-marker{display:none}.filterMore summary::after{content:'展开';float:right;color:#999}.filterMore[open] summary::after{content:'收起'}.filterMore[open] summary{color:#333}.filterOption{display:flex;align-items:center;gap:9px;padding:8px 0;color:#555;font-size:14px}.filterLogo{width:18px;height:18px;border:1px solid var(--line);border-radius:5px;background:#fff;display:inline-grid;place-items:center;flex:0 0 auto;font-size:10px;font-weight:600;color:#555;overflow:hidden}.filterLogo img{max-width:13px;max-height:13px}.check{width:16px;height:16px;border:1px solid #cfcfcf;border-radius:4px;display:inline-grid;place-items:center;font-size:11px;color:#fff}.check.on{background:#111;border-color:#111}.mainPanel{padding:30px 32px 80px;overflow:hidden}.plazaHead{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:22px}.plazaHead h1{font-size:38px;letter-spacing:-1.6px;margin:0}.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.modelSearch{width:260px;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit}.btn{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 12px;font-weight:500;color:#333}.iconBtn{width:38px;padding:0}.tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:8px;overflow:auto}.tab{display:flex;gap:6px;align-items:center;padding:12px 10px 10px;border-bottom:2px solid transparent;color:#666;font-size:14px;white-space:nowrap}.tab.active{color:#111;border-bottom-color:#111}.tab b{font-weight:500}.tableWrap{overflow:auto}.modelTable{width:100%;border-collapse:collapse;table-layout:fixed;min-width:880px}.modelTable th:nth-child(1){width:auto}.modelTable th:nth-child(2){width:112px}.modelTable th:nth-child(3){width:280px}.modelTable th:nth-child(4){width:104px}.modelTable th{text-align:left;color:#777;font-size:12px;font-weight:500;padding:13px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.modelTable td{padding:16px 12px;border-bottom:1px solid var(--line2);vertical-align:middle;font-size:14px}.modelTable td:nth-child(2),.modelTable td:nth-child(4){white-space:nowrap}.modelTable td:nth-child(3){white-space:nowrap}.modelName{display:flex;align-items:center;gap:11px;min-width:0}.modelIcon{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:#fafafa;display:grid;place-items:center;font-weight:600;font-size:13px;overflow:hidden}.modelIcon img{max-width:20px;max-height:20px}.providerIcon{width:22px;height:22px;border-radius:6px;border:1px solid var(--line);background:#fff;display:inline-grid;place-items:center;vertical-align:middle;margin-right:8px;overflow:hidden;font-size:11px}.providerIcon img{max-width:16px;max-height:16px}.modelLink{font-weight:500}.modelLink:hover{text-decoration:underline;text-underline-offset:3px}.modelSub{color:#777;font-size:12px;margin-top:4px}.modelTagCopy{display:inline-flex;align-items:center;gap:6px;color:#555}.modelTagCopy code{background:#f5f5f5;border:1px solid var(--line);border-radius:6px;padding:2px 6px;font-size:11px}.copyTagBtn{border:1px solid var(--line);border-radius:999px;background:#fff;color:#555;padding:2px 7px;font:500 11px Geist,system-ui,sans-serif;cursor:pointer}.copyTagBtn:hover{border-color:#cfcfcf;color:#111;background:#fafafa}.pill{display:inline-flex;align-items:center;border-radius:999px;background:#f5f7ff;color:#1d4ed8;padding:2px 8px;font-size:12px;font-weight:500}.mono{font-family:'Geist Mono',ui-monospace,monospace}.muted{color:var(--muted)}.detailHero{border-bottom:1px solid var(--line);padding:64px 0 36px;background:linear-gradient(180deg,#fafafa,#fff)}.detailHero h1{font-size:54px;line-height:1;letter-spacing:-2.4px;margin:12px 0}.detailHero p{max-width:760px;color:#4d4d4d;line-height:1.7;font-size:18px}.detailGrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:28px;padding-top:38px;padding-bottom:80px}.toc{display:flex;gap:16px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:24px}.toc a{font-size:14px;color:#666}.toc a:hover{color:#171717}.panel{box-shadow:var(--shadow);border:1px solid var(--line);border-radius:12px;background:#fff;padding:22px;margin-bottom:16px}.panel h2{font-size:28px;letter-spacing:-1px;margin:0 0 12px}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.metabox{background:#fafafa;border-radius:8px;padding:10px;border:1px solid var(--line)}.metabox span{display:block;color:#808080;font-size:11px;text-transform:uppercase}.metabox b{font-size:13px;overflow-wrap:anywhere}.metaWide{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.providerRow,.variant{border-top:1px solid var(--line);padding:16px 0}.providerRow:first-of-type,.variant:first-of-type{border-top:0}.rowTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.providers{font-size:13px;color:#4d4d4d;line-height:1.5}.providers strong{color:#171717}.priceGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.apiBox{background:#171717;color:#fff;border-radius:10px;padding:16px;font-family:'Geist Mono',monospace;font-size:13px;overflow:auto}.footer{border-top:1px solid var(--line);padding:28px 24px;color:#666;font-size:13px}@media(max-width:900px){.topSearch{display:none}.navlinks{gap:14px}.modelsShell,.detailGrid{grid-template-columns:1fr}.filterPanel{border-right:0;border-bottom:1px solid var(--line)}.plazaHead{align-items:flex-start;flex-direction:column}.modelSearch{width:100%}.meta{grid-template-columns:1fr}.detailHero h1{font-size:42px}}

.detailSingle{display:block;max-width:980px;padding-top:38px;padding-bottom:80px}.backToPlaza{display:inline-flex;align-items:center;justify-content:center;margin-bottom:22px}.priceVariantGrid{display:grid;gap:16px}.priceVariantCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:18px}.priceVariantCard h3{margin:0 0 14px;line-height:1.35}.priceTier+.priceTier{border-top:1px solid var(--line2);margin-top:10px;padding-top:10px}.tierLabel{font-size:13px;color:#555;font-weight:500;margin-bottom:6px}.offerMeta{margin-bottom:12px}.aliasHero{margin-top:12px;display:grid;gap:8px}.aliasRow{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.aliasKey{color:#777;font-size:13px;min-width:96px}.aliasVals{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.delistedBadge{display:inline-flex;align-items:center;border:1px solid #f0c0c0;background:#fdf0f0;color:#b3261e;border-radius:999px;padding:2px 8px;font-size:12px;font-weight:500;margin-left:8px;white-space:nowrap}tr[data-delisted="true"] .modelLink{color:#999}.priceList{display:grid;gap:0;margin:0}.priceItem{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line2);padding:10px 0;line-height:1.45}.priceItem:first-child{padding-top:0}.priceItem:last-child{border-bottom:0;padding-bottom:0}.priceItem dt{color:#777}.priceItem dd{margin:0;text-align:right}.statusLine{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.priceVariantCard+.priceVariantCard{margin-top:0}.detailHeroCompact{padding:52px 0 30px}.summaryStrip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:24px;max-width:900px}.summaryStrip div{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}.summaryStrip span{display:block;color:#777;font-size:12px;margin-bottom:4px}.summaryStrip b{font-size:18px;letter-spacing:-.3px}.priorityPanel{border-color:#dbe7ff;background:linear-gradient(180deg,#fbfdff,#fff)}.subtlePanel{background:#fcfcfc}.metadataPanel details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;width:max-content}.metadataPanel details>summary::-webkit-details-marker{display:none}.metadataPanel details>summary h2{margin:0}.metadataPanel .detailsChevron{color:#777;font-size:18px;line-height:1;transition:transform .16s ease}.metadataPanel details[open] .detailsChevron{transform:rotate(180deg)}.metadataPanel .raw{margin-top:0}.codeBlockShell{margin-top:16px;border:1px solid var(--line);border-radius:12px;background:#0f172a;overflow:hidden}.codeBlockToolbar{height:38px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 10px;border-bottom:1px solid rgba(255,255,255,.1);color:#cbd5e1;font-size:12px}.copyCodeBtn{border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);color:#e5e7eb;padding:4px 10px;font:500 12px Geist,system-ui,sans-serif;cursor:pointer}.copyCodeBtn:hover{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3)}.copyCodeBtn.copied{color:#bbf7d0;border-color:rgba(187,247,208,.4)}.codeBlock{display:block;margin:0;padding:16px;max-width:100%;white-space:pre;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;background:#0f172a;color:#e5e7eb;font-size:12px;line-height:1.6;border:0;border-radius:0}.codeBlock code{display:block;width:max-content;min-width:100%;white-space:inherit;background:transparent;color:inherit}.stickyCard{position:sticky;top:82px}.availabilityGrid{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.pricingProviderHint{margin-top:16px;margin-bottom:0;line-height:1.6}.providerChip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;background:#fafafa;padding:7px 11px;font-size:13px;color:#333;line-height:1}.providerCloud{line-height:1.8}.sourceList{display:grid;gap:8px;margin-top:14px}.sourceItem{display:flex;justify-content:space-between;gap:14px;border:1px solid var(--line);border-radius:10px;padding:12px;background:#fafafa}.sourceItem span{color:#666;font-size:13px}.relationChips{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.relationChip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;font-size:13px;color:#333}.relationChip small{color:#777}.modelIdHero{margin-top:12px;font-size:15px;color:#555}.heroRelations{margin-top:14px}.relationPanel{margin-bottom:16px}.relationPanel .relationChips{margin-bottom:0}.specRows{display:grid;gap:10px;margin-top:16px}.specRow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.reviewList{margin:0;padding-left:18px;color:#555;line-height:1.7}.specVariant{border:1px solid var(--line);border-radius:12px;padding:16px;margin:12px 0;background:#fff}.specVariant+.specVariant{border-top:1px solid var(--line)}.moreBlock{margin-top:12px;border:1px dashed var(--line);border-radius:12px;padding:12px;background:#fcfcfc}.moreBlock summary{cursor:pointer;color:#555;font-weight:500}.modelTable th{background:#fafafa}.modelTable td,.modelTable th{line-height:1.45}.modelTable td:nth-child(3){text-align:right}.copyTagBtn svg{width:13px;height:13px;display:block}.copyTagBtn.copied{width:auto;padding:2px 7px}@media(max-width:900px){.summaryStrip{grid-template-columns:repeat(2,1fr)}.stickyCard{position:static}.sourceItem{display:block}.sourceItem span{display:block;margin-top:4px}}
.badge{display:inline-flex;border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:2px 8px;font-size:12px;margin:2px;color:#555}.badge.api{color:var(--green)}.badge.page_only{color:#b91c1c}.statGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:18px 0 24px}.statCard{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;box-shadow:var(--shadow)}.statCard span{display:block;color:#777;font-size:12px;margin-bottom:4px}.statCard b{font-size:20px;letter-spacing:-.3px}.rawIntro{max-width:880px;color:#666;line-height:1.7}.filterHint{color:#999;font-size:12px;margin-top:8px}.edge{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:#fff}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section{margin-bottom:18px}.kv{display:grid;grid-template-columns:180px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid var(--line2)}.kv span{color:#777}.kv b{font-weight:500;word-break:break-word}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.tabs a{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:#fff;color:#333}.modelTable td:nth-child(3){text-align:left}.rawSource{word-break:break-all}.mono,code,pre{font-family:Geist Mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.statusLine{display:flex;flex-wrap:wrap;gap:4px}.providerSummary{color:#777;font-size:12px;margin-top:4px}.providerRailNewsList{display:grid;gap:10px;margin-top:12px}.providerRailNewsCard{border-top:1px solid var(--line2);padding-top:10px}.providerRailNewsCard time{display:block;color:#999;font-size:11px;margin-bottom:4px}.providerRailNewsCard a{display:block;color:#333;font-size:13px;line-height:1.45}.providerRailNewsCard a:hover{text-decoration:underline;text-underline-offset:3px}.searchBox{width:100%;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 12px;font:14px inherit;margin-bottom:14px}.listToolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 18px}.listCount{color:#555;font-size:14px}.listCount b{color:#111}.quickFilters{display:flex;gap:8px;flex-wrap:wrap}.quickFilter{border:1px solid var(--line);border-radius:999px;background:#fff;color:#444;padding:7px 11px;font:500 13px inherit;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.quickFilterCount{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;border-radius:999px;background:#f2f2f2;color:#666;font-size:11px;padding:0 6px}.quickFilter:hover,.quickFilter.active{border-color:#111;color:#111;background:#fafafa}.quickFilter.active .quickFilterCount{background:#111;color:#fff}.filterOption input{accent-color:#111}@media(max-width:900px){.statGrid,.two{grid-template-columns:1fr}.kv{grid-template-columns:1fr}.modelTable{min-width:900px}}@media(max-width:720px){.nav{height:auto;min-height:56px;padding:10px 14px;gap:10px;flex-wrap:wrap}.brandmark{gap:8px;min-width:0}.brandmark span:not(.logo):not(.brandZh){font-size:15px}.brandZh{display:none}.githubLink{order:2}.navlinks{order:3;margin-left:0;gap:12px;font-size:13px}.navlinks a,.navlinks span{padding:8px 0 6px}.topSearch{order:5;width:100%;display:flex;height:34px}.modelsShell{display:block;min-height:auto}.filterPanel{position:static;border-right:0;border-bottom:1px solid var(--line);padding:16px 14px;background:#fff}.filterGroup{padding:10px 0}.filterOption{padding:7px 0}.mainPanel{padding:20px 14px 56px;overflow:visible}.plazaHead{align-items:flex-start;flex-direction:column;margin-bottom:16px}.plazaHead h1{font-size:30px;letter-spacing:-.8px}.listToolbar{overflow-x:auto;margin:0 -14px 16px;padding:0 14px}.quickFilters{flex-wrap:nowrap}.quickFilter{white-space:nowrap}.tableWrap{margin:0 -14px;padding:0 14px;overflow-x:auto;-webkit-overflow-scrolling:touch}.modelTable{min-width:760px}.modelTable td{padding:12px 10px}.modelName{min-width:230px}.detailHero{padding:34px 0 22px}.detailHero h1{font-size:34px;letter-spacing:-1.2px}.wrap{padding:0 14px}.detailSingle{padding-top:22px;padding-bottom:56px}.panel{padding:16px;border-radius:12px}.panel h2{font-size:24px}.toc{overflow-x:auto;flex-wrap:nowrap;white-space:nowrap}.summaryStrip{grid-template-columns:1fr}.specRow{grid-template-columns:1fr}.priceItem{display:block}.priceItem dd{text-align:left;margin-top:4px}.providerNewsRail .filterGroup{border-bottom:0}.providerRailNewsList{gap:8px}}`

type ActivePage = 'models'

export function renderOpenRouterRawHome(graph: OpenRouterRawGraph): string {
  const authorOptions = authorFilterOptions(graph)
  const searchOnlyNodeIds = modelPlazaSearchOnlyNodeIds(graph)
  const visibleRows = graph.nodes.filter((node) => !searchOnlyNodeIds.has(node.id)).length
  const rows = graph.nodes.slice().filter((node) => !searchOnlyNodeIds.has(node.id)).sort(compareNodesByReleaseDesc).map((node) => renderModelRow(node, false, graph)).join('')
  const quickFilters = renderOutputQuickFilters(graph, searchOnlyNodeIds, visibleRows)
  const body = `<main class="modelsShell"><aside class="filterPanel" aria-label="模型筛选">${renderAuthorFilterGroup(graph, authorOptions, visibleRows)}</aside><section class="mainPanel"><div class="listToolbar"><div class="quickFilters" aria-label="模态筛选">${quickFilters}</div></div><div class="tableWrap"><table class="modelTable"><thead><tr><th>模型</th><th>上下文</th><th>价格</th><th>发布</th></tr></thead><tbody id="rows">${rows}</tbody></table></div><script>${modelFilterScript()}</script></section></main>`
  return page('模型列表 · mddb.dev', body, 'models')
}


function renderOutputQuickFilters(graph: OpenRouterRawGraph, searchOnlyNodeIds: Set<string>, visibleRows: number): string {
  const filters = outputQuickFilters(visibleRows, (modality) => outputModalityCount(graph, searchOnlyNodeIds, modality))
  return filters.map((filter, index) => `<button class="quickFilter${index === 0 ? ' active' : ''}" type="button" data-output-filter="${escapeHtml(filter.value)}">${escapeHtml(filter.label)} <span class="quickFilterCount"${filter.value === 'all' ? ' id="visibleCount"' : ''}>${filter.count}</span></button>`).join('')
}

function outputQuickFilters(total: number, count: (modality: string) => number): Array<{ value: string; label: string; count: number }> {
  const filters = [
    { value: 'all', label: '全部', count: total },
    { value: 'text', label: 'Text', count: count('text') },
    { value: 'image', label: 'Image', count: count('image') },
    { value: 'embeddings', label: 'Embedding', count: count('embeddings') },
    { value: 'audio', label: 'Audio', count: count('audio') },
    { value: 'video', label: 'Video', count: count('video') },
    { value: 'rerank', label: 'Rerank', count: count('rerank') },
    { value: 'speech', label: 'Speech', count: count('speech') },
    { value: 'transcription', label: 'Transcription', count: count('transcription') },
  ]
  return filters.filter((filter) => filter.value === 'all' || filter.count > 0)
}

function normalizedOutputModalities(node: OpenRouterRawNode): string[] {
  const aliases = new Map([
    ['embedding', 'embeddings'],
    ['embeddings', 'embeddings'],
    ['ranking', 'rerank'],
    ['reranking', 'rerank'],
    ['rerank', 'rerank'],
  ])
  const rawMode = rawModelField(node, 'mddb_registry.other_parameters.litellm.mode')
  const fromMode = rawMode === 'audio_transcription' ? ['transcription'] : rawMode === 'audio_speech' ? ['speech'] : []
  return Array.from(new Set([...node.derived.outputModalities, ...fromMode]
    .map((value) => aliases.get(value.toLowerCase()) ?? value.toLowerCase())
    .filter(Boolean)))
}

function nodeOutputModalityCount(nodes: OpenRouterRawNode[], modality: string): number {
  return nodes.filter((node) => normalizedOutputModalities(node).includes(modality)).length
}

function outputModalityCount(graph: OpenRouterRawGraph, searchOnlyNodeIds: Set<string>, modality: string): number {
  return graph.nodes.filter((node) => !searchOnlyNodeIds.has(node.id) && normalizedOutputModalities(node).includes(modality)).length
}


export function compareNodesByReleaseDesc(a: OpenRouterRawNode, b: OpenRouterRawNode): number {
  const diff = modelReleaseTimestamp(b) - modelReleaseTimestamp(a)
  return diff !== 0 ? diff : a.displayName.localeCompare(b.displayName)
}

function modelReleaseTimestamp(node: OpenRouterRawNode): number {
  const created = rawModelField(node, 'created')
  const timestamp = Number(created)
  if (Number.isFinite(timestamp)) return timestamp
  const snapshot = snapshotDateFromModelId(node.sourceId) ?? snapshotDateFromModelId(node.modelId)
  if (!snapshot) return 0
  const time = Date.parse(`${snapshot}T00:00:00.000Z`)
  return Number.isFinite(time) ? Math.floor(time / 1000) : 0
}

export function renderOpenRouterRawDetail(graph: OpenRouterRawGraph, node: OpenRouterRawNode): string {
  const outEdges = graph.edges.filter((edge) => edge.from === node.id)
  const inEdges = graph.edges.filter((edge) => edge.to === node.id && edge.from !== node.id)
  const title = modelDetailTitle(node)
  const body = `<main><section class="detailHero detailHeroCompact"><div class="wrap"><a class="btn backToPlaza" href="/">← 返回模型广场</a><div class="eyebrow">${detailEyebrow(node)}</div><h1>${escapeHtml(title)}${delistedBadge(node)}</h1><div class="modelIdHero">Model ID ${renderModelTagCopy(node.modelId)}</div>${renderAliasHero(node)}<div hidden>${modelDescription(node)}</div>${renderHeroRelations(graph, node, outEdges, inEdges)}</div></section><div class="wrap detailSingle databaseDetail"><article><nav class="toc" aria-label="模型页面章节"><a href="#spec">规格</a><a href="#pricing">价格</a><a href="#source">元数据</a></nav>${renderSpecSection(node)}${renderPricingSection(graph, node, outEdges, inEdges)}${renderSourceSection(node, outEdges, inEdges)}</article></div></main>`
  return page(`${title} · mddb.dev`, body, 'models')
}

function modelDetailTitle(node: OpenRouterRawNode): string {
  const owner = node.derived.author ?? node.provider
  const label = displayProviderLabel(owner)
  if (!label) return node.displayName
  const prefix = `${label}: `
  return node.displayName.startsWith(prefix) ? node.displayName : `${prefix}${node.displayName}`
}

function detailEyebrow(node: OpenRouterRawNode): string {
  if (node.nodeKind === 'endpoint_deployment') return `Provider · ${escapeHtml(displayProviderLabel(node.providerName))}`
  return `Author · ${escapeHtml(node.derived.author ?? '—')}`
}


function displayProviderLabel(value: string): string {
  if (!value) return value
  const canonical = value.toLowerCase()
  if (canonical === 'openai') return 'OpenAI'
  if (canonical === 'xai') return 'xAI'
  if (canonical === 'qwen') return 'Qwen'
  if (canonical === 'deepseek') return 'DeepSeek'
  if (value === value.toLowerCase()) return value.split(/[-_]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
  return value
}

function renderHeroRelations(graph: OpenRouterRawGraph, node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  if (node.nodeKind === 'endpoint_deployment') return ''
  const nonDeploymentIncoming = inEdges.filter((edge) => edge.type !== 'deployment_of')
  const chips = relationChips(graph, outEdges, nonDeploymentIncoming)
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

function modelDeprecation(node: OpenRouterRawNode): { since: string } | null {
  const model = isRecord(node.raw.model) ? node.raw.model : {}
  const dep = isRecord(model.deprecation) ? model.deprecation : null
  if (!dep) return null
  return { since: typeof dep.since === 'string' ? dep.since : '' }
}

function delistedBadge(node: OpenRouterRawNode): string {
  const dep = modelDeprecation(node)
  if (!dep) return ''
  const since = dep.since ? ` ${escapeHtml(dep.since)}` : ''
  return `<span class="delistedBadge" title="已从所有数据源下架${dep.since ? ` · ${escapeHtml(dep.since)}` : ''}">已下架${since}</span>`
}

function renderAliasHero(node: OpenRouterRawNode): string {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const aliases = (Array.isArray(model.alias) ? model.alias : []).map(String).filter(Boolean)
  const aliasIds = (Array.isArray(model.alias_id) ? model.alias_id : []).map(String).filter(Boolean)
  const lines: string[] = []
  if (aliases.length) lines.push(`<div class="aliasRow"><span class="aliasKey">别名</span><span class="aliasVals">${aliases.map((alias) => `<span class="pill">${escapeHtml(alias)}</span>`).join(' ')}</span></div>`)
  if (aliasIds.length) lines.push(`<div class="aliasRow"><span class="aliasKey">路由 / 快照 ID</span><span class="aliasVals">${aliasIds.map(renderModelTagCopy).join(' ')}</span></div>`)
  return lines.length ? `<div class="aliasHero">${lines.join('')}</div>` : ''
}

function rawModelForDisplay(node: OpenRouterRawNode): unknown {
  return node.raw.displayModel ?? node.raw.model
}

function renderSpecSection(node: OpenRouterRawNode): string {
  return `<section id="spec" class="panel"><h2>规格</h2><div class="specRows">`
    + `<div class="specRow">${kv('Input modalities', node.derived.inputModalities.join(' · ') || '—')}${kv('Output modalities', node.derived.outputModalities.join(' · ') || '—')}</div>`
    + `<div class="specRow">${kv('Context length', modelContextLength(node))}${kv('Max input tokens', rawModelField(node, 'max_input_tokens'))}${kv('Max output tokens', modelMaxOutputTokens(node))}${kv('Max reasoning tokens', rawModelField(node, 'other_parameters.max_reasoning_tokens'))}</div>`
    + `<div class="specRow">${kv('Reasoning', modelCapability(node, 'reasoning'))}${kv('Tool calling', modelCapability(node, 'tool_calling'))}${kv('Tokenizer', rawModelField(node, 'architecture.tokenizer'))}</div>`
    + `<div class="specRow">${kv('Author', node.derived.author ?? '—')}${kv('Knowledge cutoff', rawModelField(node, 'knowledge_cutoff'))}${kv('Released', modelReleasedDate(node))}</div>`
    + `<div class="specRow">${kv('Supported parameters', rawModelArray(node, 'supported_parameters').join(' · ') || '—')}</div>`
    + `</div></section>`
}

function modelCapability(node: OpenRouterRawNode, key: string): string {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  if (model[key] === true) return '是'
  if (model[key] === false) return '否'
  return '—'
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
  let value: unknown = rawModelForDisplay(node)
  for (const part of path.split('.')) {
    if (!isRecord(value)) return '—'
    value = value[part]
  }
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

function rawModelArray(node: OpenRouterRawNode, key: string): string[] {
  const model = rawModelForDisplay(node)
  if (!isRecord(model) || !Array.isArray(model[key])) return []
  return model[key].map(String)
}

function renderPricingSection(graph: OpenRouterRawGraph, node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[], inEdges: OpenRouterRawEdge[]): string {
  void inEdges
  const canonicalLink = node.nodeKind === 'endpoint_deployment' ? canonicalModelLink(graph, node, outEdges) : ''
  const fallbackEndpoint = node.nodeKind === 'endpoint_deployment' ? undefined : sampleDeploymentPricingEndpoint(graph, node)
  // For canonical model pages, the embedded v2 offers are the source of truth.
  const registryPricing = node.nodeKind === 'source_model' ? registryPricingCards(node) : ''
  const endpointPricing = registryPricing ? '' : endpointPricingCards(node)
  const fallbackPricing = registryPricing || endpointPricing ? '' : fallbackDeploymentPricingCards(fallbackEndpoint, node)
  const litellmPricing = registryPricing || endpointPricing || fallbackPricing ? '' : litellmSupplementalPricingCards(node)
  const empty = canonicalLink ? '' : '<p class="muted">无结构化官方价格；如本节点为 alias/snapshot/deployment，请先看上方关联模型跳转到 anchor。</p>'
  return `<section id="pricing" class="panel"><h2>价格</h2>${canonicalLink}${endpointPricing || fallbackPricing || registryPricing || litellmPricing || empty}</section>`
}

function canonicalModelLink(graph: OpenRouterRawGraph, node: OpenRouterRawNode, outEdges: OpenRouterRawEdge[]): string {
  const edge = outEdges.find((candidate) => candidate.type === 'deployment_of')
  const target = edge ? graph.nodes.find((candidate) => candidate.id === edge.to) : undefined
  if (!target || target.route === node.route) return ''
  return `<p class="muted">当前是 provider deployment 页面。<a class="modelLink" href="${escapeHtml(target.route)}/">查看 canonical 模型页</a>。</p>`
}

function registryPricingCards(node: OpenRouterRawNode): string {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const offers = Array.isArray(model.offers) ? model.offers.filter((offer): offer is Record<string, unknown> => isRecord(offer)) : []
  if (offers.length > 0) {
    const cards = offers.map((offer) => offerCard(offer)).filter(Boolean).join('')
    if (cards) return `<div class="priceVariantGrid">${cards}</div>`
  }
  // Legacy fallback for fixtures that still nest prices under mddb_registry (no embedded offers).
  const prices = registryPriceRows(node)
  if (prices.length === 0) return ''
  const cards = prices.map((price) => registryPriceCard(price)).filter(Boolean).join('')
  return cards ? `<div class="priceVariantGrid">${cards}</div>` : ''
}

/** One card per v2 offer: source header + call metadata (endpoints, base_url, rate limits) + price tiers. */
function offerCard(offer: Record<string, unknown>): string {
  const currency = String(offer.currency ?? 'USD')
  const prices = Array.isArray(offer.prices) ? offer.prices.filter((price): price is Record<string, unknown> => isRecord(price)) : []
  const tiers = prices.map((price) => offerTier(price, currency)).filter(Boolean).join('')
  const meta = offerMeta(offer)
  const needsReview = isRecord(offer.other_params) && offer.other_params.pricing_status === 'needs_review'
  const body = tiers || (needsReview ? '<p class="muted">价格待人工核实（未自动抽取）。</p>' : '')
  if (!body && !meta) return ''
  const label = displayRegistryPriceSource(String(offer.source ?? 'offer'))
  return `<div class="priceVariantCard"><h3>${escapeHtml(label)}</h3>${meta}${body}</div>`
}

function offerTier(price: Record<string, unknown>, currency: string): string {
  const rows = PRICE_COMPONENT_KEYS
    .map((kind) => {
      const component = price[kind]
      if (!isRecord(component) || Number(component.amount) === 0) return '' // hide free/0 rows
      return registryPriceRow(kind, component, currency)
    })
    .filter(Boolean)
    .join('')
  if (!rows) return ''
  const label = conditionLabel(price.conditions)
  const head = label ? `<div class="tierLabel">${escapeHtml(label)}</div>` : ''
  return `<div class="priceTier">${head}<dl class="priceList">${rows}</dl></div>`
}

function offerMeta(offer: Record<string, unknown>): string {
  const chips: string[] = []
  if (typeof offer.endpoints === 'string' && offer.endpoints) chips.push(`<span class="badge">${escapeHtml(offer.endpoints)}</span>`)
  const params = isRecord(offer.other_params) ? offer.other_params : {}
  if (typeof params.RPM === 'number') chips.push(`<span class="badge">RPM ${params.RPM.toLocaleString('en-US')}</span>`)
  if (typeof params.TPM === 'number') chips.push(`<span class="badge">TPM ${params.TPM.toLocaleString('en-US')}</span>`)
  if (typeof offer.url === 'string' && offer.url) chips.push(`<a class="badge" href="${escapeHtml(offer.url)}" target="_blank" rel="noopener noreferrer">来源 ↗</a>`)
  return chips.length ? `<div class="statusLine offerMeta">${chips.join('')}</div>` : ''
}

function registryPriceCard(price: unknown): string {
  if (!isRecord(price)) return ''
  const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
  if (!unitPrices) return ''
  const rows = Object.entries(unitPrices).map(([kind, value]) => registryPriceRow(kind, value, String(price.currency ?? 'USD'))).filter(Boolean).join('')
  if (!rows) return ''
  const source = String(price.source ?? 'registry')
  const label = displayRegistryPriceSource(source)
  const condition = conditionLabel(price.conditions)
  const conditionSuffix = condition ? ` · ${condition}` : ''
  return `<div class="priceVariantCard"><h3>${escapeHtml(label)}${escapeHtml(conditionSuffix)}</h3><dl class="priceList">${rows}</dl></div>`
}

function registryPriceRow(kind: string, value: unknown, currency: string): string {
  if (!isRecord(value)) return ''
  return priceRow(registryPriceLabel(kind), value.amount, registryPriceUnit(String(value.unit ?? ''), currency))
}

function registryPriceLabel(kind: string): string {
  if (kind === 'input') return 'Input / prompt'
  if (kind === 'output') return 'Output / completion'
  if (kind === 'cache_read') return 'Cache read'
  if (kind === 'cache_write') return 'Cache write'
  return kind.split(/[_-]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
}

function registryPriceUnit(unit: string, currency: string): string {
  if (unit === 'per_1m_tokens' || unit === 'per_million_tokens') return `${currency}/direct_per_1M`
  if (unit === 'per_1m_audio_tokens') return `${currency}/direct_per_1M_audio`
  if (unit === 'per_video_second') return `${currency}/video_second`
  if (unit === 'per_second') return `${currency}/second`
  if (unit === 'per_query') return `${currency}/query`
  if (unit === 'per_image') return `${currency}/image`
  if (unit === 'per_pixel') return `${currency}/pixel`
  if (unit === 'per_page') return `${currency}/page`
  if (unit === 'per_audio_second') return `${currency}/audio_second`
  if (unit === 'per_video_second') return `${currency}/video_second`
  if (unit === 'per_request') return `${currency}/request`
  return unit
}

function conditionLabel(conditions: unknown): string {
  const first = Array.isArray(conditions) ? conditions[0] : conditions
  return isRecord(first) && typeof first.label === 'string' ? first.label : ''
}

function displayRegistryPriceSource(source: string): string {
  if (source === 'litellm') return 'LiteLLM'
  if (source === 'bailian_model_market') return 'Bailian Model Market'
  if (source === 'bailian') return '阿里云百炼'
  if (source === 'volcengine' || source === 'volcengine_ark') return '火山方舟'
  if (source === 'openrouter') return 'OpenRouter'
  return source.split(/[_-]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
}

function registryModel(node: OpenRouterRawNode): Record<string, unknown> {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  // v1 fixtures nested facts under mddb_model/mddb_registry; v2 spreads them at top level
  // (and carries offers), so fall back to the model itself when no nested object exists.
  if (isRecord(model.mddb_model)) return model.mddb_model
  if (isRecord(model.mddb_registry)) return model.mddb_registry
  return model
}

function registryPriceRows(node: OpenRouterRawNode): Record<string, unknown>[] {
  const registry = registryModel(node)
  if (Array.isArray(registry.prices)) return registry.prices.filter((price): price is Record<string, unknown> => isRecord(price))
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const offers = Array.isArray(model.offers) ? model.offers.filter((offer): offer is Record<string, unknown> => isRecord(offer)) : []
  const rows: Record<string, unknown>[] = []
  for (const offer of offers) {
    const prices = Array.isArray(offer.prices) ? offer.prices : []
    for (const price of prices) {
      if (!isRecord(price)) continue
      // v2 offers carry flat components ({input, output, cache_*}); v1 nested them under prices/unit_prices.
      const unitPrices = (isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined) ?? pickPriceComponents(price)
      rows.push({
        source: price.source ?? offer.source,
        source_id: price.source_id ?? offer.source_id,
        source_url: price.source_url ?? offer.url,
        currency: price.currency ?? offer.currency,
        conditions: price.conditions,
        unit_prices: unitPrices,
        prices: unitPrices,
      })
    }
  }
  return rows
}

function pickPriceComponents(price: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const key of PRICE_COMPONENT_KEYS) {
    if (isRecord(price[key])) out[key] = price[key]
  }
  return Object.keys(out).length ? out : undefined
}

function litellmSupplementalPricingCards(node: OpenRouterRawNode): string {
  const litellm = registryLitellm(node)
  const prices = Array.isArray(litellm?.prices) ? litellm.prices : []
  if (prices.length === 0) return ''
  const rows = prices.map((price) => litellmPriceRow(price)).filter(Boolean).join('')
  const meta = [
    `provider ${String(litellm?.provider ?? 'litellm')}`,
    `source ${String(litellm?.raw_id ?? node.sourceId)}`,
  ].map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('')
  return `<div class="priceVariantGrid"><div class="muted">LiteLLM 补充价格；仅用于非 chat 模态缺失结构化 provider 报价时。</div><div class="priceVariantCard"><h3>LiteLLM 补充价格</h3><dl class="priceList">${rows}</dl><div class="statusLine">${meta}</div></div></div>`
}

function registryLitellm(node: OpenRouterRawNode): Record<string, unknown> | null {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const registry = isRecord(model.mddb_registry) ? model.mddb_registry : {}
  const other = isRecord(registry.other_parameters) ? registry.other_parameters : {}
  return isRecord(other.litellm) ? other.litellm : null
}

function litellmPriceRow(price: unknown): string {
  if (!isRecord(price)) return ''
  return priceRow(litellmPriceLabel(String(price.kind ?? 'price'), typeof price.condition === 'string' ? price.condition : ''), price.amount, litellmPriceUnit(String(price.unit ?? '')))
}

function litellmPriceLabel(kind: string, condition = ''): string {
  const label = kind.split(/[_-]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
  return condition ? `${label} · ${condition}` : label
}

function litellmPriceUnit(unit: string): string {
  if (unit === 'per_1m_tokens') return 'USD/direct_per_1M'
  if (unit === 'per_1m_audio_tokens') return 'USD/direct_per_1M_audio'
  if (unit === 'per_query') return 'USD/query'
  if (unit === 'per_image') return 'USD/image'
  if (unit === 'per_second') return 'USD/second'
  if (unit === 'per_audio_second') return 'USD/audio_second'
  if (unit === 'per_video_second') return 'USD/video_second'
  if (unit === 'per_request') return 'USD/request'
  return unit
}

function endpointPricingCards(node: OpenRouterRawNode): string {
  const endpoints = currentProviderEndpoints(node)
  if (endpoints.length === 0) return ''
  return `<div class="priceVariantGrid">${endpoints.map((endpoint) => renderEndpointPricingCard(endpoint)).join('')}</div>`
}

function fallbackDeploymentPricingCards(endpoint: Record<string, unknown> | undefined, node: OpenRouterRawNode): string {
  if (!endpoint) return ''
  const provider = endpointProviderSlug(endpoint)
  const author = normalizedAuthorValue(node.derived.author)
  const label = displayProviderLabel(provider)
  const note = provider === author
    ? `${escapeHtml(displayProviderLabel(node.providerName))} provider 报价。`
    : `${escapeHtml(label)} provider 报价；canonical author 暂无自有报价。`
  return `<div class="priceVariantGrid"><div class="muted">${note}</div>${renderEndpointPricingCard(endpoint, provider)}</div>`
}

function currentProviderEndpoints(node: OpenRouterRawNode): Record<string, unknown>[] {
  if (node.nodeKind === 'endpoint_deployment') return isRecord(node.raw.endpoint) ? [node.raw.endpoint] : []
  return endpointList(node).filter((endpoint) => endpointProviderSlug(endpoint) === node.provider)
}

function endpointProviderSlug(endpoint: Record<string, unknown>): string {
  const tag = typeof endpoint.tag === 'string' && endpoint.tag.trim() ? endpoint.tag : String(endpoint.provider_name ?? 'unknown')
  return tag.replace(/\//gu, '-').trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-') || 'unknown'
}

function renderEndpointPricingCard(endpoint: Record<string, unknown>, sourceProvider = ''): string {
  const pricing = isRecord(endpoint.pricing) ? endpoint.pricing : {}
  const rows = [
    priceRow('Input / prompt', pricing.prompt, 'USD/1M tokens'),
    priceRow('Output / completion', pricing.completion, 'USD/1M tokens'),
    priceRow('Cache read', pricing.input_cache_read, 'USD/1M tokens'),
    priceRow('Web search', pricing.web_search, 'USD/request'),
  ].filter(Boolean).join('')
  const sourceAttribute = sourceProvider ? ` data-price-source-provider="${escapeHtml(sourceProvider)}"` : ''
  return `<div class="priceVariantCard"${sourceAttribute}><dl class="priceList">${rows}</dl></div>`
}

function priceRow(label: string, value: unknown, unit: string): string {
  if (value === null || value === undefined || value === '') return ''
  return `<div class="priceItem"><dt>${escapeHtml(label)}</dt><dd>${formatPrice(value, unit)}</dd></div>`
}

function formatPrice(value: unknown, unit: string): string {
  if (unit.endsWith('/1M tokens')) {
    const currency = unit.slice(0, -'/1M tokens'.length) || 'USD'
    return `${currencyPriceHtml(Number(value) * 1_000_000, currency)} <span class="muted">per 1M tokens</span>`
  }
  if (unit.endsWith('/direct_per_1M')) {
    const currency = unit.slice(0, -'/direct_per_1M'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per 1M tokens</span>`
  }
  if (unit.endsWith('/direct_per_1M_audio')) {
    const currency = unit.slice(0, -'/direct_per_1M_audio'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per 1M audio tokens</span>`
  }
  if (unit.endsWith('/query')) {
    const currency = unit.slice(0, -'/query'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per query</span>`
  }
  if (unit.endsWith('/image')) {
    const currency = unit.slice(0, -'/image'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per image</span>`
  }
  if (unit.endsWith('/second')) {
    const currency = unit.slice(0, -'/second'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per second</span>`
  }
  if (unit.endsWith('/audio_second')) {
    const currency = unit.slice(0, -'/audio_second'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per audio second</span>`
  }
  if (unit.endsWith('/video_second')) {
    const currency = unit.slice(0, -'/video_second'.length) || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per video second</span>`
  }
  if (unit.endsWith('/request') || unit.endsWith('/direct')) {
    const currency = unit.replace(/\/(request|direct)$/u, '') || 'USD'
    return `${currencyPriceHtml(Number(value), currency)} <span class="muted">per request</span>`
  }
  return `<code>${escapeHtml(String(value))}</code>${unit ? ` <span class="muted">${escapeHtml(unit)}</span>` : ''}`
}

function formatUsdPerMillionTokens(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return `$${escapeHtml(String(value))}`
  return currencyPriceHtml(numeric * 1_000_000, 'USD')
}

function currencyPriceHtml(value: number, currency = 'USD'): string {
  if (!Number.isFinite(value)) return '<code>—</code>'
  const symbol = currencySymbol(currency)
  return `<code class="priceValue"><span class="priceCurrencySymbol">${escapeHtml(symbol)}</span><span class="priceAmount">${formatPriceAmount(value)}</span></code>`
}

function currencySymbol(currency: string): string {
  if (currency === 'USD') return '$'
  if (currency === 'CNY') return '￥'
  return `${currency} `
}

function formatPriceAmount(value: number): string {
  return formatDisplayNumber(value)
}

function formatDisplayNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  if (Math.abs(value) >= 1) {
    const rounded = Math.round((value + Number.EPSILON) * 10_000) / 10_000
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 })
  }
  // Sub-unit prices (per-second/per-image can be tiny): keep 3 significant digits as a plain decimal.
  return Number(value.toPrecision(3)).toFixed(12).replace(/0+$/u, '').replace(/\.$/u, '')
}

function formatCompactNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '')
}

function sourcePricingBlocks(node: OpenRouterRawNode): string {
  const modelPricing = rawPricingValue(rawModelForDisplay(node), 'pricing')
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
  return `<section id="source" class="panel subtlePanel metadataPanel"><details><summary><h2>元数据</h2><span class="detailsChevron" aria-hidden="true">⌄</span></summary>${rawBlock(node.raw.model, 'metadata-json')}</details></section>`
}

function renderModelRow(node: OpenRouterRawNode, searchOnly = false, graph?: OpenRouterRawGraph): string {
  const modalities = `${node.derived.inputModalities.join(' · ') || '—'} → ${node.derived.outputModalities.join(' · ') || '—'}`
  const logoProvider = normalizedAuthorValue(node.derived.author) || node.provider
  const logoLabel = authorLabel(logoProvider)
  const outputModalities = normalizedOutputModalities(node)
  return `<tr data-model-row data-search-only="${searchOnly ? 'true' : 'false'}" data-model-status="${escapeHtml(node.status)}" data-delisted="${modelDeprecation(node) ? 'true' : 'false'}" data-model-provider="${escapeHtml(node.provider)}" data-model-author="${escapeHtml(normalizedAuthorValue(node.derived.author))}" data-output-modalities="${escapeHtml(outputModalities.join(' '))}" data-model-name="${escapeHtml(`${node.displayName} ${node.provider} ${node.modelId} ${node.sourceId} ${node.derived.author ?? ''}`.toLowerCase())}"><td><div class="modelName">${graph ? providerLogoIcon(graph, logoProvider, logoLabel, 'modelIcon') : renderLogoIcon(undefined, `${logoLabel} logo`, logoLabel.slice(0, 1), 'modelIcon')}<div><a class="modelLink" href="${escapeHtml(node.route)}/">${escapeHtml(node.displayName)}</a>${delistedBadge(node)}<div class="modelSub">${renderModelTagCopy(node.modelId)}</div><div class="modelSub rawSource">${escapeHtml(node.derived.author ?? '—')} · ${escapeHtml(modalities)}</div></div></div></td><td class="mono">${escapeHtml(modelContextLength(node))}</td><td class="mono priceCell">${modelPriceSummaryCell(node, graph)}</td><td class="mono">${escapeHtml(modelReleasedDate(node))}</td></tr>`
}

type PriceCellSummary = {
  html: string
  source: string
  condition: string
  tierCount: number
}

type PriceDisplayEntry = {
  label: string
  amount: unknown
  unit: string
  currency: string
}

function modelPriceSummaryCell(node: OpenRouterRawNode, graph?: OpenRouterRawGraph): string {
  const summary = preferredModelPriceSummary(node, graph)
  if (!summary) return hasNeedsReviewPricing(node) ? '<span class="muted">待核实</span>' : '—'
  const tier = summary.condition
    ? `<span class="tierIcon" title="阶梯价格：${summary.tierCount || 1} 档" aria-label="阶梯价格：${summary.tierCount || 1} 档">↕</span>`
    : ''
  return `<div class="priceSummary"${summary.source ? ` data-price-source-provider="${escapeHtml(summary.source)}"` : ''}>${summary.html}${tier}</div>`
}

function hasNeedsReviewPricing(node: OpenRouterRawNode): boolean {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const offers = Array.isArray(model.offers) ? model.offers : []
  return offers.some((offer) => isRecord(offer) && isRecord(offer.other_params) && offer.other_params.pricing_status === 'needs_review')
}

function preferredModelPriceSummary(node: OpenRouterRawNode, graph?: OpenRouterRawGraph): PriceCellSummary | null {
  const registrySummary = registryModelPriceSummary(node)
  if (registrySummary) return registrySummary
  const input = modelPriceCell(node, 'prompt', graph)
  const output = modelPriceCell(node, 'completion', graph)
  const parts = [
    input === '—' ? '' : `<span><span class="priceLabel">Input</span> ${input}</span>`,
    output === '—' ? '' : `<span><span class="priceLabel">Output</span> ${output}</span>`,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return { html: parts.join(' <span class="priceSeparator">/</span> '), source: '', condition: '', tierCount: 0 }
}

function registryModelPriceSummary(node: OpenRouterRawNode): PriceCellSummary | null {
  const prices = preferredRegistryListPrices(node)
  if (prices.length === 0) return null
  const primaryPrice = prices[0]!
  const source = typeof primaryPrice.source === 'string' ? primaryPrice.source : ''
  const currency = typeof primaryPrice.currency === 'string' ? primaryPrice.currency : ''
  const condition = priceTrueTierCondition(primaryPrice) || trueTierCondition(prices.filter((price) => (!source || price.source === source) && (!currency || price.currency === currency)))
  const selectedPrices = prices.filter((price) => {
    if (source && price.source !== source) return false
    if (currency && price.currency !== currency) return false
    if (!condition) return !priceTrueTierCondition(price)
    return priceTrueTierCondition(price) === condition
  })
  let entries = registryDisplayEntries(selectedPrices.length > 0 ? selectedPrices : [primaryPrice!])
  if (entries.length === 0 && condition) entries = registryAnyDisplayEntries([primaryPrice!])
  if (entries.length === 0) return null
  const html = entries.map((entry) => `<span class="priceLine"><span class="priceLabel">${escapeHtml(entry.label)}</span> ${formatPrice(entry.amount, registryPriceUnit(entry.unit, entry.currency))}</span>`).join('')
  return { html, source, condition, tierCount: condition ? matchingTierCount(node, source, currency, condition) : 0 }
}

// Compact list shows Input/Output for token models; for non-token models (image/audio/...)
// with no input/output, fall back to the primary non-token dimension.
const LIST_PRIMARY_KEYS = ['input', 'output'] as const
const LIST_FALLBACK_KEYS = ['image_output', 'image_input', 'audio_input', 'audio_output', 'video', 'request', 'web_search', 'character'] as const

function registryDisplayEntries(prices: Record<string, unknown>[]): PriceDisplayEntry[] {
  const primary = collectDisplayEntries(prices, LIST_PRIMARY_KEYS)
  if (primary.length > 0) return primary
  return collectDisplayEntries(prices, LIST_FALLBACK_KEYS).slice(0, 2)
}

function collectDisplayEntries(prices: Record<string, unknown>[], keys: readonly string[]): PriceDisplayEntry[] {
  const entries: PriceDisplayEntry[] = []
  const seen = new Set<string>()
  for (const price of prices) {
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    if (!unitPrices) continue
    for (const key of keys) {
      if (seen.has(key)) continue
      const value = unitPrices[key]
      if (!isRecord(value)) continue
      const amount = Number(value.amount)
      if (!Number.isFinite(amount) || amount === 0) continue
      seen.add(key)
      entries.push({ label: registryPriceDimensionLabel(key), amount: value.amount, unit: String(value.unit ?? ''), currency: String(price.currency ?? 'USD') })
    }
  }
  return entries
}

function registryAnyDisplayEntries(prices: Record<string, unknown>[]): PriceDisplayEntry[] {
  const entries: PriceDisplayEntry[] = []
  const seen = new Set<string>()
  for (const price of prices) {
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    if (!unitPrices) continue
    for (const [key, value] of Object.entries(unitPrices)) {
      if (!isRecord(value) || !Number.isFinite(Number(value.amount))) continue
      const label = registryPriceDimensionLabel(registryCanonicalDimensionKey(key))
      const unit = String(value.unit ?? '')
      const dedupeKey = `${label}\0${unit}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      entries.push({ label, amount: value.amount, unit, currency: String(price.currency ?? 'USD') })
    }
  }
  return entries
}

function registryCanonicalDimensionKey(key: string): string {
  if (/^input(?:_|$)|^prompt(?:_|$)|^input_cost/u.test(key)) return 'input'
  if (/^output(?:_|$)|^completion(?:_|$)|^output_cost/u.test(key)) return 'output'
  return key
}

function registryPriceDimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    input: 'Input',
    prompt: 'Input',
    output: 'Output',
    completion: 'Output',
    video: 'Video',
    cache_write: 'Cache write',
    input_cache_write: 'Cache write',
    cache_read: 'Cache read',
    input_cache_read: 'Cache read',
    image_input: 'Image in',
    image_output: 'Image',
    audio_input: 'Audio',
    audio_output: 'Audio out',
    reasoning: 'Reasoning',
    request: 'Request',
    web_search: 'Web search',
    character: 'Char',
  }
  return labels[key] ?? key
}

function isTrueTierPrice(price: Record<string, unknown>): boolean {
  return Boolean(priceTrueTierCondition(price))
}

function trueTierCondition(prices: Record<string, unknown>[]): string {
  for (const price of prices) {
    const condition = priceTrueTierCondition(price)
    if (condition) return condition
  }
  return ''
}

function priceTrueTierCondition(price: Record<string, unknown>): string {
  const conditions = isRecord(price.conditions) ? price.conditions : undefined
  const label = typeof conditions?.label === 'string' ? conditions.label.trim() : ''
  if (label && isSemanticTierCondition(label)) return label
  const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
  if (!unitPrices) return ''
  for (const [key, value] of Object.entries(unitPrices)) {
    const keyCondition = priceKeyTierCondition(key)
    if (keyCondition) return keyCondition
    if (!isRecord(value) || typeof value.condition !== 'string') continue
    const condition = value.condition.trim()
    if (condition && isSemanticTierCondition(condition)) return condition
  }
  return ''
}

function priceKeyTierCondition(key: string): string {
  const normalized = key.replace(/^input_cost_per_token_/u, '').replace(/^output_cost_per_token_/u, '').replace(/^input_cost_per_video_per_second_/u, '').replace(/^output_cost_per_second_/u, '')
  if (normalized !== key) {
    const condition = normalized.replace(/_/gu, ' ')
    if (isSemanticTierCondition(condition)) return condition
  }
  const resolution = key.match(/(?:^|[-_])(720p|1080p|4k)(?:[-_]|$)/iu)?.[1]
  if (resolution) {
    const parts = [resolution.toUpperCase()]
    if (/_no_audio|-no-audio/iu.test(key)) parts.push('无声')
    if (/_batch|-batch/iu.test(key)) parts.push('Batch')
    return parts.join(' ')
  }
  return ''
}

function isSemanticTierCondition(condition: string): boolean {
  const value = condition.toLowerCase()
  return /(?:<=|>=|<|>|\[|\]|\(|\))/u.test(value) || /(?:above|below|under|over|between|context|tokens|resolution|pixels|720p|1080p|4k|seconds?|minutes?|interval|输入长度)/u.test(value)
}

function firstRegistryListEntry(prices: Record<string, unknown>[], canonicalKey: 'input' | 'output'): { price: Record<string, unknown>; entry: Record<string, unknown> } | null {
  for (const price of prices) {
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    const entry = unitPrices ? registryListPriceEntry(unitPrices, canonicalKey) : null
    if (entry) return { price, entry }
  }
  return null
}

function registryListPriceEntry(unitPrices: Record<string, unknown>, canonicalKey: 'input' | 'output'): Record<string, unknown> | null {
  const exact = unitPrices[canonicalKey]
  if (isRecord(exact) && Number.isFinite(Number(exact.amount))) return exact
  const prefix = canonicalKey === 'input' ? /^input(?:_|$)|^prompt(?:_|$)|^input_cost/u : /^output(?:_|$)|^completion(?:_|$)|^output_cost/u
  for (const [key, value] of Object.entries(unitPrices)) {
    if (prefix.test(key) && isRecord(value) && Number.isFinite(Number(value.amount))) return value
  }
  return null
}

function firstPriceCondition(unitPrices: Record<string, unknown>): string {
  for (const value of Object.values(unitPrices)) {
    if (isRecord(value) && typeof value.condition === 'string' && value.condition.trim()) return value.condition.trim()
  }
  return ''
}

function registryPriceCondition(price: Record<string, unknown>): string {
  const conditions = isRecord(price.conditions) ? price.conditions : undefined
  return typeof conditions?.label === 'string' ? conditions.label : ''
}

function matchingTierCount(node: OpenRouterRawNode, source: string, currency: string, condition: string): number {
  if (!condition) return 0
  const prices = registryPriceRows(node)
  const sameGroup = prices.filter((price) => (source ? price.source === source : true) && (currency ? price.currency === currency : true))
  const seen = new Set<string>()
  for (const price of sameGroup) {
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    if (!unitPrices) continue
    const value = priceTrueTierCondition(price)
    if (value) seen.add(value)
  }
  return seen.size || 1
}

function preferredRegistryListPrices(node: OpenRouterRawNode): Record<string, unknown>[] {
  const prices = pricesWithListEntries(registryPriceRows(node))
  const rank = (price: Record<string, unknown>): number => {
    if (price.currency === 'CNY' && price.source === 'bailian_model_market') return 0
    if (price.currency === 'CNY' && price.source === 'volcengine_ark') return 1
    if (price.currency === 'CNY') return 2
    if (price.currency === 'USD' && price.source === 'openrouter') return 3
    return 4
  }
  return prices.slice().sort((a, b) => rank(a) - rank(b))
}

function pricesWithListEntries(prices: unknown[]): Record<string, unknown>[] {
  return prices.filter((price): price is Record<string, unknown> => {
    if (!isRecord(price)) return false
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    return Boolean(unitPrices && Object.values(unitPrices).some((value) => isRecord(value) && Number.isFinite(Number(value.amount))))
  })
}

function modelPriceCell(node: OpenRouterRawNode, key: string, graph?: OpenRouterRawGraph): string {
  const sourcePrice = sourceModelPriceCell(node, key)
  if (sourcePrice) return sourcePrice
  const endpoint = currentProviderEndpoints(node)[0] ?? sampleDeploymentPricingEndpoint(graph, node)
  if (!endpoint || !isRecord(endpoint.pricing)) return '—'
  const value = endpoint.pricing[key]
  if (value === null || value === undefined || value === '') return '—'
  const provider = endpointProviderSlug(endpoint)
  const sourceAttribute = provider ? ` data-price-source-provider="${escapeHtml(provider)}"` : ''
  return `<span${sourceAttribute}>${formatPrice(value, priceCellUnit(endpoint.pricing, key, 'USD'))}</span>`
}

function sourceModelPriceCell(node: OpenRouterRawNode, key: string): string {
  const model = isRecord(rawModelForDisplay(node)) ? rawModelForDisplay(node) as Record<string, unknown> : {}
  const pricing = isRecord(model.pricing) ? model.pricing : undefined
  if (pricing) {
    const value = pricing[key]
    if (value !== null && value !== undefined && value !== '') {
      const source = typeof pricing[`${key}_source`] === 'string' ? String(pricing[`${key}_source`]) : ''
      const sourceAttribute = source ? ` data-price-source-provider="${escapeHtml(source)}"` : ''
      const currency = typeof pricing[`${key}_currency`] === 'string' ? String(pricing[`${key}_currency`]) : 'USD'
      return `<span${sourceAttribute}>${formatPrice(value, priceCellUnit(pricing, key, currency))}</span>`
    }
  }
  return registryModelPriceCell(node, key)
}

function registryModelPriceCell(node: OpenRouterRawNode, key: string): string {
  const registryKey = key === 'prompt' ? 'input' : key === 'completion' ? 'output' : key === 'input_cache_read' ? 'cache_read' : key === 'input_cache_write' ? 'cache_write' : key
  const price = preferredRegistryTokenPrice(node, registryKey)
  const unitPrices = price && isRecord(price.unit_prices) ? price.unit_prices : price && isRecord(price.prices) ? price.prices : undefined
  const value = unitPrices && isRecord(unitPrices[registryKey]) ? unitPrices[registryKey] : undefined
  if (!value || value.amount === null || value.amount === undefined || value.amount === '') return ''
  const currency = String(price?.currency ?? 'USD')
  const source = typeof price?.source === 'string' ? price.source : ''
  const sourceAttribute = source ? ` data-price-source-provider="${escapeHtml(source)}"` : ''
  return `<span${sourceAttribute}>${formatPrice(value.amount, registryPriceUnit(String(value.unit ?? ''), currency))}</span>`
}

function preferredRegistryTokenPrice(node: OpenRouterRawNode, registryKey: string): Record<string, unknown> | undefined {
  const prices = registryPriceRows(node)
  const tokenPrices = prices.filter((price): price is Record<string, unknown> => {
    const unitPrices = isRecord(price.unit_prices) ? price.unit_prices : isRecord(price.prices) ? price.prices : undefined
    const value = unitPrices && isRecord(unitPrices[registryKey]) ? unitPrices[registryKey] : undefined
    return Boolean(value && isTokenPriceUnit(value.unit) && Number.isFinite(Number(value.amount)))
  })
  return tokenPrices.find((price) => price.currency === 'CNY' && price.source === 'bailian_model_market')
    ?? tokenPrices.find((price) => price.currency === 'CNY')
    ?? tokenPrices.find((price) => price.currency === 'USD' && price.source === 'openrouter')
    ?? tokenPrices[0]
}

function isTokenPriceUnit(unit: unknown): boolean {
  return unit === 'per_1m_tokens' || unit === 'per_million_tokens'
}

function priceCellUnit(pricing: Record<string, unknown>, key: string, currency: string): string {
  const unit = pricing[`${key}_unit`]
  if (unit === 'per_1m_tokens' || unit === 'per_million_tokens') return `${currency}/direct_per_1M`
  if (unit === 'per_1m_audio_tokens') return `${currency}/direct_per_1M_audio`
  return `${currency}/1M tokens`
}

function sampleDeploymentPricingEndpoint(graph: OpenRouterRawGraph | undefined, node: OpenRouterRawNode): Record<string, unknown> | undefined {
  if (!graph) return undefined
  const edges = graph.edges.filter((edge) => edge.to === node.id && edge.type === 'deployment_of')
  const author = normalizedAuthorValue(node.derived.author)
  const candidates = edges
    .map((edge) => graph.nodes.find((candidate) => candidate.id === edge.from))
    .filter((candidate): candidate is OpenRouterRawNode => candidate !== undefined)
    .flatMap((candidate) => currentProviderEndpoints(candidate))
    .filter((endpoint) => isRecord(endpoint.pricing))
    .sort((a, b) => {
      const aIsAuthor = endpointProviderSlug(a) === author ? 1 : 0
      const bIsAuthor = endpointProviderSlug(b) === author ? 1 : 0
      return bIsAuthor - aIsAuthor || compareEndpointPricingDesc(a, b)
    })
  return candidates[0]
}

function compareEndpointPricingDesc(a: Record<string, unknown>, b: Record<string, unknown>): number {
  return endpointPricingScore(b) - endpointPricingScore(a)
}

function endpointPricingScore(endpoint: Record<string, unknown>): number {
  const pricing = endpoint.pricing
  if (!isRecord(pricing)) return 0
  return ['prompt', 'completion', 'input_cache_read', 'input_cache_write'].reduce((sum, key) => {
    const value = Number(pricing[key])
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

function formatUsdPerMillionTokensWithRate(value: unknown): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return `$${escapeHtml(String(value))}`
  return currencyPriceHtml(numeric * 1_000_000, 'USD')
}

function page(title: string, body: string, activePage: ActivePage): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><style>${css}</style></head><body>${nav(activePage)}${body}<script>${copyModelTagScript()}</script><script>${copyCodeBlockScript()}</script>${footer()}</body></html>`
}

function nav(activePage: ActivePage): string {
  const search = '<label class="topSearch">⌕ <input id="q" type="search" placeholder="搜索模型 / author / source" autocomplete="off"></label>'
  return `<header class="topbar"><nav class="nav"><a class="brandmark" href="/">${databaseLogo()}<span>mddb.dev</span><span class="brandZh">大模型数据库</span></a>${search}<div class="navlinks"><a href="https://raw.githubusercontent.com/imphillip/mddb/main/data/models.json" target="_blank" rel="noopener noreferrer">models.json</a></div><a class="githubLink" href="https://github.com/imphillip/mddb" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">${githubLogo()}</a></nav></header>`
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
  const rows = Array.from(counts.values())
  return sortAuthorOptions(rows)
}


function sortAuthorOptions(rows: Array<{ label: string; value: string; count: number }>): Array<{ label: string; value: string; count: number }> {
  const featured = featuredAuthorValues()
  return rows.sort((a, b) => {
    const ai = featured.indexOf(a.value)
    const bi = featured.indexOf(b.value)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    return b.count - a.count || a.label.localeCompare(b.label)
  })
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
  return `<label class="filterOption"><input type="radio" name="${escapeHtml(group)}-filter" data-filter-group="${escapeHtml(group)}" data-filter-value="${escapeHtml(option.value)}"${checked ? ' checked' : ''}>${providerLogoIcon(graph, option.value, option.label, 'filterLogo')}<span>${escapeHtml(option.label)}</span><small>${option.count}</small></label>`
}

function providerLogoIcon(graph: OpenRouterRawGraph, providerId: string, label: string, className: string): string {
  return renderLogoIcon(providerLogoUrl(graph, providerId), `${label} logo`, label.slice(0, 1), className)
}

function providerLogoUrl(graph: OpenRouterRawGraph, providerId: string): string | undefined {
  if (providerId === 'all') return undefined
  const provider = graph.providers.find((candidate) => candidate.id === providerId)
  const icon = provider?.raw.icon
  if (typeof icon === 'string' && icon.trim() !== '') return icon
  return graph.enrichment?.modelsDev?.brandLogos?.[providerId]
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

function rawBlock(value: unknown, id?: string): string {
  const blockId = id ? ` id="${escapeHtml(id)}"` : ''
  const target = id ? ` data-copy-code-target="${escapeHtml(id)}"` : ''
  const label = id === 'metadata-json' ? 'metadata.json' : 'json'
  return `<div class="codeBlockShell rawBlockShell"><div class="codeBlockToolbar"><span>${escapeHtml(label)}</span><button class="copyCodeBtn" type="button"${target} aria-label="复制 ${escapeHtml(label)}" title="复制整段 JSON">复制</button></div><pre${blockId} class="raw codeBlock" tabindex="0"><code>${escapeHtml(JSON.stringify(value ?? null, null, 2))}</code></pre></div>`
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

function copyCodeBlockScript(): string {
  return String.raw`(function(){
const codeButtons=Array.from(document.querySelectorAll('[data-copy-code-target]'));
codeButtons.forEach(button=>button.addEventListener('click',async()=>{
  const targetId=button.dataset.copyCodeTarget||'';
  const target=document.getElementById(targetId);
  const text=target?target.innerText:'';
  try{await navigator.clipboard.writeText(text);button.classList.add('copied');button.textContent='已复制';setTimeout(()=>{button.textContent='复制';button.classList.remove('copied')},1200)}catch(error){button.textContent='复制失败'}
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
const quickFilterCounts=Object.fromEntries(outputButtons.map(button=>[button.dataset.outputFilter||'all',button.querySelector('.quickFilterCount')]).filter((entry)=>entry[1]));
const params=new URLSearchParams(window.location.search);
let outputFilter=params.get('output')||'all';
let providerFilter=(params.get('provider')||'all').toLowerCase();
function selected(group){const input=filterInputs.find(input=>input.dataset.filterGroup===group&&input.checked);return input?input.dataset.filterValue:'all'}
function setSelected(group,value){const input=filterInputs.find(input=>input.dataset.filterGroup===group&&input.dataset.filterValue===value);if(input)input.checked=true}
function updateUrl(){
  const next=new URLSearchParams(window.location.search);
  const query=(q&&q.value||'').trim();
  const author=selected('author');
  if(query)next.set('q',query);else next.delete('q');
  if(providerFilter&&providerFilter!=='all')next.set('provider',providerFilter);else next.delete('provider');
  if(author&&author!=='all')next.set('author',author);else next.delete('author');
  if(outputFilter&&outputFilter!=='all')next.set('output',outputFilter);else next.delete('output');
  const suffix=next.toString()?('?'+next.toString()):window.location.pathname;
  const url=next.toString()?window.location.pathname+'?'+next.toString():window.location.pathname;
  if(window.location.search!==suffix&&history.replaceState)history.replaceState(null,'',url);
}
function applyModelFilters(){
  const author=selected('author');
  const query=(q&&q.value||'').toLowerCase();
  const facetCounts={all:0};
  let count=0;
  function rowOutputModalities(row){return (row.dataset.outputModalities||'').split(/\s+/).filter(Boolean)}
  modelRows.forEach(row=>{
    const authorOk=author==='all'||author===(row.dataset.modelAuthor||'');
    const providerOk=providerFilter==='all'||providerFilter===(row.dataset.modelProvider||'').toLowerCase();
    const searchOnly=row.dataset.searchOnly==='true';
    const queryOk=!query||(row.dataset.modelName||row.innerText||'').toLowerCase().includes(query);
    const visibilityOk=!searchOnly||!!query||providerFilter!=='all';
    const baseVisible=authorOk&&providerOk&&queryOk&&visibilityOk;
    if(baseVisible){facetCounts.all+=1;for(const modality of rowOutputModalities(row)){facetCounts[modality]=(facetCounts[modality]||0)+1;}}
    const outputOk=outputFilter==='all'||rowOutputModalities(row).includes(outputFilter);
    const visible=baseVisible&&outputOk;
    row.hidden=!visible;
    if(visible) count+=1;
  });
  for(const facet of Object.keys(quickFilterCounts)){if(quickFilterCounts[facet])quickFilterCounts[facet].textContent=String(facetCounts[facet]||0);}
  if(visibleCount) visibleCount.textContent=String(count);
  updateUrl();
}
if(q&&params.get('q'))q.value=params.get('q')||'';
if(params.get('author'))setSelected('author',params.get('author'));
outputButtons.forEach(item=>item.classList.toggle('active',(item.dataset.outputFilter||'all')===outputFilter));
filterInputs.forEach(input=>input.addEventListener('change',applyModelFilters));
outputButtons.forEach(button=>button.addEventListener('click',()=>{outputFilter=button.dataset.outputFilter||'all';outputButtons.forEach(item=>item.classList.toggle('active',item===button));applyModelFilters();}));
if(q) q.addEventListener('input',applyModelFilters);
window.applyModelFilters=applyModelFilters;
window.modelPlazaProviderUrl=function(provider){return '/?provider='+encodeURIComponent(provider)};
applyModelFilters();
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
