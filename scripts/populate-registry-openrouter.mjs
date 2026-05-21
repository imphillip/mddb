#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const RAW_PATH = process.env.OPENROUTER_RAW_PATH ?? join(ROOT, '.internal/source-data/openrouter.raw.json')
const OUT_DIR = process.env.MDDB_REGISTRY_DIR ?? join(ROOT, 'data')
const PROVIDERS_DIR = join(OUT_DIR, 'providers')
const OBSERVED_AT = new Date().toISOString()

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonIfExists(path, fallback) {
  if (!existsSync(path)) return fallback
  return readJson(path)
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function slugify(value) {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function title(value) {
  return String(value ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

const PROVIDER_CANONICALS = [
  { id: 'aion-labs', name: 'Aion Labs', aliases: ['aion-labs', 'aionlabs', 'AionLabs', 'Aion Labs'] },
  { id: 'amazon', name: 'Amazon', aliases: ['amazon', 'Amazon', 'amazon-bedrock', 'Amazon Bedrock'] },
  { id: 'baidu', name: 'Baidu', aliases: ['baidu', 'Baidu', 'baidu-qianfan', 'Baidu Qianfan'] },
  { id: 'bytedance', name: 'ByteDance', aliases: ['bytedance', 'Bytedance', 'ByteDance', 'bytedance-seed', 'ByteDance Seed', 'Bytedance Seed', 'seed', 'Seed'] },
  { id: 'google', name: 'Google', aliases: ['google', 'Google', 'google-ai-studio', 'Google AI Studio'] },
  { id: 'mancer', name: 'Mancer', aliases: ['mancer', 'Mancer', 'mancer-2', 'Mancer 2'] },
  { id: 'meta-llama', name: 'Meta', aliases: ['meta-llama', 'Meta Llama', 'Meta'] },
  { id: 'mistral', name: 'Mistral', aliases: ['mistral', 'Mistral', 'mistralai', 'Mistralai', 'MistralAI', 'mistral-ai', 'Mistral AI'] },
  { id: 'moonshot-ai', name: 'Moonshot AI', aliases: ['moonshot-ai', 'Moonshot AI', 'moonshotai', 'MoonshotAI', 'Moonshotai'] },
  { id: 'nousresearch', name: 'NousResearch', aliases: ['nousresearch', 'NousResearch', 'nous-research', 'Nous Research', 'Nous'] },
  { id: 'xai', name: 'xAI', aliases: ['xai', 'xAI', 'XAI', 'x-ai', 'X Ai', 'X.AI'] },
  { id: 'z-ai', name: 'Z.AI', aliases: ['z-ai', 'Z Ai', 'Z-AI', 'z.ai', 'Z.AI', 'ZAI'] },
]

const PROVIDER_ALIAS_TO_CANONICAL = new Map()
for (const canonical of PROVIDER_CANONICALS) {
  for (const alias of canonical.aliases) PROVIDER_ALIAS_TO_CANONICAL.set(providerAliasKey(alias), canonical)
}

function providerAliasKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/^~/u, '')
    .toLowerCase()
    .replace(/[._]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeProviderIdentity(id, name = id) {
  const canonical = PROVIDER_ALIAS_TO_CANONICAL.get(providerAliasKey(id)) ?? PROVIDER_ALIAS_TO_CANONICAL.get(providerAliasKey(name))
  if (canonical) return { id: canonical.id, name: canonical.name }
  const providerId = slugify(id)
  return { id: providerId, name: name || title(providerId) }
}

function canonicalProviderId(value) {
  return normalizeProviderIdentity(value).id
}

function canonicalProviderName(id, name = id) {
  return normalizeProviderIdentity(id, name).name
}

function modelDisplayName(row, authorId, modelId) {
  const raw = String(row?.name ?? '').trim()
  const fallback = title(modelId)
  if (!raw) return fallback
  const authorName = canonicalProviderName(authorId, title(authorId))
  const prefixAliases = providerDisplayPrefixes(authorId, authorName)
  const prefixKeys = new Set([...prefixAliases].map((alias) => providerAliasKey(alias)))
  const colonMatch = raw.match(/^([^:]{1,80}):\s*(.+)$/u)
  if (colonMatch) {
    const prefix = colonMatch[1].trim()
    const rest = colonMatch[2].trim()
    if (rest) {
      const cleaned = stripFreeNameSuffix(rest)
      if (prefixKeys.has(providerAliasKey(prefix))) return cleaned
    }
  }
  for (const label of prefixAliases) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = raw.match(new RegExp(`^${escaped}\\s+(.+)$`, 'iu'))
    if (match?.[1]) return stripFreeNameSuffix(match[1].trim())
  }
  return stripFreeNameSuffix(raw)
}


function releaseTimestampSeconds(row) {
  const candidates = [
    row?.created,
    row?.release_date,
    row?.released_at,
    row?.published_at,
    row?.openrouter_page?.extracted?.model?.releaseDate,
  ]
  for (const candidate of candidates) {
    const value = timestampSeconds(candidate)
    if (value !== undefined) return value
  }
  return undefined
}

function timestampSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return Math.floor(numeric > 1_000_000_000_000 ? numeric / 1000 : numeric)
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }
  return undefined
}

function providerDisplayPrefixes(authorId, authorName) {
  const canonical = PROVIDER_CANONICALS.find((candidate) => candidate.id === authorId)
  return new Set([authorName, authorId, ...(canonical?.aliases ?? [])].filter(Boolean))
}

function stripFreeNameSuffix(value) {
  return String(value ?? '')
    .replace(/\s*[-:：]?\s*[（(]\s*free\s*[）)]\s*$/iu, '')
    .replace(/\s*[-:：]\s*free\s*$/iu, '')
    .replace(/\s+free\s*$/iu, '')
    .replace(/\s{2,}/gu, ' ')
    .trim()
}

function stripProviderNamespace(sourceId, authorId) {
  let id = String(sourceId ?? '')
  if (id.includes('/')) {
    const [namespace, ...rest] = id.split('/')
    if (canonicalProviderId(namespace) === authorId || namespace.toLowerCase() === 'openrouter') id = rest.join('/')
  }
  for (const prefix of [`${authorId}/`, 'openrouter/']) {
    if (id.toLowerCase().startsWith(prefix.toLowerCase())) id = id.slice(prefix.length)
  }
  return slugify(id.replace(/:.*$/u, ''))
}

function inferAuthor(row) {
  const id = String(row.id ?? '')
  if (id.includes('/')) return canonicalProviderId(id.split('/')[0])
  const endpointProviders = row.openrouter_endpoint_details?.endpoints
    ?.map((e) => e.provider_name ?? e.provider?.name)
    ?.filter(Boolean) ?? []
  const firstProvider = endpointProviders.find((p) => !/openrouter/i.test(String(p)))
  return canonicalProviderId(firstProvider ?? row.owned_by ?? row.author ?? 'unknown')
}

function modalitiesFromArchitecture(row) {
  const modality = String(row.architecture?.modality ?? '').toLowerCase()
  const input = new Set(['text'])
  const output = new Set(['text'])
  if (modality.includes('image')) {
    if (modality.includes('->image') || modality.includes('text+image')) output.add('image')
    else input.add('image')
  }
  if (modality.includes('audio')) {
    if (modality.includes('->audio')) output.add('audio')
    else input.add('audio')
  }
  if (modality.includes('video')) {
    if (modality.includes('->video')) output.add('video')
    else input.add('video')
  }
  if (modality.includes('embedding')) {
    output.clear()
    output.add('embedding')
  }
  return { input: [...input], output: [...output] }
}

function modeFor(row) {
  const modality = String(row.architecture?.modality ?? '').toLowerCase()
  if (modality.includes('embedding')) return 'embedding'
  if (modality.includes('image')) return 'image'
  if (modality.includes('audio')) return 'audio'
  if (modality.includes('video')) return 'video'
  return 'chat'
}

function endpointPathForMode(mode) {
  if (mode === 'embedding') return '/embeddings'
  if (mode === 'image') return '/images/generations'
  if (mode === 'audio') return '/audio/speech'
  if (mode === 'video') return '/videos/generations'
  return '/chat/completions'
}

function per1m(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Number((n * 1_000_000).toPrecision(10)) : null
}

function restoreObservedAt(value, previous) {
  if (Array.isArray(value)) return value.map((item, index) => restoreObservedAt(item, previous?.[index]))
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, entry] of Object.entries(value)) {
    out[key] = key === 'observed_at' && previous?.[key]
      ? previous[key]
      : restoreObservedAt(entry, previous?.[key])
  }
  return out
}

