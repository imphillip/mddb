#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai'
const MODELS_URL = process.env.OPENROUTER_MODELS_URL ?? `${OPENROUTER_BASE_URL}/api/v1/models`
const SITEMAP_URL = process.env.OPENROUTER_SITEMAP_URL ?? `${OPENROUTER_BASE_URL}/sitemap.xml`
const USER_AGENT = process.env.OPENROUTER_USER_AGENT ?? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36 mddb.dev-data-refresh'
const FETCH_ENDPOINTS = process.env.OPENROUTER_FETCH_ENDPOINTS !== '0'
const FETCH_PAGES = process.env.OPENROUTER_FETCH_PAGES !== '0'
const ENDPOINT_CONCURRENCY = Number.parseInt(process.env.OPENROUTER_ENDPOINT_CONCURRENCY ?? '6', 10)
const PAGE_CONCURRENCY = Number.parseInt(process.env.OPENROUTER_PAGE_CONCURRENCY ?? '4', 10)

const NON_MODEL_NAMESPACES = new Set([
  'about',
  'activity',
  'announcements',
  'apps',
  'chat',
  'collections',
  'contact',
  'credits',
  'customers',
  'docs',
  'models',
  'privacy',
  'provider',
  'rankings',
  'settings',
  'terms',
  'works-with-openrouter',
])


const MODEL_PAGE_KEYS = [
  'displayName',
  'author',
  'isLatestAlias',
  'tildeLatestSlug',
  'aliasTarget',
  'description',
  'model_version_group_id',
  'context_length',
  'input_modalities',
  'output_modalities',
  'has_text_output',
  'group',
  'instruct_type',
  'default_system',
  'default_stops',
  'hidden',
  'router',
  'warning_message',
  'promotion_message',
  'routing_error_message',
  'is_private',
  'permaslug',
  'supports_reasoning',
  'reasoning_config',
  'features',
  'default_parameters',
  'default_order',
  'quick_start_example_type',
  'is_trainable_text',
  'is_trainable_image',
  'knowledge_cutoff',
  'limit_rpm',
  'limit_rpd',
  'supported_tts_voices',
  'endpoint',
  'provider_display_name',
  'provider_slug',
  'provider_model_id',
  'quantization',
  'variant',
  'is_free',
  'can_abort',
  'max_prompt_tokens',
  'max_completion_tokens',
  'max_tokens_per_image',
  'supported_parameters',
  'is_byok',
  'moderation_required',
  'data_policy',
  'pricing',
  'display_pricing',
  'pricing_json',
  'pricing_version_id',
  'is_hidden',
  'is_deranked',
  'is_disabled',
]

const paths = {
  models: process.argv[2] ?? join(process.cwd(), 'data', 'openrouter-models.json'),
  endpoints: process.env.OPENROUTER_ENDPOINTS_TARGET ?? join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemap: process.env.OPENROUTER_SITEMAP_TARGET ?? join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
  pages: process.env.OPENROUTER_PAGES_TARGET ?? join(process.cwd(), 'data', 'openrouter-model-pages.json'),
}

