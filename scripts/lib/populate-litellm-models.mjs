import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const CANONICAL_MODES = new Set(['embedding', 'rerank', 'audio_transcription', 'audio_speech', 'video_generation'])

const PROVIDER_AUTHOR_ALIASES = new Map(Object.entries({
  azure: 'openai',
  azure_ai: 'cohere',
  'vertex-ai': 'google',
  vertex_ai: 'google',
  'vertex-ai-video-models': 'google',
  'vertex-ai-embedding-models': 'google',
  'vertex_ai-video-models': 'google',
  'vertex_ai-embedding-models': 'google',
  gemini: 'google',
  jina_ai: 'jina-ai',
  'azure-ai': 'cohere',
  azure_ai: 'cohere',
  fireworks_ai: 'fireworks',
  'fireworks-ai': 'fireworks',
  'fireworks-ai-embedding-models': 'fireworks',
  'fireworks_ai-embedding-models': 'fireworks',
  aws_polly: 'amazon',
  'aws-polly': 'amazon',
  bedrock: 'amazon',
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
    .replace(/_/g, '-')
    .replace(/[^a-z0-9./:-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
}

function tailId(value) {
  return slugify(value).split('/').at(-1)?.replace(/:free$/u, '') ?? ''
}

function normalizeProvider(value) {
  const slug = slugify(value).replace(/\//g, '-')
  return PROVIDER_AUTHOR_ALIASES.get(slug) ?? slug
}

function prefixedId(rawId) {
  const normalized = slugify(rawId).replace(/[/:]+/gu, '-')
  return normalized.replace(/-+/gu, '-').replace(/^-|-$/gu, '')
}

function canonicalIdFromRaw(rawId, row) {
  const id = tailId(rawId)
  if (!id) return ''
  const provider = normalizeProvider(row.litellm_provider)
  const rawSlug = slugify(rawId)
  if (!rawSlug.includes('/')) return id
  const firstSegment = normalizeProvider(rawSlug.split('/')[0])
  if (firstSegment && !['azure', 'openai', 'vercel-ai-gateway', 'vertex-ai', 'google'].includes(firstSegment) && firstSegment !== provider) return prefixedId(rawId)
  if (/^(best|nano|base|standard|neural|long-form|generative|pro|turbo|large|small|mini|flash|hd)$/u.test(id)) return prefixedId(rawId)
  return id
}

function authorFromRawSegments(rawId) {
  const segments = slugify(rawId).split('/').filter(Boolean).map((segment) => normalizeProvider(segment))
  for (const segment of segments.slice(0, -1)) {
    if (['azure', 'bedrock', 'vercel-ai-gateway', 'vertex-ai', 'vertex-ai-video-models', 'vertex-ai-embedding-models'].includes(segment)) continue
    if (segment === 'speech') continue
    return segment
  }
  return ''
}

function authorFromRow(rawId, row) {
  const provider = normalizeProvider(row.litellm_provider)
  const segmentAuthor = authorFromRawSegments(rawId)
  if (segmentAuthor) return segmentAuthor
  if (provider === 'google') return 'google'
  if (provider === 'amazon') return inferAmazonAuthor(tailId(rawId))
  return provider || 'unknown'
}

function inferAmazonAuthor(id) {
  if (id.startsWith('cohere.')) return 'cohere'
  if (id.startsWith('amazon.')) return 'amazon'
  if (id.includes('twelvelabs')) return 'twelvelabs'
  return 'amazon'
}

function displayNameFromId(id) {
  return String(id ?? '')
    .replace(/[:/]+/gu, ' ')
    .split(/[-_\s]+/gu)
    .filter(Boolean)
    .map((part) => /^[v]\d/i.test(part) || /^\d/.test(part) ? part : part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bTts\b/g, 'TTS')
    .replace(/\bOcr\b/g, 'OCR')
}

function modalitiesForMode(mode, row) {
  const supportedInput = Array.isArray(row.supported_modalities) ? row.supported_modalities : []
  if (mode === 'embedding') {
    return {
      input: uniqueStrings(['text', ...(row.supports_embedding_image_input || row.supports_image_input ? ['image'] : []), ...(row.input_cost_per_audio_per_second ? ['audio'] : []), ...(row.input_cost_per_video_per_second ? ['video'] : [])]),
      output: ['embeddings'],
    }
  }
  if (mode === 'rerank') return { input: ['text'], output: ['rerank'] }
  if (mode === 'audio_transcription') return { input: ['audio'], output: ['transcription'] }
  if (mode === 'audio_speech') return { input: supportedInput.length ? supportedInput : ['text'], output: ['speech'] }
  if (mode === 'video_generation') return { input: supportedInput.length ? supportedInput : ['text'], output: ['video'] }
  return { input: ['text'], output: ['text'] }
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim() !== '').map((value) => value.trim()))]
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModelKey(value) {
  return tailId(value).replace(/[-_\s]+/gu, '-').replace(/(?<=\d)-(?=\d)/gu, '.')
}

function buildCanonicalIndex(models) {
  const exact = new Map()
  const normalized = new Map()
  for (const model of models) {
    if (typeof model?.id !== 'string') continue
    for (const value of [model.id, ...(Array.isArray(model.alias) ? model.alias : [])]) {
      exact.set(String(value).toLowerCase(), model)
      const key = normalizeModelKey(value)
      if (!key) continue
      if (!normalized.has(key)) normalized.set(key, model)
      else if (normalized.get(key)?.id !== model.id) normalized.set(key, null)
    }
  }
  return { exact, normalized }
}

function matchExisting(rawId, models, index) {
  const exact = index.exact.get(String(rawId).toLowerCase())
  if (exact) return exact
  const key = normalizeModelKey(rawId)
  return index.normalized.get(key) || null
}

function sourceObservation(rawId, observedAt) {
  return { source: 'litellm', source_id: rawId, url: SOURCE_URL, observed_at: observedAt }
}

function mergeSources(existing, additions) {
  const seen = new Set()
  const output = []
  for (const source of [...(Array.isArray(existing) ? existing : []), ...additions]) {
    const key = `${source.source}|${source.source_id}`
    if (seen.has(key)) continue
    seen.add(key)
    output.push(source)
  }
  return output
}

function mergeLiteLlmParameters(existing, rawId, row) {
  const current = isRecord(existing) ? existing : {}
  const currentRawId = typeof current.raw_id === 'string' ? current.raw_id : ''
  const currentObservation = currentRawId ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'observations')) : null
  const observations = [...(currentObservation ? [currentObservation] : []), ...(Array.isArray(current.observations) ? current.observations : [])]
  const next = litellmParameters(rawId, row)
  const merged = []
  const seen = new Set()
  for (const entry of observations) {
    if (!isRecord(entry) || typeof entry.raw_id !== 'string') continue
    const key = JSON.stringify(stableJsonValue(entry))
    if (seen.has(key)) continue
    seen.add(key)
    if (entry.raw_id !== rawId) merged.push(entry)
  }
  merged.push(next)
  return {
    ...next,
    ...(merged.length > 1 ? { observations: merged } : {}),
  }
}

function litellmParameters(rawId, row) {
  const params = {
    mode: row.mode,
    provider: row.litellm_provider,
    raw_id: rawId,
  }
  for (const key of ['deprecation_date', 'output_vector_size', 'max_query_tokens', 'max_document_chunks_per_query', 'max_tokens_per_document_chunk', 'supported_endpoints', 'supported_modalities', 'supported_output_modalities', 'rpm', 'tpm']) {
    if (row[key] !== undefined) params[key] = row[key]
  }
  const prices = litellmPriceRows(row)
  if (prices.length > 0) params.prices = prices
  return params
}

function litellmPriceRows(row) {
  const specs = [
    ['input_cost_per_token', 'input', 'per_1m_tokens', 1_000_000],
    ['output_cost_per_token', 'output', 'per_1m_tokens', 1_000_000],
    ['input_cost_per_query', 'input', 'per_query', 1],
    ['input_cost_per_request', 'input', 'per_request', 1],
    ['input_cost_per_second', 'input', 'per_second', 1],
    ['output_cost_per_second', 'output', 'per_second', 1],
    ['input_cost_per_audio_token', 'input_audio', 'per_1m_audio_tokens', 1_000_000],
    ['output_cost_per_audio_token', 'output_audio', 'per_1m_audio_tokens', 1_000_000],
    ['input_cost_per_image', 'input_image', 'per_image', 1],
    ['output_cost_per_image', 'output_image', 'per_image', 1],
    ['input_cost_per_audio_per_second', 'input_audio', 'per_audio_second', 1],
    ['input_cost_per_video_per_second', 'input_video', 'per_video_second', 1],
    ['output_cost_per_video_per_second', 'output_video', 'per_video_second', 1],
    ['cache_read_input_token_cost', 'cache_read', 'per_1m_tokens', 1_000_000],
    ['cache_creation_input_token_cost', 'cache_write', 'per_1m_tokens', 1_000_000],
  ]
  return specs.flatMap(([key, kind, unit, multiplier]) => {
    const amount = row[key]
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return []
    return [{ kind, amount: normalizedPriceAmount(amount * multiplier), unit, source_key: key }]
  })
}

function normalizedPriceAmount(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000_000_000) / 1_000_000_000_000
}