function priceSetFromPricing(pricing, source = 'openrouter', previousPrice) {
  if (!pricing || typeof pricing !== 'object') return []
  const prices = {}
  const input = per1m(pricing.prompt)
  const output = per1m(pricing.completion)
  const image = Number(pricing.image)
  const request = Number(pricing.request)
  const webSearch = Number(pricing.web_search)
  const internalReasoning = per1m(pricing.internal_reasoning)
  if (input !== null) prices.input = { amount: input, unit: 'per_1m_tokens' }
  if (output !== null) prices.output = { amount: output, unit: 'per_1m_tokens' }
  if (internalReasoning !== null) prices.internal_reasoning = { amount: internalReasoning, unit: 'per_1m_tokens' }
  if (Number.isFinite(image) && image > 0) prices.image = { amount: image, unit: 'per_image' }
  if (Number.isFinite(request) && request > 0) prices.request = { amount: request, unit: 'per_request' }
  if (Number.isFinite(webSearch) && webSearch > 0) prices.web_search = { amount: webSearch, unit: 'per_request' }
  if (!Object.keys(prices).length) return []
  const raw_pricing = restoreObservedAt(pricing, previousPrice?.raw_pricing)
  const observed_at = previousPrice
    && previousPrice.source === source
    && JSON.stringify(previousPrice.prices ?? {}) === JSON.stringify(prices)
    && JSON.stringify(previousPrice.raw_pricing ?? {}) === JSON.stringify(raw_pricing)
    ? previousPrice.observed_at
    : OBSERVED_AT
  return [{ conditions: {}, prices, currency: 'USD', source, observed_at, raw_pricing }]
}

