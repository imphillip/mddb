#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const RAW_PATH = process.env.OPENROUTER_RAW_PATH ?? join(ROOT, '.internal/source-data/openrouter.raw.json')
const OUT_DIR = process.env.MDDB_REGISTRY_DIR ?? join(ROOT, 'data')
const PROVIDERS_DIR = join(OUT_DIR, 'providers')
const OBSERVED_AT = new Date().toISOString()

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function stripProviderNamespace(sourceId, authorId) {
  let id = String(sourceId ?? '')
  for (const prefix of [`${authorId}/`, 'openrouter/']) {
    if (id.toLowerCase().startsWith(prefix.toLowerCase())) id = id.slice(prefix.length)
  }
  return slugify(id.replace(/:.*$/u, ''))
}

function inferAuthor(row) {
  const id = String(row.id ?? '')
  if (id.includes('/')) return slugify(id.split('/')[0])
  const endpointProviders = row.openrouter_endpoint_details?.endpoints
    ?.map((e) => e.provider_name ?? e.provider?.name)
    ?.filter(Boolean) ?? []
  const firstProvider = endpointProviders.find((p) => !/openrouter/i.test(String(p)))
  return slugify(firstProvider ?? row.owned_by ?? row.author ?? 'unknown')
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

function priceSetFromPricing(pricing, source = 'openrouter') {
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
  return [{ conditions: {}, prices, currency: 'USD', source, observed_at: OBSERVED_AT, raw_pricing: pricing }]
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

if (!existsSync(RAW_PATH)) throw new Error(`OpenRouter raw not found: ${RAW_PATH}`)
const raw = readJson(RAW_PATH)
const rows = Array.isArray(raw.data) ? raw.data : []
mkdirSync(OUT_DIR, { recursive: true })
rmSync(PROVIDERS_DIR, { recursive: true, force: true })
mkdirSync(PROVIDERS_DIR, { recursive: true })

const modelMap = new Map()
const providerMap = new Map()

function ensureProvider(id, name, extra = {}) {
  const providerId = slugify(id)
  const current = providerMap.get(providerId) ?? {
    schema_version: 1,
    id: providerId,
    provider: name || title(providerId),
    icon: extra.icon,
    domain: extra.domain,
    base_url: extra.base_url,
    currency: 'USD',
    offers: [],
    other_parameters: {},
    last_updated: OBSERVED_AT,
    sources: [],
  }
  current.provider = current.provider || name || title(providerId)
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
  const modelId = stripProviderNamespace(row.id, author)
  const modalities = modalitiesFromArchitecture(row)
  ensureProvider(author, title(author))

  if (!modelMap.has(modelId)) {
    modelMap.set(modelId, {
      id: modelId,
      model: row.name ?? title(modelId),
      alias: uniqueBy([row.id, row.canonical_slug].filter(Boolean).filter((x) => x !== modelId), String),
      author,
      input_modalities: modalities.input,
      output_modalities: modalities.output,
      reasoning: Array.isArray(row.supported_parameters) && row.supported_parameters.includes('reasoning'),
      tool_calling: Array.isArray(row.supported_parameters) && row.supported_parameters.includes('tools'),
      context_length: typeof row.context_length === 'number' ? row.context_length : undefined,
      max_output_tokens: typeof row.top_provider?.max_completion_tokens === 'number' ? row.top_provider.max_completion_tokens : undefined,
      other_parameters: {
        tokenizer: row.architecture?.tokenizer,
        instruct_type: row.architecture?.instruct_type,
        supported_parameters: row.supported_parameters,
      },
      last_updated: OBSERVED_AT,
      sources: [{ source: 'openrouter', source_id: row.id, url: `https://openrouter.ai/${row.id}`, observed_at: OBSERVED_AT }],
    })
  }

  const openrouter = ensureProvider('openrouter', 'OpenRouter', {
    domain: 'openrouter.ai',
    base_url: 'https://openrouter.ai/api/v1',
  })
  const mode = modeFor(row)
  const endpoints = Array.isArray(row.openrouter_endpoint_details?.endpoints) ? row.openrouter_endpoint_details.endpoints : []
  const providerNames = uniqueBy(endpoints.map((e) => e.provider_name ?? e.provider?.name).filter(Boolean), (x) => slugify(x))
  openrouter.offers.push({
    model_id: modelId,
    model: row.name ?? title(modelId),
    endpoint_path: endpointPathForMode(mode),
    api_model_id: row.id,
    mode,
    prices: priceSetFromPricing(row.pricing),
    other_parameters: {
      source_id: row.id,
      canonical_slug: row.canonical_slug,
      endpoint_providers: providerNames,
      endpoint_count: endpoints.length,
      context_length: row.context_length,
      max_completion_tokens: row.top_provider?.max_completion_tokens,
    },
    sources: [{ source: 'openrouter', source_id: row.id, url: `https://openrouter.ai/${row.id}`, observed_at: OBSERVED_AT }],
  })

  for (const endpoint of endpoints) {
    const endpointProviderName = endpoint.provider_name ?? endpoint.provider?.name
    if (!endpointProviderName) continue
    const endpointProviderId = slugify(endpointProviderName)
    const provider = ensureProvider(endpointProviderId, endpointProviderName)
    const endpointMode = mode
    provider.offers.push({
      model_id: modelId,
      model: row.name ?? title(modelId),
      endpoint_path: endpointPathForMode(endpointMode),
      api_model_id: endpoint.tag ?? row.id,
      mode: endpointMode,
      prices: priceSetFromPricing(endpoint.pricing, 'openrouter-endpoint'),
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
      sources: [{ source: 'openrouter:endpoints', source_id: `${row.id}#${endpoint.name ?? endpoint.tag ?? endpointProviderName}`, url: row.links?.endpoints, observed_at: OBSERVED_AT }],
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
  last_updated: OBSERVED_AT,
})

for (const provider of [...providerMap.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  provider.offers = uniqueBy(provider.offers, (offer) => `${offer.model_id}|${offer.api_model_id}|${offer.endpoint_path}`).sort((a, b) => a.model_id.localeCompare(b.model_id))
  for (const key of ['icon', 'domain', 'base_url']) {
    if (provider[key] === undefined) delete provider[key]
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
