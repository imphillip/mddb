#!/usr/bin/env node
// Stage 1.5 — ASSEMBLE. For each data source, consolidate its (possibly multiple) raw
// files in sources/raw/ into exactly ONE per-source file in sources/assembled/.
// This gives every source a single, stable, diff-able view before the update-extraction
// and normalization steps. Single-file sources pass through; multi-file sources merge.
//
// Usage: node scripts/assemble-sources.mjs [--raw=sources/raw] [--out=sources/assembled]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const rawDir = arg('raw') ?? join(root, 'sources', 'raw')
const outDir = arg('out') ?? join(root, 'sources', 'assembled')
mkdirSync(outDir, { recursive: true })

const results = []
results.push(assembleOpenRouter())
results.push(assembleSingle('litellm', 'litellm-model-prices.raw.json'))
results.push(assembleSingle('models-dev', 'models-dev-api.raw.json'))
results.push(assembleSingle('bailian', 'bailian-model-market.json'))
results.push(assembleVolcengine())

for (const r of results) {
  if (r.skipped) console.log(`assemble: ${r.source.padEnd(11)} SKIP (${r.reason})`)
  else console.log(`assemble: ${r.source.padEnd(11)} ${r.parts} raw file(s) → ${rel(r.out)}`)
}

// ---- per-source assemblers ----

// OpenRouter emits several raw files (models, sitemap, endpoints, pages). The model
// list (.data) is the spine; sitemap/endpoints are folded in as siblings. Downstream
// reads `.data`, so that key is preserved verbatim.
function assembleOpenRouter() {
  const models = readRaw('openrouter-models.raw.json')
  if (!models) return skip('openrouter', 'no openrouter-models.raw.json')
  const sitemap = readRaw('openrouter-sitemap-models.raw.json')
  const endpoints = readRaw('openrouter-endpoints.raw.json')
  const pages = readRaw('openrouter-model-pages.raw.json')
  const parts = [models, sitemap, endpoints, pages].filter(Boolean).length
  return write('openrouter', {
    data: Array.isArray(models.data) ? models.data : [],
    sitemap: sitemap ?? null,
    endpoints: endpoints ?? null,
    pages: pages ?? null,
  }, parts)
}

// Volcengine: the markdown parser (scripts/parse-volcengine-markdown.mjs) already produces a
// structured sources/raw/volcengine/volcengine.json; pass it through.
function assembleVolcengine() {
  const structured = join(rawDir, 'volcengine', 'volcengine.json')
  if (!existsSync(structured)) return skip('volcengine', 'no volcengine.json (run parse-volcengine-markdown)')
  const payload = readJson(structured)
  const models = Array.isArray(payload.models) ? payload.models : []
  return write('volcengine', { models }, 1)
}

// Single-file source: pass the raw payload through unchanged under the canonical name.
function assembleSingle(source, rawName) {
  const payload = readRaw(rawName)
  if (!payload) return skip(source, `no ${rawName}`)
  return write(source, payload, 1)
}

// ---- helpers ----
function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
function rel(p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p
}
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
function readRaw(name) {
  const path = join(rawDir, name)
  return existsSync(path) ? readJson(path) : null
}
function write(source, body, parts) {
  const out = join(outDir, `${source}.json`)
  const payload = source === 'models-dev' || source === 'bailian' ? body : { source, ...body }
  writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`)
  return { source, out, parts }
}
function skip(source, reason) {
  return { source, skipped: true, reason }
}