function uniqueBy(items, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function withoutTemporal(value) {
  if (Array.isArray(value)) return value.map(withoutTemporal)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'last_updated' && key !== 'observed_at')
      .map(([key, entry]) => [key, withoutTemporal(entry)]),
  )
}

function sameNonTemporal(a, b) {
  return JSON.stringify(withoutTemporal(a)) === JSON.stringify(withoutTemporal(b))
}

function stableOfferKey(offer) {
  return `${offer.model_id}|${offer.api_model_id}|${offer.endpoint_path}`
}

function isLatestRow(row) {
  const id = String(row?.id ?? '').split('/').at(-1) ?? ''
  return /(?:^|[-_:])latest$/iu.test(id.replace(/:free$/iu, ''))
}

function explicitSeriesKeys(modelId) {
  const id = String(modelId ?? '').replace(/:free$/iu, '')
  const keys = new Set()
  keys.add(slugify(id
    .replace(/-(?:v?\d+(?:\.\d+)*(?:-[a-z]+)?|\d{6,8})(?=-|$)/giu, '-')
    .replace(/-(?:preview|beta|alpha|instruct|chat)(?=$)/giu, '')))
  const parts = id.split('-')
  const numericIndex = parts.findIndex((part) => /^v?\d+(?:\.\d+)*$/iu.test(part))
  if (numericIndex > 0 && numericIndex < parts.length - 1) {
    keys.add(slugify([...parts.slice(0, numericIndex), ...parts.slice(numericIndex + 1)].join('-')))
  }
  return [...keys].filter(Boolean)
}

