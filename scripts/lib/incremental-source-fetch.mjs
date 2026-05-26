import { createHash } from 'node:crypto'

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function fingerprint(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex')
}

export function slugFromCatalogRow(row) {
  return String(row?.slug || row?.model || row?.model_code || row?.model_id || row?.name || '')
    .replace(/-\d{4}-\d{2}-\d{2}$/u, '')
    .trim()
    .toLowerCase()
}

export function bailianCatalogIdentity(row) {
  return row?.model_id || row?.model_code || row?.model || row?.slug || row?.name || ''
}

export function bailianCatalogFingerprint(row) {
  return fingerprint({
    model_id: row?.model_id || row?.modelId || row?.model || null,
    slug: slugFromCatalogRow(row),
    name: row?.name || null,
    description: row?.description || row?.shortDescription || null,
    features: row?.features || [],
    capabilities: row?.capabilities || row?.typeIds || [],
    latest_online_at: row?.latest_online_at || row?.latestOnlineAt || row?.onlineTime || null,
    version_tag: row?.version_tag || row?.versionTag || null,
    collection_tag: row?.collection_tag || row?.collectionTag || null,
  })
}

export function buildBailianCatalog(rows, observedAt = new Date().toISOString()) {
  const seen = new Set()
  const models = []
  const fingerprints = {}
  for (const row of rows || []) {
    const identity = String(bailianCatalogIdentity(row)).trim()
    const slug = slugFromCatalogRow(row)
    if (!identity || !slug) continue
    const key = identity.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const entry = {
      name: row.name || null,
      model_id: row.model_id || row.modelId || row.model || identity,
      slug,
      description: row.description || row.shortDescription || null,
      features: row.features || [],
      capabilities: row.capabilities || row.typeIds || [],
      latest_online_at: row.latest_online_at || row.latestOnlineAt || row.onlineTime || null,
      version_tag: row.version_tag || row.versionTag || null,
      collection_tag: row.collection_tag || row.collectionTag || null,
    }
    models.push(entry)
    fingerprints[entry.model_id] = bailianCatalogFingerprint(entry)
  }
  return { observed_at: observedAt, count: models.length, models, fingerprints }
}

export function selectChangedBailianSlugs(catalog, previousPayload, { force = false, limit = Infinity } = {}) {
  const previousFingerprints = previousPayload?.list_observation?.fingerprints || previousPayload?.catalog_fingerprints || {}
  const previousModels = new Map((previousPayload?.models || []).map((row) => [String(row.model_id || row.model_code || '').toLowerCase(), row]))
  const changed = []
  for (const row of catalog?.models || []) {
    const id = String(row.model_id || '').toLowerCase()
    const previousFingerprint = previousFingerprints[row.model_id]
    const currentFingerprint = catalog.fingerprints?.[row.model_id] || bailianCatalogFingerprint(row)
    if (force || !previousModels.has(id) || previousFingerprint !== currentFingerprint) {
      changed.push(row.slug || slugFromCatalogRow(row))
    }
    if (changed.length >= limit) break
  }
  return changed.filter(Boolean)
}

export function mergeBailianPayload(previousPayload, { catalog, details, fetchedAt, region, serviceSite }) {
  const previousById = new Map((previousPayload?.models || []).map((row) => [String(row.model_id || row.model_code || '').toLowerCase(), row]))
  for (const detail of details || []) {
    const id = String(detail.model_id || detail.model_code || '').toLowerCase()
    if (id) previousById.set(id, detail)
  }
  const observedIds = new Set((catalog?.models || []).map((row) => String(row.model_id || '').toLowerCase()))
  const models = [...previousById.values()].map((row) => ({ ...row, list_observed: observedIds.has(String(row.model_id || row.model_code || '').toLowerCase()) }))
  return {
    source: 'bailian_model_market',
    fetched_at: fetchedAt,
    region,
    service_site: serviceSite,
    crawl_note: 'Incremental catalog-first crawl. Detail pages are fetched only for new or changed catalog rows; unchanged detail records are preserved.',
    list_observation: catalog,
    count: models.length,
    models,
  }
}

export function bailianApiEnvelopeData(json, api = 'Bailian API') {
  if (json?.code && json.code !== '200') throw new Error(`${api} returned ${json.code}: ${json.message || ''}`.trim())
  const dataV2 = json?.data?.DataV2
  if (!dataV2) throw new Error(`${api} response missing data.DataV2`)
  const inner = dataV2.data
  if (inner?.code && inner.code !== '200') throw new Error(`${api} returned ${inner.code}: ${inner.message || inner.codeEnum || ''}`.trim())
  return inner?.data ?? inner
}

