#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = join(ROOT, '.internal/next-registry')
const RAW_DIR = join(OUT_DIR, 'raw')
const PROVIDERS_DIR = join(OUT_DIR, 'providers')
const REPORTS_DIR = join(OUT_DIR, 'reports')
const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

const KNOWN_AUTHOR_PROVIDERS = new Set([
  'openai', 'anthropic', 'deepseek', 'gemini', 'google', 'mistral', 'cohere', 'xai', 'zai', 'zhipu', 'qwen', 'moonshot', 'minimax', 'ai21', 'meta', 'perplexity'
])
const CLOUD_PROVIDERS = new Set(['bedrock', 'bedrock_converse', 'vertex_ai', 'vertex_ai-language-models', 'azure'])
const GATEWAY_PROVIDERS = new Set(['openrouter', 'deepinfra', 'together_ai', 'fireworks_ai', 'replicate', 'groq'])

function ensureDirs() {
  for (const dir of [OUT_DIR, RAW_DIR, PROVIDERS_DIR, REPORTS_DIR]) mkdirSync(dir, { recursive: true })
}

function slugify(value) {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function loadLiteLlm() {
  const cachePath = join(RAW_DIR, 'litellm-model-prices.json')
  if (existsSync(cachePath) && process.env.FORCE_FETCH !== '1') return readJson(cachePath)
  const res = await fetch(LITELLM_URL, { headers: { 'user-agent': 'mddb.dev next-registry experiment' } })
  if (!res.ok) throw new Error(`LiteLLM fetch failed: ${res.status}`)
  const data = await res.json()
  writeJson(cachePath, data)
  return data
}

function rolesForProvider(id) {
  const roles = new Set(['api_provider'])
  if (KNOWN_AUTHOR_PROVIDERS.has(id)) roles.add('model_author')
  if (CLOUD_PROVIDERS.has(id)) roles.add('cloud_platform')
  if (GATEWAY_PROVIDERS.has(id)) {
    roles.add('gateway')
    roles.add('marketplace')
  }
  if (id === 'openrouter') roles.add('data_source')
  return [...roles]
}

function pathForMode(mode) {
  const m = String(mode ?? '').toLowerCase()
  if (m === 'chat' || m === 'responses') return '/chat/completions'
  if (m === 'completion') return '/completions'
  if (m === 'embedding') return '/embeddings'
  if (m.includes('image')) return '/images/generations'
  if (m.includes('transcription')) return '/audio/transcriptions'
  if (m.includes('speech')) return '/audio/speech'
  if (m.includes('rerank')) return '/rerank'
  return null
}

function priceFromLiteLlm(row) {
  const p = {}
  const map = {
    input_cost_per_token: 'input',
    output_cost_per_token: 'output',
    cache_read_input_token_cost: 'cache_read',
    cache_creation_input_token_cost: 'cache_write',
    input_cost_per_token_batches: 'input_batch',
    output_cost_per_token_batches: 'output_batch',
    input_cost_per_token_priority: 'input_priority',
    output_cost_per_token_priority: 'output_priority',
  }
  for (const [src, dst] of Object.entries(map)) {
    if (typeof row[src] === 'number') p[dst] = Number((row[src] * 1_000_000).toPrecision(10))
  }
  if (!Object.keys(p).length) return []
  return [{ currency: 'USD', unit: 'per_1m_tokens', ...p, source: LITELLM_URL }]
}

function limitsFromRow(row) {
  const limits = {}
  if (typeof row.max_input_tokens === 'number') limits.context_window = row.max_input_tokens
  else if (typeof row.max_tokens === 'number') limits.context_window = row.max_tokens
  if (typeof row.max_output_tokens === 'number') limits.max_output_tokens = row.max_output_tokens
  return limits
}

function featuresFromRow(row) {
  return Object.keys(row).filter((k) => k.startsWith('supports_') && row[k] === true).map((k) => k.replace(/^supports_/, ''))
}

function inferModelId(sourceId, providerId) {
  let id = String(sourceId)
  for (const prefix of [`${providerId}/`, 'openrouter/']) {
    if (id.toLowerCase().startsWith(prefix.toLowerCase())) id = id.slice(prefix.length)
  }
  if (id.includes('/')) id = id.split('/').at(-1)
  const bedrockMatch = id.match(/(?:^|\.)([a-z0-9-]+(?:-[a-z0-9]+)+-v\d+)(?::\d+)?$/i)
  if (bedrockMatch) id = bedrockMatch[1]
  return slugify(id.replace(/:.*$/, ''))
}

function modelMatch(sourceId, modelId) {
  if (sourceId.includes(':free')) return 'candidate_free_or_promo'
  if (/latest|preview|beta|experimental/i.test(sourceId)) return 'candidate_alias_or_preview'
  if (/\d{4}[-]?\d{2}[-]?\d{2}/.test(sourceId)) return 'variant_candidate'
  return 'candidate'
}

function offerFromLiteLlm(sourceId, row) {
  const providerId = slugify(row.litellm_provider ?? 'unknown')
  const model = inferModelId(sourceId, providerId)
  return {
    source: 'litellm',
    source_model_id: sourceId,
    api_model_id: sourceId,
    model,
    model_match: modelMatch(sourceId, model),
    mode: row.mode ?? null,
    path: pathForMode(row.mode),
    prices: priceFromLiteLlm(row),
    limits: limitsFromRow(row),
    features: featuresFromRow(row),
  }
}

function buildFromLiteLlm(lite) {
  const providers = new Map()
  const modelCandidates = new Map()
  for (const [sourceId, row] of Object.entries(lite)) {
    if (!row || typeof row !== 'object') continue
    const providerId = slugify(row.litellm_provider ?? 'unknown')
    if (!providers.has(providerId)) {
      providers.set(providerId, {
        schema_version: 0,
        id: providerId,
        name: providerId,
        roles: rolesForProvider(providerId),
        base_url: null,
        source: 'litellm',
        endpoints: [],
        offers: [],
      })
    }
    const offer = offerFromLiteLlm(sourceId, row)
    providers.get(providerId).offers.push(offer)
    if (!modelCandidates.has(offer.model)) {
      modelCandidates.set(offer.model, {
        id: offer.model,
        name: offer.model,
        author: providerId,
        status: 'candidate',
        sources: [{ type: 'litellm', id: sourceId }],
      })
    }
  }
  return { providers, models: [...modelCandidates.values()] }
}

function openRouterPrice(pricing) {
  if (!pricing || typeof pricing !== 'object') return []
  const p = {}
  const map = { prompt: 'input', completion: 'output', image: 'image', request: 'request' }
  for (const [src, dst] of Object.entries(map)) {
    const n = Number(pricing[src])
    if (Number.isFinite(n) && n > 0) p[dst] = Number((n * 1_000_000).toPrecision(10))
  }
  if (!Object.keys(p).length) return []
  return [{ currency: 'USD', unit: 'per_1m_tokens', ...p, source: 'openrouter' }]
}

function augmentOpenRouter(providers) {
  const modelsData = readJson(join(ROOT, 'data/openrouter-models.json'), null)
  const endpointsData = readJson(join(ROOT, 'data/openrouter-endpoints.json'), null)
  if (!modelsData && !endpointsData) return { addedOffers: 0 }

  const provider = providers.get('openrouter') ?? {
    schema_version: 0,
    id: 'openrouter',
    name: 'OpenRouter',
    roles: ['api_provider', 'gateway', 'marketplace', 'data_source'],
    base_url: 'https://openrouter.ai/api/v1',
    source: 'openrouter',
    endpoints: [],
    offers: [],
  }
  provider.name = 'OpenRouter'
  provider.base_url = 'https://openrouter.ai/api/v1'
  provider.roles = [...new Set([...(provider.roles ?? []), 'gateway', 'marketplace', 'data_source'])]

  const existing = new Set(provider.offers.map((o) => `${o.source}:${o.source_model_id}`))
  let addedOffers = 0
  const rows = Array.isArray(modelsData?.data) ? modelsData.data : Array.isArray(modelsData) ? modelsData : []
  for (const row of rows) {
    const sourceId = row.id
    if (!sourceId) continue
    const key = `openrouter:${sourceId}`
    if (existing.has(key)) continue
    provider.offers.push({
      source: 'openrouter',
      source_model_id: sourceId,
      api_model_id: sourceId,
      model: inferModelId(sourceId, 'openrouter'),
      model_match: modelMatch(sourceId, sourceId),
      mode: row.architecture?.modality?.includes('embedding') ? 'embedding' : 'chat',
      path: row.architecture?.modality?.includes('embedding') ? '/embeddings' : '/chat/completions',
      prices: openRouterPrice(row.pricing),
      limits: { context_window: row.context_length ?? undefined },
      features: [],
    })
    addedOffers += 1
  }

  const endpointRows = Array.isArray(endpointsData) ? endpointsData : []
  let endpointOfferPrices = 0
  const bySource = new Map(provider.offers.map((o) => [o.source_model_id, o]))
  for (const wrap of endpointRows) {
    const id = wrap.id ?? wrap.modelId ?? wrap.sourceId
    const endpoints = wrap.response?.data?.endpoints ?? wrap.endpoints ?? []
    const offer = bySource.get(id)
    if (!offer || !Array.isArray(endpoints)) continue
    offer.endpoint_observations = endpoints.slice(0, 20).map((e) => ({
      provider_name: e.provider_name ?? e.name ?? e.provider?.name ?? null,
      context_window: e.context_length ?? e.max_prompt_tokens ?? null,
      max_output_tokens: e.max_completion_tokens ?? null,
      prices: openRouterPrice(e.pricing),
    }))
    if (offer.endpoint_observations.some((e) => e.prices.length)) endpointOfferPrices += 1
  }

  providers.set('openrouter', provider)
  return { addedOffers, endpointOfferPrices }
}

function reportsFor(providers, models, openrouterStats) {
  const providerStats = [...providers.values()].map((p) => {
    const offers = p.offers ?? []
    return {
      id: p.id,
      roles: p.roles,
      offer_count: offers.length,
      priced_offer_count: offers.filter((o) => o.prices?.length).length,
      path_missing_count: offers.filter((o) => !o.path).length,
    }
  }).sort((a, b) => b.offer_count - a.offer_count)
  const allOffers = [...providers.values()].flatMap((p) => p.offers.map((o) => ({ provider: p.id, ...o })))
  return {
    sourceStats: {
      provider_count: providers.size,
      model_candidate_count: models.length,
      offer_count: allOffers.length,
      priced_offer_count: allOffers.filter((o) => o.prices?.length).length,
      path_missing_count: allOffers.filter((o) => !o.path).length,
      openrouter: openrouterStats,
    },
    providerStats,
    modelCandidates: models.slice(0, 500),
    unmatchedOffers: allOffers.filter((o) => o.model_match !== 'candidate').slice(0, 1000),
    priceFieldCoverage: providerStats,
  }
}

async function main() {
  ensureDirs()
  const lite = await loadLiteLlm()
  const { providers, models } = buildFromLiteLlm(lite)
  const openrouterStats = augmentOpenRouter(providers)

  const sortedProviders = [...providers.values()].sort((a, b) => a.id.localeCompare(b.id))
  writeJson(join(OUT_DIR, 'models.json'), { schema_version: 0, generated_from: ['litellm'], models })
  for (const p of sortedProviders) writeJson(join(PROVIDERS_DIR, `${p.id}.json`), p)

  const reports = reportsFor(providers, models, openrouterStats)
  writeJson(join(REPORTS_DIR, 'source-stats.json'), reports.sourceStats)
  writeJson(join(REPORTS_DIR, 'provider-stats.json'), reports.providerStats)
  writeJson(join(REPORTS_DIR, 'model-candidates.json'), reports.modelCandidates)
  writeJson(join(REPORTS_DIR, 'unmatched-offers.json'), reports.unmatchedOffers)
  writeJson(join(REPORTS_DIR, 'price-field-coverage.json'), reports.priceFieldCoverage)
  console.log(JSON.stringify(reports.sourceStats, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