const jsonHeaders = { Accept: 'application/json', 'User-Agent': USER_AGENT }
const htmlHeaders = { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT }
if (process.env.OPENROUTER_API_KEY) jsonHeaders.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`

const fetchedAt = new Date().toISOString()

const modelPayload = await fetchJson(MODELS_URL)
if (!modelPayload || !Array.isArray(modelPayload.data)) {
  throw new Error('OpenRouter model fetch returned an unsupported payload shape')
}
writeJson(paths.models, modelPayload)
console.log(`Wrote ${modelPayload.data.length} OpenRouter model rows to ${paths.models}`)

const sitemap = await fetchSitemapModelIndex(SITEMAP_URL, new Set(modelPayload.data.map((model) => model.id)))
writeJson(paths.sitemap, sitemap)
console.log(`Wrote ${sitemap.modelPages.length} sitemap model pages (${sitemap.pageOnly.length} page-only) to ${paths.sitemap}`)

if (FETCH_ENDPOINTS) {
  const endpointRows = await mapWithConcurrency(modelPayload.data, safeConcurrency(ENDPOINT_CONCURRENCY), async (model, index) => {
    const detailsPath = model?.links?.details || `/api/v1/models/${model.id}/endpoints`
    const detailsUrl = new URL(detailsPath, OPENROUTER_BASE_URL).toString()
    try {
      const response = await fetchJson(detailsUrl)
      const endpoints = Array.isArray(response?.data?.endpoints) ? response.data.endpoints : []
      logEvery('Fetched endpoint details', index, modelPayload.data.length, 25)
      return {
        modelId: model.id,
        canonicalSlug: model.canonical_slug ?? null,
        detailsPath,
        detailsUrl,
        endpointCount: endpoints.length,
        response,
      }
    } catch (error) {
      return {
        modelId: model.id,
        canonicalSlug: model.canonical_slug ?? null,
        detailsPath,
        detailsUrl,
        endpointCount: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const endpointPayload = {
    fetchedAt,
    source: {
      baseUrl: OPENROUTER_BASE_URL,
      modelsUrl: MODELS_URL,
      endpointRows: endpointRows.length,
      failedRows: endpointRows.filter((row) => row.error).length,
    },
    data: endpointRows,
  }
  writeJson(paths.endpoints, endpointPayload)
  console.log(`Wrote endpoint details for ${endpointRows.length} OpenRouter models (${endpointPayload.source.failedRows} failed) to ${paths.endpoints}`)
} else {
  console.log('Skipped endpoint detail fetch because OPENROUTER_FETCH_ENDPOINTS=0')
}

if (FETCH_PAGES) {
  const pages = await mapWithConcurrency(sitemap.modelPages, safeConcurrency(PAGE_CONCURRENCY), async (page, index) => {
    try {
      const html = await fetchHtml(page.url)
      logEvery('Fetched model pages', index, sitemap.modelPages.length, 25)
      return {
        id: page.id,
        provider: 'openrouter',
        modelId: page.id,
        route: `/models/openrouter/${encodeURIComponent(page.id)}`,
        sourceUrl: page.url,
        htmlLength: html.length,
        extracted: extractNextFlightData(html),
      }
    } catch (error) {
      return {
        id: page.id,
        provider: 'openrouter',
        modelId: page.id,
        route: `/models/openrouter/${encodeURIComponent(page.id)}`,
        sourceUrl: page.url,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
  const pagePayload = {
    fetchedAt,
    source: {
      baseUrl: OPENROUTER_BASE_URL,
      sitemapUrl: SITEMAP_URL,
      pages: pages.length,
      failedRows: pages.filter((row) => row.error).length,
    },
    data: pages,
  }
  writeJson(paths.pages, pagePayload)
  console.log(`Wrote extracted page data for ${pages.length} OpenRouter model pages (${pagePayload.source.failedRows} failed) to ${paths.pages}`)
} else {
  console.log('Skipped model page fetch because OPENROUTER_FETCH_PAGES=0')
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: jsonHeaders })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenRouter fetch failed: ${response.status} ${response.statusText} ${url}${body ? `\n${body.slice(0, 500)}` : ''}`)
  }
  return response.json()
}

