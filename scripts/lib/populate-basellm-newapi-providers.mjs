import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE_URL = 'https://basellm.github.io/llm-metadata/api/newapi/models.json'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map((entry) => stableJsonValue(entry))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]))
  }
  return value
}

function sameJsonValue(left, right) {
  return JSON.stringify(stableJsonValue(left)) === JSON.stringify(stableJsonValue(right))
}

function writeJsonIfChanged(path, value) {
  if (existsSync(path) && sameJsonValue(readJson(path), value)) return false
  writeJson(path, value)
  return true
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[_\s.]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function title(value) {
  return String(value ?? '')
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function sortedProviderFiles(dataDir) {
  return existsSync(dataDir)
    ? readdirSync(dataDir).filter((name) => name.endsWith('.json') && name !== 'models.json').sort()
    : []
}

function readExistingProviders(dataDir) {
  const providers = new Map()
  for (const file of sortedProviderFiles(dataDir)) {
    const provider = readJson(join(dataDir, file))
    if (provider?.id) providers.set(String(provider.id), { file, provider })
  }
  return providers
}

function normalizeTail(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .split('/')
    .at(-1)
    .replace(/:free$/u, '')
}

function buildCanonicalIndex(modelsPath) {
  const payload = readJson(modelsPath)
  const models = Array.isArray(payload.models) ? payload.models : []
  const exact = new Map()
  const modelIdOnly = new Map()
  for (const model of models) {
    if (typeof model?.id !== 'string') continue
    const values = [model.id, ...(Array.isArray(model.alias) ? model.alias : [])]
    for (const value of values) exact.set(String(value).toLowerCase(), model)
    const tail = normalizeTail(model.id)
    if (tail) modelIdOnly.set(tail, modelIdOnly.has(tail) && modelIdOnly.get(tail)?.id !== model.id ? null : model)
    for (const value of values) {
      const candidateTail = normalizeTail(value)
      if (!candidateTail) continue
      if (!modelIdOnly.has(candidateTail)) modelIdOnly.set(candidateTail, model)
      else if (modelIdOnly.get(candidateTail)?.id !== model.id) modelIdOnly.set(candidateTail, null)
    }
  }
  return { exact, modelIdOnly }
}

function matchCanonicalModel(modelName, index) {
  const raw = String(modelName ?? '').trim()
  if (!raw || raw.toLowerCase().includes(':free')) return null
  const exact = index.exact.get(raw.toLowerCase())
  if (exact) return { model: exact, match: 'exact_source_id' }
  const tail = normalizeTail(raw)
  const modelId = index.modelIdOnly.get(tail)
  if (modelId) return { model: modelId, match: 'model_id_only' }
  return null
}

function isNonZeroNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function priceComponent(amount, unit = 'per_1m_tokens') {
  return { amount, unit }
}

function pricesFromBaseLlmRow(row) {
  const prices = {}
  if (isNonZeroNumber(row.price_per_m_input)) prices.input = priceComponent(row.price_per_m_input)
  if (isNonZeroNumber(row.price_per_m_output)) prices.output = priceComponent(row.price_per_m_output)
  if (isNonZeroNumber(row.price_per_m_cache_read)) prices.cache_read = priceComponent(row.price_per_m_cache_read)
  if (isNonZeroNumber(row.price_per_m_cache_write)) prices.cache_write = priceComponent(row.price_per_m_cache_write)
  return prices
}

function rawPricingFromBaseLlmRow(row) {
  return {
    price_per_m_input: row.price_per_m_input ?? null,
    price_per_m_output: row.price_per_m_output ?? null,
    price_per_m_cache_read: row.price_per_m_cache_read ?? null,
    price_per_m_cache_write: row.price_per_m_cache_write ?? null,
    ratio_model: row.ratio_model ?? null,
    ratio_completion: row.ratio_completion ?? null,
    ratio_cache: row.ratio_cache ?? null,
    base_rule: '500000 tokens = 1 USD; ratio=1 => $2 / 1M tokens',
  }
}

function sourceObservation(row, observedAt) {
  return {
    source: 'basellm-newapi',
    source_id: `${row.vendor_name}/${row.model_name}`,
    url: SOURCE_URL,
    observed_at: observedAt,
  }
}

function mergeSources(existing, additions) {
  return uniqueBy([
    ...(Array.isArray(existing) ? existing : []),
    ...(Array.isArray(additions) ? additions : []),
  ], (source) => `${source.source}|${source.source_id}`)
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  const output = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }
  return output
}

function hasMeaningfulNonBaseLlmPrice(offer) {
  return Array.isArray(offer?.prices) && offer.prices.some((entry) => {
    if (entry?.source === 'basellm-newapi') return false
    const prices = entry?.prices && typeof entry.prices === 'object' ? entry.prices : {}
    return Object.values(prices).some((component) => isNonZeroNumber(component?.amount))
  })
}

function hasMeaningfulPrices(prices) {
  return Object.values(prices).some((component) => isNonZeroNumber(component?.amount))
}

function baseLlmOffer(row, match, observedAt) {
  const prices = pricesFromBaseLlmRow(row)
  return {
    model_id: match.model.id,
    model: match.model.model ?? match.model.id,
    api_model_id: row.model_name,
    endpoint_path: row.model_name,
    mode: 'api',
    ...(hasMeaningfulPrices(prices) ? { prices: [{
      conditions: {},
      prices,
      currency: 'USD',
      source: 'basellm-newapi',
      observed_at: observedAt,
      raw_pricing: rawPricingFromBaseLlmRow(row),
    }] } : {}),
    other_parameters: {
      source: 'basellm-newapi',
      vendor_name: row.vendor_name,
      tags: typeof row.tags === 'string' ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
      match: match.match,
    },
    sources: [sourceObservation(row, observedAt)],
  }
}

function mergeBaseLlmOffer(existingOffers, row, match, observedAt) {
  const addition = baseLlmOffer(row, match, observedAt)
  const offers = Array.isArray(existingOffers) ? [...existingOffers] : []
  const equivalentIndex = offers.findIndex((offer) => offer.model_id === addition.model_id && offer.api_model_id === addition.api_model_id)
  if (equivalentIndex >= 0) {
    const existing = offers[equivalentIndex]
    offers[equivalentIndex] = {
      ...existing,
      sources: mergeSources(existing.sources, addition.sources),
      other_parameters: {
        ...(existing.other_parameters && typeof existing.other_parameters === 'object' && !Array.isArray(existing.other_parameters) ? existing.other_parameters : {}),
        basellm_newapi: addition.other_parameters,
      },
      ...(hasMeaningfulNonBaseLlmPrice(existing) ? {} : { prices: uniqueBy([...(Array.isArray(existing.prices) ? existing.prices : []), ...(addition.prices ?? [])], (entry) => `${entry.source}|${JSON.stringify(stableJsonValue(entry.conditions ?? {}))}`) }),
    }
    return offers
  }
  offers.push(addition)
  return offers
}

function providerRecord(id, providerName, observedAt) {
  return {
    schema_version: 1,
    id,
    provider: providerName || title(id),
    currency: 'USD',
    offers: [],
    sources: [],
    last_updated: observedAt,
  }
}

function loadRows(source) {
  const rows = Array.isArray(source?.models) ? source.models : Array.isArray(source?.data) ? source.data : Array.isArray(source) ? source : []
  return rows.filter((row) => row && typeof row === 'object' && typeof row.model_name === 'string' && typeof row.vendor_name === 'string')
}

export function populateBaseLlmNewapiProviders({ dataDir = join(process.cwd(), 'data', 'providers'), modelsPath = join(process.cwd(), 'data', 'models.json'), source, observedAt = new Date().toISOString() } = {}) {
  if (!source || typeof source !== 'object') throw new Error('BaseLLM NewAPI source must be an object or row array')
  const existingProviders = readExistingProviders(dataDir)
  const canonicalIndex = buildCanonicalIndex(modelsPath)
  const stats = { enriched: 0, created: 0, skipped: 0, matched: 0, freeFiltered: 0, unpriced: 0 }
  const touched = new Set()

  for (const row of loadRows(source)) {
    if (row.model_name.toLowerCase().includes(':free')) {
      stats.freeFiltered += 1
      continue
    }
    const match = matchCanonicalModel(row.model_name, canonicalIndex)
    if (!match) {
      stats.skipped += 1
      continue
    }
    const prices = pricesFromBaseLlmRow(row)
    if (!hasMeaningfulPrices(prices)) {
      stats.unpriced += 1
      continue
    }
    const providerId = slugify(row.vendor_name)
    if (!providerId) {
      stats.skipped += 1
      continue
    }
    const entry = existingProviders.get(providerId)
    const existing = entry?.provider ?? providerRecord(providerId, row.vendor_name, observedAt)
    const output = {
      ...existing,
      schema_version: existing.schema_version ?? 1,
      id: existing.id ?? providerId,
      provider: existing.provider ?? row.vendor_name,
      currency: existing.currency ?? 'USD',
      offers: mergeBaseLlmOffer(existing.offers, row, match, observedAt),
      sources: mergeSources(existing.sources, [{ source: 'basellm-newapi', source_id: row.vendor_name, url: SOURCE_URL, observed_at: observedAt }]),
      other_parameters: {
        ...(existing.other_parameters && typeof existing.other_parameters === 'object' && !Array.isArray(existing.other_parameters) ? existing.other_parameters : {}),
        basellm_newapi: {
          vendor_name: row.vendor_name,
        },
      },
    }
    const file = entry?.file ?? `${providerId}.json`
    writeJsonIfChanged(join(dataDir, file), output)
    stats.matched += 1
    if (!touched.has(providerId)) {
      if (entry) stats.enriched += 1
      else stats.created += 1
      touched.add(providerId)
    }
  }

  return stats
}

export function loadBaseLlmNewapiSource(path = join(process.cwd(), '.internal', 'source-data', 'basellm-newapi.raw.json')) {
  return readJson(path)
}