function applyLiteLlmDeprecationDate(model, row) {
  if (typeof row.deprecation_date === 'string' && row.deprecation_date.trim() !== '') model.deprecation_date = row.deprecation_date.trim()
}

function enrichExisting(model, rawId, row, observedAt) {
  model.alias = uniqueStrings([...(Array.isArray(model.alias) ? model.alias : []), rawId])
  model.sources = mergeSources(model.sources, [sourceObservation(rawId, observedAt)])
  const modalities = modalitiesForMode(row.mode, row)
  if (isLiteLlmManagedModel(model)) {
    model.input_modalities = modalities.input
    model.output_modalities = modalities.output
    delete model.last_updated
  }
  model.other_parameters = {
    ...(model.other_parameters && typeof model.other_parameters === 'object' && !Array.isArray(model.other_parameters) ? model.other_parameters : {}),
    litellm: mergeLiteLlmParameters(model.other_parameters?.litellm, rawId, row),
  }
  applyLiteLlmDeprecationDate(model, row)
}

function isLiteLlmManagedModel(model) {
  const sources = Array.isArray(model.sources) ? model.sources : []
  return sources.length > 0 && sources.every((source) => source?.source === 'litellm')
}

function createModel(rawId, row, observedAt) {
  const id = canonicalIdFromRaw(rawId, row)
  const modalities = modalitiesForMode(row.mode, row)
  const model = {
    id,
    model: displayNameFromId(id),
    alias: [rawId],
    author: authorFromRow(rawId, row),
    input_modalities: modalities.input,
    output_modalities: modalities.output,
    ...(typeof row.max_input_tokens === 'number' ? { context_length: row.max_input_tokens } : typeof row.max_tokens === 'number' ? { context_length: row.max_tokens } : {}),
    ...(typeof row.max_output_tokens === 'number' ? { max_output_tokens: row.max_output_tokens } : {}),
    other_parameters: {
      litellm: litellmParameters(rawId, row),
    },
    sources: [sourceObservation(rawId, observedAt)],
  }
  applyLiteLlmDeprecationDate(model, row)
  return model
}

