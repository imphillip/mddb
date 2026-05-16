#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai'
const MODELS_URL = process.env.OPENROUTER_MODELS_URL ?? `${OPENROUTER_BASE_URL}/api/v1/models`
const SITEMAP_URL = process.env.OPENROUTER_SITEMAP_URL ?? `${OPENROUTER_BASE_URL}/sitemap.xml`
const USER_AGENT = process.env.OPENROUTER_USER_AGENT ?? 'mddb.dev data refresh (+https://mddb.dev)'
const FETCH_ENDPOINTS = process.env.OPENROUTER_FETCH_ENDPOINTS !== '0'
const ENDPOINT_CONCURRENCY = Number.parseInt(process.env.OPENROUTER_ENDPOINT_CONCURRENCY ?? '6', 10)

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

const paths = {
  models: process.argv[2] ?? join(process.cwd(), 'data', 'openrouter-models.json'),
  endpoints: process.env.OPENROUTER_ENDPOINTS_TARGET ?? join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemap: process.env.OPENROUTER_SITEMAP_TARGET ?? join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
}

const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT }
if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`

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
      if ((index + 1) % 25 === 0 || index + 1 === modelPayload.data.length) {
        console.log(`Fetched endpoint details ${index + 1}/${modelPayload.data.length}`)
      }
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

async function fetchJson(url) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenRouter fetch failed: ${response.status} ${response.statusText} ${url}${body ? `\n${body.slice(0, 500)}` : ''}`)
  }
  return response.json()
}

async function fetchText(url, accept = 'text/plain') {
  const response = await fetch(url, { headers: { ...headers, Accept: accept } })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`OpenRouter fetch failed: ${response.status} ${response.statusText} ${url}${body ? `\n${body.slice(0, 500)}` : ''}`)
  }
  return response.text()
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