function latestSeriesKey(modelId) {
  return slugify(String(modelId ?? '')
    .replace(/:free$/iu, '')
    .replace(/-(?:latest)(?=$)/iu, ''))
}

function latestAliasTargets(rows) {
  const explicit = []
  const latest = []
  for (const row of rows) {
    if (!row?.id) continue
    const author = inferAuthor(row)
    const modelId = stripProviderNamespace(row.id, author)
    const entry = { row, author, modelId, release: releaseTimestampSeconds(row) ?? 0 }
    if (isLatestRow(row)) latest.push(entry)
    else explicit.push({ ...entry, seriesKeys: explicitSeriesKeys(modelId) })
  }
  const targets = new Map()
  for (const alias of latest) {
    const series = latestSeriesKey(alias.modelId)
    const candidates = explicit
      .filter((candidate) => candidate.author === alias.author && candidate.seriesKeys.includes(series))
      .sort((a, b) => (b.release - a.release) || a.modelId.localeCompare(b.modelId))
    if (candidates[0]) targets.set(alias.row.id, candidates[0])
  }
  return targets
}

function preservePreviousOfferOrder(offers, previous) {
  const byKey = new Map(offers.map((offer) => [stableOfferKey(offer), offer]))
  const ordered = []
  for (const oldOffer of previous?.offers ?? []) {
    const key = stableOfferKey(oldOffer)
    const current = byKey.get(key)
    if (!current) continue
    ordered.push(current)
    byKey.delete(key)
  }
  const additions = [...byKey.values()].sort((a, b) => stableOfferKey(a).localeCompare(stableOfferKey(b)))
  return [...ordered, ...additions]
}

if (!existsSync(RAW_PATH)) throw new Error(`OpenRouter raw not found: ${RAW_PATH}`)
const raw = readJson(RAW_PATH)
const rows = Array.isArray(raw.data) ? raw.data : []
const previousModelsJson = readJsonIfExists(join(OUT_DIR, 'models.json'), { models: [] })
const previousModelsById = new Map((previousModelsJson.models ?? []).map((model) => [model.id, model]))
const previousProviders = new Map()
if (existsSync(PROVIDERS_DIR)) {
  for (const fileName of readdirSync(PROVIDERS_DIR)) {
    if (!fileName.endsWith('.json')) continue
    const provider = readJson(join(PROVIDERS_DIR, fileName))
    previousProviders.set(provider.id ?? fileName.replace(/\.json$/u, ''), provider)
  }
}
const previousProvider = (id) => previousProviders.get(id) ?? null
const previousOffer = (providerId, modelId, apiModelId, endpointPath) => previousProvider(providerId)?.offers?.find((offer) => stableOfferKey(offer) === `${modelId}|${apiModelId}|${endpointPath}`)
mkdirSync(OUT_DIR, { recursive: true })
rmSync(PROVIDERS_DIR, { recursive: true, force: true })
mkdirSync(PROVIDERS_DIR, { recursive: true })

const modelMap = new Map()
const providerMap = new Map()
const latestTargets = latestAliasTargets(rows)

function ensureProvider(id, name, extra = {}) {
  const identity = normalizeProviderIdentity(id, name)
  const providerId = identity.id
  const providerName = identity.name
  const current = providerMap.get(providerId) ?? {
    schema_version: 1,
    id: providerId,
    provider: providerName || title(providerId),
    icon: extra.icon,
    domain: extra.domain,
    base_url: extra.base_url,
    currency: 'USD',
    offers: [],
    other_parameters: {},
    last_updated: OBSERVED_AT,
    sources: [],
  }
  current.provider = current.provider || providerName || title(providerId)
  current.icon ??= extra.icon
  current.domain ??= extra.domain
  current.base_url ??= extra.base_url
  providerMap.set(providerId, current)
  return current
}