async function fetchText(url, accept = 'text/plain') {
  const response = await fetch(url, { headers: { ...htmlHeaders, Accept: accept } })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenRouter fetch failed: ${response.status} ${response.statusText} ${url}${body ? `\n${body.slice(0, 500)}` : ''}`)
  }
  return response.text()
}

async function fetchHtml(url) {
  return fetchText(url, 'text/html,application/xhtml+xml')
}

async function fetchSitemapModelIndex(url, apiIds) {
  const xml = await fetchText(url, 'application/xml,text/xml;q=0.9,*/*;q=0.8')
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gu), (match) => decodeXml(match[1]))
  const modelPages = locs
    .map((loc) => modelPageFromUrl(loc))
    .filter((entry) => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
  const sitemapIds = new Set(modelPages.map((entry) => entry.id))
  const pageOnly = modelPages
    .filter((entry) => !apiIds.has(entry.id))
    .map((entry) => ({ ...entry, inferredType: inferPageOnlyType(entry.id) }))
  const apiOnly = Array.from(apiIds)
    .filter((id) => !sitemapIds.has(id))
    .sort((a, b) => a.localeCompare(b))

  return {
    fetchedAt,
    source: { sitemapUrl: url, modelPages: modelPages.length, apiRows: apiIds.size, pageOnly: pageOnly.length, apiOnly: apiOnly.length },
    modelPages,
    pageOnly,
    apiOnly,
  }
}

function modelPageFromUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.hostname !== 'openrouter.ai') return null
  const parts = url.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))
  if (parts.length !== 2) return null
  const [namespace, modelId] = parts
  if (!namespace || !modelId || NON_MODEL_NAMESPACES.has(namespace)) return null
  return { id: `${namespace}/${modelId}`, namespace, modelId, url: url.toString() }
}

function extractNextFlightData(html) {
  const decodedChunks = []
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)<\/script>/gu)) {
    decodedChunks.push(decodeJsStringLiteral(match[1]))
  }
  const text = decodedChunks.join('\n')
  const raw = {}
  for (const key of MODEL_PAGE_KEYS) {
    const value = extractJsonValueAfterKey(text, key)
    if (value.found) raw[key] = value.value
  }
  const endpoint = extractObjectContainingKey(text, 'provider_model_id')
  const model = extractObjectContainingKey(text, 'permaslug')
  return {
    raw,
    model,
    endpoint,
    nextFlightTextLength: text.length,
    extractedKeys: Object.keys(raw).sort(),
  }
}

function decodeJsStringLiteral(value) {
  try {
    return JSON.parse(`"${value}"`)
  } catch {
    return value
      .replace(/\\n/gu, '\n')
      .replace(/\\"/gu, '"')
      .replace(/\\\\/gu, '\\')
  }
}

function extractJsonValueAfterKey(text, key) {
  const marker = `"${key}":`
  const start = text.indexOf(marker)
  if (start === -1) return { found: false, value: null }
  const valueStart = start + marker.length
  const parsed = parseJsonValuePrefix(text.slice(valueStart))
  if (!parsed.ok) return { found: false, value: null }
  return { found: true, value: parsed.value }
}

function extractObjectContainingKey(text, key) {
  const marker = `"${key}":`
  const keyIndex = text.indexOf(marker)
  if (keyIndex === -1) return null
  for (let start = keyIndex; start >= 0; start -= 1) {
    if (text[start] !== '{') continue
    const parsed = parseJsonValuePrefix(text.slice(start))
    if (parsed.ok && parsed.type === 'object' && Object.prototype.hasOwnProperty.call(parsed.value, key)) return parsed.value
  }
  return null
}

function parseJsonValuePrefix(text) {
  const trimmed = text.trimStart()
  const offset = text.length - trimmed.length
  const first = trimmed[0]
  if (first === '{' || first === '[') {
    const end = findBalancedEnd(trimmed)
    if (end === -1) return { ok: false }
    try {
      const value = JSON.parse(trimmed.slice(0, end + 1))
      return { ok: true, value, type: Array.isArray(value) ? 'array' : 'object', end: offset + end + 1 }
    } catch {
      return { ok: false }
    }
  }
  if (first === '"') {
    const end = findStringEnd(trimmed, 0)
    if (end === -1) return { ok: false }
    try {
      return { ok: true, value: JSON.parse(trimmed.slice(0, end + 1)), type: 'string', end: offset + end + 1 }
    } catch {
      return { ok: false }
    }
  }
  const primitive = trimmed.match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/u)?.[1]
  if (!primitive) return { ok: false }
  return { ok: true, value: JSON.parse(primitive), type: 'primitive', end: offset + primitive.length }
}

function findBalancedEnd(text) {
  const stack = []
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{' || char === '[') stack.push(char)
    else if (char === '}' || char === ']') {
      const open = stack.pop()
      if ((char === '}' && open !== '{') || (char === ']' && open !== '[')) return -1
      if (stack.length === 0) return i
    }
  }
  return -1
}

function findStringEnd(text, start) {
  let escaped = false
  for (let i = start + 1; i < text.length; i += 1) {
    const char = text[i]
    if (escaped) escaped = false
    else if (char === '\\') escaped = true
    else if (char === '"') return i
  }
  return -1
}

function inferPageOnlyType(id) {
  const value = id.toLowerCase()
  if (value.startsWith('spawn/')) return 'agent_or_app'
  if (value.includes(':free') || value.endsWith('/free')) return 'free_or_promotional'
  if (/(embed|embedding|bge-|e5-|gte-|minilm|jina-embeddings)/u.test(value)) return 'embedding'
  if (/(rerank|reranker)/u.test(value)) return 'rerank'
  if (/(whisper|transcribe|transcription|tts|speech|voice|chirp|kokoro|orpheus|zonos|voxtral)/u.test(value)) return 'audio_or_speech'
  if (/(sora|veo|kling|hailuo|seedance|wan-|video|ray-|runway)/u.test(value)) return 'video'
  if (/(flux|recraft|imagen|seedream|image|sdxl|stable-diffusion|dall-e)/u.test(value)) return 'image'
  return 'unknown_page_only'
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function logEvery(prefix, index, total, interval) {
  if ((index + 1) % interval === 0 || index + 1 === total) {
    console.log(`${prefix} ${index + 1}/${total}`)
  }
}

function safeConcurrency(value) {
  return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), 16) : 6
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`)
}

function decodeXml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
}
