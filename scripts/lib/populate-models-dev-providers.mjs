import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE_URL = 'https://models.dev/api.json'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function domainFromUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  const result = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
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

function normalizeModelKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .split('/')
    .at(-1)
    .replace(/:free$/u, '')
    .replace(/[-_\s]+/gu, '-')
    .replace(/[^a-z0-9.-]+/gu, '-')
    .replace(/(?<=\d)-(?=\d)/gu, '.')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
}

function isUnsafeApiModelId(value) {
  const normalized = normalizeModelKey(value)
  return (
    normalized === '' ||
    /(^|[-.])(latest|auto|frontier|route|router)([-.]|$)/u.test(normalized) ||
    /embedding|embed|rerank|reranker|whisper|tts|image|vision|ocr/u.test(normalized)
  )
}

function buildCanonicalIndex(modelsPath) {
  const payload = readJson(modelsPath)
  const models = Array.isArray(payload.models) ? payload.models : []
  const exact = new Map()
  const normalized = new Map()
  for (const model of models) {
    if (typeof model?.id !== 'string') continue
    const values = [model.id, ...(Array.isArray(model.alias) ? model.alias : [])]
    for (const value of values) exact.set(String(value).toLowerCase(), model)
    for (const value of values) {
      const key = normalizeModelKey(value)
      if (!key) continue
      if (!normalized.has(key)) normalized.set(key, model)
      else if (normalized.get(key)?.id !== model.id) normalized.set(key, null)
    }
  }
  return { exact, normalized }
}

function matchCanonicalModel(providerId, modelId, modelRecord, index) {
  const candidates = [modelId, `${providerId}/${modelId}`, modelRecord?.id, modelRecord?.id ? `${providerId}/${modelRecord.id}` : undefined].filter(Boolean)
  for (const candidate of candidates) {
    const hit = index.exact.get(String(candidate).toLowerCase())
    if (hit) return { model: hit, match: 'exact' }
  }
  if (isUnsafeApiModelId(modelId) || isUnsafeApiModelId(modelRecord?.id)) return null
  for (const candidate of candidates) {
    const hit = index.normalized.get(normalizeModelKey(candidate))
    if (hit) return { model: hit, match: 'normalized' }
  }
  return null
}

function modelsDevOffer(provider, modelId, modelRecord, match) {
  const cost = modelRecord && typeof modelRecord.cost === 'object' && !Array.isArray(modelRecord.cost) ? modelRecord.cost : undefined
  const prices = cost ? {
    ...(typeof cost.input === 'number' ? { input: { amount: cost.input, unit: 'per_1m_tokens' } } : {}),
    ...(typeof cost.output === 'number' ? { output: { amount: cost.output, unit: 'per_1m_tokens' } } : {}),
    ...(typeof cost.cache_read === 'number' ? { cache_read: { amount: cost.cache_read, unit: 'per_1m_tokens' } } : {}),
    ...(typeof cost.cache_write === 'number' ? { cache_write: { amount: cost.cache_write, unit: 'per_1m_tokens' } } : {}),
  } : undefined
  return {
    model_id: match.model.id,
    model: match.model.model ?? modelRecord?.name ?? match.model.id,
    api_model_id: modelId,
    endpoint_path: modelId,
    mode: 'api',
    ...(prices && Object.keys(prices).length > 0 ? { prices: [{
      conditions: {},
      prices,
      currency: 'USD',
      source: 'models.dev',
    }] } : {}),
    other_parameters: {
      source: 'models.dev',
      match: match.match,
    },
    sources: [{
      source: 'models.dev',
      source_id: `${provider.id}/${modelId}`,
      url: SOURCE_URL,
    }],
  }
}

function mergeOffers(existingOffers, provider, canonicalIndex) {
  const additions = []
  for (const [modelId, modelRecord] of Object.entries(provider.models ?? {})) {
    const match = matchCanonicalModel(provider.id, modelId, modelRecord, canonicalIndex)
    if (!match) continue
    additions.push(modelsDevOffer(provider, modelId, modelRecord, match))
  }
  return uniqueBy([
    ...(Array.isArray(existingOffers) ? existingOffers : []),
    ...additions,
  ], (offer) => `${offer.model_id}|${offer.api_model_id}|${offer.endpoint_path}`)
}

