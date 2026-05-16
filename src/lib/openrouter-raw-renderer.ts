import type { OpenRouterRawEdge, OpenRouterRawGraph, OpenRouterRawNode } from './openrouter-raw-graph.js'

const css = String.raw`
:root{--bg:#fff;--fg:#171717;--muted:#666;--line:#e5e7eb;--soft:#f8fafc;--blue:#2563eb;--green:#047857;--red:#b91c1c}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}a{color:inherit}.top{position:sticky;top:0;background:rgba(255,255,255,.94);border-bottom:1px solid var(--line);z-index:10}.nav{max-width:1440px;margin:0 auto;padding:14px 20px;display:flex;gap:18px;align-items:center}.brand{font-weight:700;text-decoration:none}.nav a{font-size:14px}.wrap{max-width:1440px;margin:0 auto;padding:22px 20px}.hero{display:grid;gap:12px;margin-bottom:20px}.hero h1{font-size:34px;margin:0}.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.card,.panel{border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px}.card span{display:block;color:var(--muted);font-size:12px}.card b{font-size:22px}.layout{display:grid;grid-template-columns:320px 1fr;gap:16px}.side{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 80px);overflow:auto}.list{display:grid;gap:8px}.item{display:block;border:1px solid var(--line);border-radius:10px;padding:10px;text-decoration:none;background:#fff}.item:hover{border-color:#93c5fd}.item small{display:block;color:var(--muted);word-break:break-all}.badge{display:inline-block;border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:2px 8px;font-size:12px;margin:2px}.badge.api{color:var(--green)}.badge.page_only{color:var(--red)}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid var(--line);padding:9px;text-align:left;vertical-align:top}.table th{font-size:12px;color:var(--muted);background:var(--soft)}.mono,code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}.raw{white-space:pre-wrap;overflow:auto;max-height:680px;background:#0b1020;color:#d8e4ff;border-radius:12px;padding:14px;font-size:12px;line-height:1.45}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.tabs a{border:1px solid var(--line);border-radius:999px;padding:6px 10px;text-decoration:none;background:#fff}.section{margin:18px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.kv{display:grid;grid-template-columns:180px 1fr;border-bottom:1px solid var(--line);padding:8px 0}.kv span{color:var(--muted)}.edge{border-left:3px solid #bfdbfe;padding:8px 10px;background:#f8fafc;margin:6px 0;border-radius:8px}.search{width:100%;padding:10px;border:1px solid var(--line);border-radius:10px;margin-bottom:10px}@media(max-width:900px){.layout,.two,.grid{grid-template-columns:1fr}.side{position:static;max-height:none}}
`

export function renderOpenRouterRawHome(graph: OpenRouterRawGraph): string {
  const rows = graph.nodes.map((node) => `<tr><td><a href="${escapeHtml(node.route)}/"><strong>${escapeHtml(node.displayName)}</strong></a><br><code>${escapeHtml(node.provider)}/${escapeHtml(node.modelId)}</code><br><small>source: ${escapeHtml(node.sourceId)}</small></td><td><span class="badge ${node.status}">${escapeHtml(node.status)}</span>${node.derived.pageOnlyType ? `<span class="badge">${escapeHtml(node.derived.pageOnlyType)}</span>` : ''}</td><td>${escapeHtml(node.providerName)}<br><small>${escapeHtml(node.provider)}</small></td><td>${escapeHtml(node.derived.author ?? '—')}</td><td>${escapeHtml(node.derived.inputModalities.join(', ') || '—')} → ${escapeHtml(node.derived.outputModalities.join(', ') || '—')}</td><td>${node.derived.endpointCount}</td><td>${escapeHtml(node.derived.endpointContextLengths.map(String).join(', ') || '—')}</td></tr>`).join('')
  return page('provider model graph · mddb.dev', `<main class="wrap"><section class="hero"><h1>OpenRouter Raw Provider Graph</h1><p class="muted">按 <code>/models/&lt;provider&gt;/&lt;model-id&gt;</code> 保存；<code>provider</code> 是实际部署/服务提供方，不是 data source。OpenRouter 只作为来源保存在 <code>dataSource</code> 与 raw JSON 中；类似 <code>openai/sora-2-pro</code> 会拆成 <code>provider=openai</code>、<code>model-id=sora-2-pro</code>，author 作为模型属性保留。</p><div class="grid">${stat('API models', graph.stats.apiModels)}${stat('Sitemap pages', graph.stats.sitemapModelPages)}${stat('Page-only', graph.stats.pageOnlyModels)}${stat('Endpoint rows', graph.stats.endpointRows)}${stat('Nodes', graph.stats.nodes)}${stat('Edges', graph.stats.edges)}</div></section><section class="panel"><input class="search" id="q" placeholder="过滤 model id / display name / author"><table class="table"><thead><tr><th>模型</th><th>状态</th><th>Provider</th><th>Author</th><th>Modalities</th><th>Endpoints</th><th>Context lengths</th></tr></thead><tbody id="rows">${rows}</tbody></table></section><script>${filterScript()}</script></main>`)
}