ensureProvider('openrouter', 'OpenRouter', {
  domain: 'openrouter.ai',
  base_url: 'https://openrouter.ai/api/v1',
})

for (const row of rows) {
  if (!row?.id) continue
  const author = inferAuthor(row)
  const sourceModelId = stripProviderNamespace(row.id, author)
  const latestTarget = latestTargets.get(row.id)
  const modelId = latestTarget?.modelId ?? sourceModelId
  const displayName = latestTarget ? modelDisplayName(latestTarget.row, author, modelId) : modelDisplayName(row, author, modelId)
  const modalities = latestTarget ? modalitiesFromArchitecture(latestTarget.row) : modalitiesFromArchitecture(row)
  ensureProvider(author, canonicalProviderName(author, title(author)))

  if (!modelMap.has(modelId)) {
    const modelRow = latestTarget?.row ?? row
    const previousModel = previousModelsById.get(modelId)
    const previousSource = previousModel?.sources?.find((source) => source.source === 'openrouter' && source.source_id === modelRow.id)
    modelMap.set(modelId, {
      id: modelId,
      model: displayName,
      alias: uniqueBy([modelRow.id, modelRow.canonical_slug, latestTarget ? row.id : undefined, latestTarget ? row.canonical_slug : undefined].filter(Boolean).filter((x) => x !== modelId), String),
      author,
      input_modalities: modalities.input,
      output_modalities: modalities.output,
      reasoning: Array.isArray(modelRow.supported_parameters) && modelRow.supported_parameters.includes('reasoning'),
      tool_calling: Array.isArray(modelRow.supported_parameters) && modelRow.supported_parameters.includes('tools'),
      context_length: typeof modelRow.context_length === 'number' ? modelRow.context_length : undefined,
      max_output_tokens: typeof modelRow.top_provider?.max_completion_tokens === 'number' ? modelRow.top_provider.max_completion_tokens : undefined,
      release_timestamp: releaseTimestampSeconds(modelRow),
      other_parameters: {
        tokenizer: modelRow.architecture?.tokenizer,
        instruct_type: modelRow.architecture?.instruct_type,
        supported_parameters: modelRow.supported_parameters,
      },
      last_updated: previousModel?.last_updated ?? OBSERVED_AT,
      sources: [{ source: 'openrouter', source_id: modelRow.id, url: `https://openrouter.ai/${modelRow.id}`, observed_at: previousSource?.observed_at ?? OBSERVED_AT }],
    })
  } else if (latestTarget) {
    const model = modelMap.get(modelId)
    model.alias = uniqueBy([...model.alias, row.id, row.canonical_slug].filter(Boolean).filter((x) => x !== modelId), String)
  }

  const openrouter = ensureProvider('openrouter', 'OpenRouter', {
    domain: 'openrouter.ai',
    base_url: 'https://openrouter.ai/api/v1',
  })
  const mode = modeFor(row)
  const endpoints = Array.isArray(row.openrouter_endpoint_details?.endpoints) ? row.openrouter_endpoint_details.endpoints : []
  const openrouterOfferPath = endpointPathForMode(mode)
  const previousOpenRouterOffer = previousOffer('openrouter', modelId, row.id, openrouterOfferPath)
  const providerNames = uniqueBy(endpoints.map((e) => e.provider_name ?? e.provider?.name).filter(Boolean).map((name) => normalizeProviderIdentity(name).name), (x) => slugify(x))
  openrouter.offers.push({
    model_id: modelId,
    model: displayName,
    endpoint_path: openrouterOfferPath,
    api_model_id: row.id,
    mode,
    prices: priceSetFromPricing(row.pricing, 'openrouter', previousOpenRouterOffer?.prices?.[0]),
    other_parameters: {
      source_id: row.id,
      canonical_slug: row.canonical_slug,
      endpoint_providers: providerNames,
      endpoint_count: endpoints.length,
      context_length: row.context_length,
      max_completion_tokens: row.top_provider?.max_completion_tokens,
    },
    sources: [{ source: 'openrouter', source_id: row.id, url: `https://openrouter.ai/${row.id}`, observed_at: previousOpenRouterOffer?.sources?.find((source) => source.source === 'openrouter' && source.source_id === row.id)?.observed_at ?? OBSERVED_AT }],
  })

  for (const endpoint of endpoints) {
    const endpointProviderName = endpoint.provider_name ?? endpoint.provider?.name
    if (!endpointProviderName) continue
    const endpointProviderId = canonicalProviderId(endpointProviderName)
    const provider = ensureProvider(endpointProviderId, endpointProviderName)
    const endpointMode = mode
    const endpointPath = endpointPathForMode(endpointMode)
    const endpointApiModelId = endpoint.tag ?? row.id
    const previousEndpointOffer = previousOffer(endpointProviderId, modelId, endpointApiModelId, endpointPath)
    provider.offers.push({
      model_id: modelId,
      model: displayName,
      endpoint_path: endpointPath,
      api_model_id: endpointApiModelId,
      mode: endpointMode,
      prices: priceSetFromPricing(endpoint.pricing, 'openrouter-endpoint', previousEndpointOffer?.prices?.[0]),
      other_parameters: {
        source_model_id: row.id,
        endpoint_tag: endpoint.tag,
        context_length: endpoint.context_length,
        max_output_tokens: endpoint.max_completion_tokens,
        supported_parameters: endpoint.supported_parameters,
        status: endpoint.status,
        uptime_30min: endpoint.uptime_30min,
        latency: endpoint.latency,
        throughput: endpoint.throughput,
      },
      sources: [{ source: 'openrouter:endpoints', source_id: `${row.id}#${endpoint.name ?? endpoint.tag ?? endpointProviderName}`, url: row.links?.endpoints, observed_at: previousEndpointOffer?.sources?.find((source) => source.source === 'openrouter:endpoints' && source.source_id === `${row.id}#${endpoint.name ?? endpoint.tag ?? endpointProviderName}`)?.observed_at ?? OBSERVED_AT }],
    })
  }
}