export function normalizeBailianModelDetail(item, { model, serviceSite } = {}) {
  if (!item || typeof item !== 'object') throw new Error(`Bailian API returned no model item for ${model || 'unknown model'}`)
  const flatPricing = Array.isArray(item.prices) ? item.prices.map(normalizeBailianPrice) : []
  const tieredPricing = Array.isArray(item.multiPrices) ? item.multiPrices.map(normalizeBailianTier) : []
  const toolPricing = Array.isArray(item.builtInToolMultiPrices) ? item.builtInToolMultiPrices.map((tool) => ({
    type: tool.type || null,
    name: tool.name || null,
    supported_api: tool.supportedApi || null,
    doc_url: tool.docUrl || null,
    prices: Array.isArray(tool.prices) ? tool.prices.map(normalizeBailianPrice) : [],
    raw: tool,
  })) : []
  return {
    model_code: item.model || model,
    model_id: item.modelId || item.model || model,
    name: item.name || null,
    provider: item.provider || item.providerId || null,
    description: item.description || item.shortDescription || null,
    equivalent_snapshot: item.equivalentSnapshot || null,
    open_source: Boolean(item.openSource),
    collection_tag: item.collectionTag || null,
    version_tag: item.versionTag || null,
    capabilities: item.capabilities || item.typeIds || [],
    features: item.features || [],
    pricing: flatPricing.length ? flatPricing : null,
    pricing_currency: 'CNY',
    tiered_pricing: tieredPricing.length ? tieredPricing : null,
    tool_pricing: toolPricing,
    limits: {
      context_window: asNumber(item.contextWindow ?? item.modelInfo?.contextWindow),
      max_input_tokens: asNumber(item.maxInputTokens ?? item.modelInfo?.maxInputTokens),
      max_output_tokens: asNumber(item.maxOutputTokens ?? item.modelInfo?.maxOutputTokens),
      max_reasoning_tokens: asNumber(item.modelInfo?.maxReasoningTokens),
      reasoning_max_input_tokens: asNumber(item.maxInputTokensThinking ?? item.modelInfo?.reasoningMaxInputTokens),
      reasoning_max_output_tokens: asNumber(item.maxOutputTokensThinking ?? item.modelInfo?.reasoningMaxOutputTokens),
    },
    qpm_info: item.qpmInfo || null,
    api_base_url: parseBailianBaseUrl(item) || null,
    doc_url: item.docUrl || null,
    service_sites: item.serviceSites || (serviceSite ? [serviceSite] : []),
    latest_online_at: item.latestOnlineAt || item.onlineTime || null,
    list_observed: true,
    raw: item,
  }
}

function normalizeBailianPrice(price) {
  return {
    type: price.type || null,
    label: price.priceName || null,
    price: asNumber(price.price),
    currency: price.currency || 'CNY',
    unit: price.priceUnit || null,
    discount: asNumber(price.discount),
    raw: price,
  }
}

function normalizeBailianTier(tier) {
  return {
    range_name: tier.rangeName || null,
    range_start_tokens: asNumber(tier.rangeStart),
    range_end_tokens: asNumber(tier.rangeEnd),
    prices: Array.isArray(tier.prices) ? tier.prices.map(normalizeBailianPrice) : [],
    raw: tier,
  }
}

function parseBailianBaseUrl(item) {
  const code = item?.sampleCodeV2?.openai?.completionsAPI?.python?.code
    || item?.sampleCodeV2?.openai?.completionsAPI?.curl?.code
    || item?.sampleCode?.openai?.python
    || item?.sampleCode?.openai?.curl
    || ''
  return String(code).match(/base_?url\s*=\s*["']([^"']+)/iu)?.[1]
    || String(code).match(/https:\/\/[^\s"']+/u)?.[0]
    || ''
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function extractVolcengineDocFromHtml(html, fallback = {}) {
  const data = extractWindowJson(html, '_ROUTER_DATA') || extractWindowJson(html, '_SSR_DATA')
  if (!data) throw new Error('Could not find Volcengine document JSON state in HTML')
  const doc = findCurDoc(data)
  if (!doc?.Content) throw new Error('Could not find curDoc.Content in Volcengine SSR data')
  const content = JSON.parse(doc.Content)
  return {
    url: fallback.url,
    library_id: Number(doc.LibraryID || fallback.library_id),
    document_id: Number(doc.BusinessID || fallback.document_id),
    title: doc.Title || fallback.title,
    content_type: 'json',
    updated_time: normalizeVolcengineTime(doc.UpdateTime || doc.UpdatedTime || fallback.updated_time),
    md_content: volcengineContentToMarkdown(content),
  }
}

function extractWindowJson(html, name) {
  const source = String(html || '')
  const marker = `window.${name} = `
  const start = source.indexOf(marker)
  if (start < 0) return null
  const jsonStart = source.indexOf('{', start + marker.length)
  if (jsonStart < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = jsonStart; i < source.length; i += 1) {
    const char = source[i]
    if (inString) {
      if (escape) escape = false
      else if (char === '\\') escape = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return JSON.parse(source.slice(jsonStart, i + 1))
    }
  }
  return null
}

function findCurDoc(value) {
  if (!value || typeof value !== 'object') return null
  if (value.curDoc?.Content) return value.curDoc
  for (const child of Object.values(value)) {
    const found = findCurDoc(child)
    if (found) return found
  }
  return null
}

export function normalizeVolcengineTime(value) {
  if (!value) return undefined
  if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000).toISOString()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : String(value)
}

export function volcengineContentToMarkdown(content) {
  const zones = content?.data && typeof content.data === 'object' ? content.data : {}
  const chunks = []
  for (const zone of Object.values(zones)) {
    for (const op of zone?.ops || []) {
      const text = op?.insert
      if (typeof text !== 'string' || text === '*') continue
      const attrs = op.attributes || {}
      if (attrs.heading) chunks.push(`${'#'.repeat(Number(String(attrs.heading).replace('h', '')) || 1)} ${text.trim()}\n`)
      else chunks.push(text)
    }
    if (!chunks.at(-1)?.endsWith('\n')) chunks.push('\n')
  }
  return chunks.join('').replace(/\n{3,}/gu, '\n\n').trim() + '\n'
}