export function renderOpenRouterRawDetail(graph: OpenRouterRawGraph, node: OpenRouterRawNode): string {
  const outEdges = graph.edges.filter((edge) => edge.from === node.id)
  const inEdges = graph.edges.filter((edge) => edge.to === node.id && edge.from !== node.id)
  const endpointRows = endpointList(node).map((endpoint, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(String(endpoint.provider_name ?? '—'))}<br><small>${escapeHtml(String(endpoint.tag ?? ''))}</small></td><td>${escapeHtml(String(endpoint.context_length ?? '—'))}</td><td><code>${escapeHtml(JSON.stringify(endpoint.pricing ?? {}, null, 2))}</code></td><td>${escapeHtml(arrayValue(endpoint.supported_parameters).join(', ') || '—')}</td></tr>`).join('')
  const body = `<main class="wrap"><p><a href="/models/">← provider model graph</a></p><section class="hero"><h1>${escapeHtml(node.displayName)}</h1><p><code>${escapeHtml(node.route)}</code></p><p><span class="badge ${node.status}">${escapeHtml(node.status)}</span>${node.derived.pageOnlyType ? `<span class="badge">${escapeHtml(node.derived.pageOnlyType)}</span>` : ''}<span class="badge">provider: ${escapeHtml(node.provider)}</span><span class="badge">model-id: ${escapeHtml(node.modelId)}</span><span class="badge">source: ${escapeHtml(node.dataSource)}</span></p></section><section class="grid">${stat('Endpoints', node.derived.endpointCount)}${stat('Contexts', node.derived.endpointContextLengths.length)}${stat('Providers', node.derived.endpointProviders.length)}${stat('Pricing keys', node.derived.pricingKeys.length)}${stat('Out edges', outEdges.length)}${stat('In edges', inEdges.length)}</section><nav class="tabs"><a href="#summary">Summary</a><a href="#graph">Graph</a><a href="#endpoints">Endpoints</a><a href="#raw-model">Raw model</a><a href="#raw-page">Raw page</a><a href="#raw-all">Raw all</a></nav><section id="summary" class="panel section"><h2>派生索引（仅用于调阅）</h2>${kv('Provider', `${escapeHtml(node.providerName)} <code>${escapeHtml(node.provider)}</code>`)}${kv('Provider model-id', `<code>${escapeHtml(node.modelId)}</code>`)}${kv('Data source', node.dataSource)}${kv('Source ID', node.sourceId)}${kv('Source URL', `<a href="${escapeHtml(node.sourceUrl)}">${escapeHtml(node.sourceUrl)}</a>`)}${kv('Author', node.derived.author ?? '—')}${kv('Canonical slug', node.derived.canonicalSlug ?? '—')}${kv('Input modalities', node.derived.inputModalities.join(', ') || '—')}${kv('Output modalities', node.derived.outputModalities.join(', ') || '—')}${kv('Endpoint providers', node.derived.endpointProviders.join(', ') || '—')}${kv('Endpoint context lengths', node.derived.endpointContextLengths.map(String).join(', ') || '—')}${kv('Pricing keys', node.derived.pricingKeys.join(', ') || '—')}</section><section id="graph" class="panel section"><h2>有向图边</h2><div class="two"><div><h3>Outgoing</h3>${renderEdges(outEdges)}</div><div><h3>Incoming</h3>${renderEdges(inEdges)}</div></div></section><section id="endpoints" class="panel section"><h2>Endpoint observations</h2><table class="table"><thead><tr><th>#</th><th>Provider/tag</th><th>Context</th><th>Raw pricing</th><th>Supported parameters</th></tr></thead><tbody>${endpointRows || '<tr><td colspan="5" class="muted">无 endpoint rows</td></tr>'}</tbody></table></section><section id="raw-model" class="panel section"><h2>Raw /api/v1/models row</h2>${rawBlock(node.raw.model)}</section><section id="raw-page" class="panel section"><h2>Raw model page extraction</h2>${rawBlock(node.raw.page)}</section><section id="raw-all" class="panel section"><h2>Raw node</h2>${rawBlock(node)}</section></main>`
  return page(`${node.displayName} · provider graph · mddb.dev`, body)
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${css}</style></head><body><header class="top"><nav class="nav"><a class="brand" href="/models/">mddb.dev</a><a href="/models/">Provider Model Graph</a><a href="/graph/openrouter.json">graph JSON</a></nav></header>${body}</body></html>`
}

function stat(label: string, value: string | number): string {
  return `<div class="card"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b></div>`
}

function kv(label: string, value: string): string {
  return `<div class="kv"><span>${escapeHtml(label)}</span><b>${value}</b></div>`
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

function arrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char)
}

function filterScript(): string {
  return `const q=document.getElementById('q');const rows=[...document.querySelectorAll('#rows tr')];q.addEventListener('input',()=>{const v=q.value.toLowerCase();for(const r of rows)r.style.display=r.innerText.toLowerCase().includes(v)?'':'none'});`
}