function sourceRows(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('LiteLLM source must be an object')
  const payload = source.data && typeof source.data === 'object' && !Array.isArray(source.data) ? source.data : source
  return Object.entries(payload).filter(([rawId, row]) => rawId !== 'sample_spec' && row && typeof row === 'object')
}

export function populateLiteLlmModels({ modelsPath = join(process.cwd(), 'data', 'models.json'), source, observedAt = new Date().toISOString() } = {}) {
  const payload = readJson(modelsPath)
  const models = Array.isArray(payload.models) ? payload.models : []
  const stats = { added: 0, enriched: 0, skipped: 0 }
  let index = buildCanonicalIndex(models)
  for (const [rawId, row] of sourceRows(source)) {
    if (!CANONICAL_MODES.has(row.mode) || String(rawId).toLowerCase().includes(':free')) {
      stats.skipped += 1
      continue
    }
    const id = canonicalIdFromRaw(rawId, row)
    if (!id || /(^|[-.])(latest|auto|router|route)([-.]|$)/u.test(id)) {
      stats.skipped += 1
      continue
    }
    const existing = matchExisting(rawId, models, index)
    if (existing) {
      enrichExisting(existing, rawId, row, observedAt)
      stats.enriched += 1
      continue
    }
    const model = createModel(rawId, row, observedAt)
    models.push(model)
    index = buildCanonicalIndex(models)
    stats.added += 1
  }
  const output = { ...payload, models }
  writeJsonIfChanged(modelsPath, output)
  return stats
}

export function loadLiteLlmSource(path = join(process.cwd(), '.internal', 'source-data', 'litellm-model-prices.raw.json')) {
  return readJson(path)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sourcePath = process.env.LITELLM_SOURCE ?? join(process.cwd(), '.internal', 'source-data', 'litellm-model-prices.raw.json')
  const modelsPath = process.env.LITELLM_MODELS_PATH ?? join(process.cwd(), 'data', 'models.json')
  const source = loadLiteLlmSource(sourcePath)
  const result = populateLiteLlmModels({ modelsPath, source })
  console.log(`litellm models: added=${result.added} enriched=${result.enriched} skipped=${result.skipped}`)
}