function providerRecordFromModelsDev(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return value
}

function hasModels(value) {
  return value?.models && typeof value.models === 'object' && !Array.isArray(value.models) && Object.keys(value.models).length > 0
}

function sourceObservation(provider, observedAt) {
  return {
    source: 'models.dev',
    source_id: provider.id,
    url: SOURCE_URL,
    observed_at: observedAt,
  }
}

function mergeSources(existing, provider, observedAt) {
  return uniqueBy([
    ...(Array.isArray(existing) ? existing : []),
    sourceObservation(provider, observedAt),
  ], (source) => `${source.source}|${source.source_id}`)
}

function modelsDevParameters(provider) {
  const params = { model_count: Object.keys(provider.models ?? {}).length }
  if (typeof provider.doc === 'string') params.doc = provider.doc
  if (typeof provider.npm === 'string') params.npm = provider.npm
  if (Array.isArray(provider.env) && provider.env.every((item) => typeof item === 'string')) params.env = provider.env
  return params
}

function modelsDevIconUrl(provider) {
  if (typeof provider.iconURL === 'string' && provider.iconURL.trim() !== '') return provider.iconURL
  return `https://models.dev/logos/${provider.id}.svg`
}

function enrichProvider(existing, provider, observedAt, canonicalIndex) {
  return {
    schema_version: existing.schema_version ?? 1,
    id: existing.id ?? provider.id,
    provider: existing.provider ?? provider.name,
    currency: existing.currency ?? 'USD',
    icon_url: modelsDevIconUrl(provider),
    ...(typeof provider.api === 'string' ? { base_url: existing.base_url ?? provider.api } : {}),
    ...(domainFromUrl(provider.doc) ? { domain: existing.domain ?? domainFromUrl(provider.doc) } : {}),
    other_parameters: {
      ...(existing.other_parameters && typeof existing.other_parameters === 'object' && !Array.isArray(existing.other_parameters) ? existing.other_parameters : {}),
      models_dev: modelsDevParameters(provider),
    },
    last_updated: existing.last_updated ?? observedAt,
    offers: mergeOffers(existing.offers, provider, canonicalIndex),
    sources: mergeSources(existing.sources, provider, observedAt),
  }
}

function createProvider(provider, observedAt, canonicalIndex) {
  return enrichProvider({
    schema_version: 1,
    id: provider.id,
    provider: provider.name,
    currency: 'USD',
    other_parameters: {},
    last_updated: observedAt,
    offers: [],
    sources: [],
  }, provider, observedAt, canonicalIndex)
}

export function populateModelsDevProviders({ dataDir = join(process.cwd(), 'data', 'providers'), modelsPath = join(process.cwd(), 'data', 'models.json'), source, observedAt = new Date().toISOString() } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('models.dev provider source must be an object')
  const existingProviders = readExistingProviders(dataDir)
  const canonicalIndex = buildCanonicalIndex(modelsPath)
  let enriched = 0
  let created = 0
  let skipped = 0

  for (const raw of Object.values(source)) {
    const provider = providerRecordFromModelsDev(raw)
    if (!provider || !hasModels(provider)) {
      skipped += 1
      continue
    }
    const id = slugify(provider.id)
    provider.id = id
    const existing = existingProviders.get(id)?.provider
    const output = existing ? enrichProvider(existing, provider, observedAt, canonicalIndex) : createProvider(provider, observedAt, canonicalIndex)
    const file = existingProviders.get(id)?.file ?? `${id}.json`
    writeJson(join(dataDir, file), output)
    if (existing) enriched += 1
    else created += 1
  }

  return { enriched, created, skipped }
}

export function loadModelsDevSource(path = join(process.cwd(), '.internal', 'source-data', 'models-dev-api.raw.json')) {
  return readJson(path)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sourcePath = process.env.MODELS_DEV_SOURCE ?? join(process.cwd(), '.internal', 'source-data', 'models-dev-api.raw.json')
  const dataDir = process.env.MODELS_DEV_DATA_DIR ?? join(process.cwd(), 'data', 'providers')
  const source = loadModelsDevSource(sourcePath)
  const result = populateModelsDevProviders({ dataDir, source })
  console.log(`models-dev providers: enriched=${result.enriched} created=${result.created} skipped=${result.skipped}`)
}
