#!/usr/bin/env node
// Coverage diff: normalized output (new schema) vs the live data/models.json (old schema).
// Compares on a separator-insensitive key because the new schema preserves dots
// (qwen3.6-...) while the old schema hyphenates them (qwen3-6-...).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const normalizedPath = arg('normalized', join(root, '.internal', 'normalize', 'models.json'))
const livePath = arg('live', join(root, 'data', 'models.json'))

const key = (id) => String(id).toLowerCase().replace(/[._\-/]+/gu, '')
const readModels = (path) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).models ?? [] : null)

const normalized = readModels(normalizedPath)
const live = readModels(livePath)
if (!normalized) {
  console.error(`normalize-coverage: normalized file not found: ${normalizedPath}`)
  process.exit(2)
}

const normKeys = new Map(normalized.map((m) => [key(m.id), m]))
const liveKeys = live ? new Map(live.map((m) => [key(m.id), m])) : new Map()

const overlap = [...normKeys.keys()].filter((k) => liveKeys.has(k))
const newModels = [...normKeys.values()].filter((m) => !liveKeys.has(key(m.id)))
const dropped = live ? [...liveKeys.values()].filter((m) => !normKeys.has(key(m.id))) : []

const has = (m, pred) => (pred(m) ? 1 : 0)
const cov = normalized.reduce(
  (acc, m) => {
    acc.offers += has(m, (x) => (x.offers ?? []).length > 0)
    acc.anyPrice += has(m, (x) => (x.offers ?? []).some((o) => (o.prices ?? []).length > 0))
    acc.release += has(m, (x) => x.release_timestamp != null)
    acc.context += has(m, (x) => x.context_length != null)
    acc.knowledge += has(m, (x) => x.knowledge_cutoff != null)
    acc.maxInput += has(m, (x) => x.max_input_tokens != null)
    return acc
  },
  { offers: 0, anyPrice: 0, release: 0, context: 0, knowledge: 0, maxInput: 0 },
)

const pct = (n) => `${((n / normalized.length) * 100).toFixed(1)}%`
console.log('normalize-coverage')
console.log(`  normalized models: ${normalized.length}`)
console.log(`  live models:       ${live ? live.length : '(missing)'}`)
console.log(`  overlap:           ${overlap.length}`)
console.log(`  new (not in live): ${newModels.length}`)
console.log(`  dropped (live only): ${dropped.length}`)
console.log('  field coverage (of normalized):')
console.log(`    with offers:        ${cov.offers} (${pct(cov.offers)})`)
console.log(`    with any price:     ${cov.anyPrice} (${pct(cov.anyPrice)})`)
console.log(`    with release date:  ${cov.release} (${pct(cov.release)})`)
console.log(`    with context len:   ${cov.context} (${pct(cov.context)})`)
console.log(`    with knowledge cut: ${cov.knowledge} (${pct(cov.knowledge)})`)
console.log(`    with max input:     ${cov.maxInput} (${pct(cov.maxInput)})`)
console.log('  sample new models:', newModels.slice(0, 8).map((m) => m.id).join(', '))
if (dropped.length) console.log('  sample dropped:', dropped.slice(0, 8).map((m) => m.id).join(', '))