const models = [...modelMap.values()].sort((a, b) => a.id.localeCompare(b.id))
for (const model of models) {
  for (const key of ['context_length', 'max_output_tokens', 'knowledge_cutoff', 'released', 'deprecation']) {
    if (model[key] === undefined) delete model[key]
  }
  if (!Object.keys(model.other_parameters ?? {}).some((k) => model.other_parameters[k] !== undefined)) model.other_parameters = {}
}

writeJson(join(OUT_DIR, 'models.json'), {
  schema_version: 1,
  models,
  last_updated: previousModelsJson?.last_updated && sameNonTemporal(previousModelsJson, { schema_version: 1, models, last_updated: OBSERVED_AT })
    ? previousModelsJson.last_updated
    : OBSERVED_AT,
})

for (const provider of [...providerMap.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const previous = previousProvider(provider.id)
  provider.offers = preservePreviousOfferOrder(uniqueBy(provider.offers, stableOfferKey), previous)
  for (const key of ['icon', 'domain', 'base_url']) {
    if (provider[key] === undefined) delete provider[key]
  }
  if (previous && sameNonTemporal(previous, provider)) {
    provider.last_updated = previous.last_updated
  }
  writeJson(join(PROVIDERS_DIR, `${provider.id}.json`), provider)
}

console.log(JSON.stringify({
  source: RAW_PATH,
  models: models.length,
  providers: providerMap.size,
  offers: [...providerMap.values()].reduce((sum, p) => sum + p.offers.length, 0),
  outDir: OUT_DIR,
}, null, 2))
