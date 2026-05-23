import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE_URL = 'https://models.dev/api.json'

const MODELS_DEV_PROVIDER_ALIASES = new Map(Object.entries({
  'alibaba-cn': 'alibaba',
  'alibaba-coding-plan': 'alibaba',
  'alibaba-coding-plan-cn': 'alibaba',
  'fireworks-ai': 'fireworks',
  'minimax-cn': 'minimax',
  'minimax-coding-plan': 'minimax',
  'minimax-cn-coding-plan': 'minimax',
  moonshotai: 'moonshot-ai',
  'moonshotai-cn': 'moonshot-ai',
  'siliconflow-cn': 'siliconflow',
  'stepfun-ai': 'stepfun',
  'tencent-coding-plan': 'tencent',
  'tencent-tokenhub': 'tencent',
  togetherai: 'together',
  'xiaomi-token-plan-ams': 'xiaomi',
  'xiaomi-token-plan-cn': 'xiaomi',
  'xiaomi-token-plan-sgp': 'xiaomi',
  zai: 'z-ai',
  'zai-coding-plan': 'z-ai',
  zhipuai: 'z-ai',
  'zhipuai-coding-plan': 'z-ai',
}))

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map((entry) => stableJsonValue(entry))
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]))
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
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function providerRecordFromModelsDev(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null
  return value
}

function modelsDevRemoteIconUrl(provider) {
  if (typeof provider.iconURL === 'string' && provider.iconURL.trim() !== '') return provider.iconURL
  return `https://models.dev/logos/${provider.modelsDevId ?? provider.id}.svg`
}

function localProviderIconPath(provider) {
  return `/assets/provider-icons/${provider.id}.svg`
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

function modelAuthorIds(model) {
  return uniqueBy([model.author_id, model.author].filter(Boolean).map(slugify), String)
}

function matchingProviderForModel(model, providersById) {
  for (const id of modelAuthorIds(model)) {
    const provider = providersById.get(id)
    if (provider) return provider
  }
  return null
}

function iconSource(provider, observedAt) {
  return { source: 'models.dev', source_id: provider.modelsDevId ?? provider.id, url: SOURCE_URL, observed_at: observedAt }
}

function mergeSources(existing, addition) {
  return uniqueBy([...(Array.isArray(existing) ? existing : []), addition], (source) => `${source.source}|${source.source_id}`)
}

function enrichModelIcon(model, provider, observedAt) {
  const icon = localProviderIconPath(provider)
  const next = { ...model, icon }
  const params = model.other_parameters && typeof model.other_parameters === 'object' && !Array.isArray(model.other_parameters) ? model.other_parameters : {}
  next.other_parameters = {
    ...params,
    models_dev: {
      ...(params.models_dev && typeof params.models_dev === 'object' && !Array.isArray(params.models_dev) ? params.models_dev : {}),
      remote_icon: modelsDevRemoteIconUrl(provider),
    },
  }
  next.sources = mergeSources(model.sources, iconSource(provider, observedAt))
  return next
}

export function populateModelsDevProviders({ modelsPath = join(process.cwd(), 'data', 'models.json'), source, observedAt = new Date().toISOString() } = {}) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('models.dev provider source must be an object')
  const payload = readJson(modelsPath)
  const models = Array.isArray(payload.models) ? payload.models : []
  const providersById = new Map()
  let skippedProviders = 0

  for (const raw of Object.values(source)) {
    const provider = { ...providerRecordFromModelsDev(raw) }
    if (!provider) {
      skippedProviders += 1
      continue
    }
    const rawId = slugify(provider.id)
    const canonicalId = MODELS_DEV_PROVIDER_ALIASES.get(rawId) ?? rawId
    provider.modelsDevId = rawId
    provider.id = canonicalId
    providersById.set(canonicalId, provider)
  }

  let enriched = 0
  let skipped = skippedProviders
  const outputModels = models.map((model) => {
    const provider = matchingProviderForModel(model, providersById)
    if (!provider) {
      skipped += 1
      return model
    }
    const next = enrichModelIcon(model, provider, observedAt)
    if (!sameJsonValue(model, next)) enriched += 1
    return next
  })

  writeJsonIfChanged(modelsPath, { ...payload, models: outputModels })
  return { enriched, created: 0, skipped }
}

export function loadModelsDevSource(path = join(process.cwd(), '.internal', 'source-data', 'models-dev-api.raw.json')) {
  return readJson(path)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sourcePath = process.env.MODELS_DEV_SOURCE ?? join(process.cwd(), '.internal', 'source-data', 'models-dev-api.raw.json')
  const modelsPath = process.env.MODELS_DEV_MODELS_PATH ?? join(process.cwd(), 'data', 'models.json')
  const source = loadModelsDevSource(sourcePath)
  const result = populateModelsDevProviders({ modelsPath, source })
  console.log(`models-dev icons: enriched=${result.enriched} skipped=${result.skipped}`)
}
