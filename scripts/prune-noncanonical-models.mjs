import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const ROOT = process.cwd()
const MODELS_PATH = process.env.MDDB_MODELS_PATH ?? join(ROOT, 'data', 'models.json')

const providerRoutePatterns = [
  /^(?:amazon|cohere)\..*:0$/u,
  /^(?:eu\.|us\.)?twelvelabs\..*:0$/u,
  /^azure-tts/u,
]

const movingOrServiceRoutePatterns = [
  /-latest$/u,
  /(?:^|-)realtime(?:$|-)/u,
  /(?:^|-)filetrans(?:$|-)/u,
  /(?:^|-)livetranslate(?:$|-)/u,
  /(?:^|-)vc-realtime(?:$|-)/u,
  /(?:^|-)vd-realtime(?:$|-)/u,
]

export function canonicalRegistryRejectReason(model) {
  const id = String(model?.id ?? '').trim().toLowerCase()
  if (!id) return 'missing-id'
  if (providerRoutePatterns.some((pattern) => pattern.test(id))) return 'provider-routed-alias'
  if (movingOrServiceRoutePatterns.some((pattern) => pattern.test(id))) return 'moving-or-service-route'
  return ''
}

export function removeNonCanonicalRegistryRows(models) {
  const kept = []
  const removed = []
  for (const model of Array.isArray(models) ? models : []) {
    const reason = canonicalRegistryRejectReason(model)
    if (reason) removed.push({ id: model?.id, reason })
    else kept.push(model)
  }
  return { kept, removed }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function pruneModelsJson({ modelsPath = MODELS_PATH, apply = false } = {}) {
  if (!existsSync(modelsPath)) throw new Error(`models.json not found: ${modelsPath}`)
  const payload = readJson(modelsPath)
  const { kept, removed } = removeNonCanonicalRegistryRows(payload.models)
  const next = { ...payload, models: kept }
  if (apply && removed.length > 0) writeJson(modelsPath, next)
  return {
    apply,
    before: Array.isArray(payload.models) ? payload.models.length : 0,
    after: kept.length,
    removed: removed.length,
    removed_by_reason: removed.reduce((counts, row) => {
      counts[row.reason] = (counts[row.reason] ?? 0) + 1
      return counts
    }, {}),
    sample_removed: removed.slice(0, 80),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply')
  console.log(JSON.stringify(pruneModelsJson({ apply }), null, 2))
}
