// Orchestration CLI for the rewritten normalizer (see ../../../normalizer-spec.md §2, §8).
// fetch-raw -> per-source adapters -> field-level merge (+overrides) -> deterministic output.
//
// Usage:
//   node dist/scripts/build-models.js \
//     --sources=<assembled dir, e.g. sources/assembled> \
//     [--overrides=<overrides.json>] \
//     [--out=.internal/normalize/models.json]
//
// Defaults to a NON-destructive output path; it never clobbers the live data/models.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { openRouterFragment, type OpenRouterModel } from '../lib/normalize/adapters/openrouter.js'
import { bailianFragment, type BailianModel } from '../lib/normalize/adapters/bailian.js'
import { modelsDevFragment, type ModelsDevRecord } from '../lib/normalize/adapters/models-dev.js'
import { liteLLMFragment, type LiteLLMModel } from '../lib/normalize/adapters/litellm.js'
import { volcengineFragments, type VolcengineModel } from '../lib/normalize/adapters/volcengine.js'
import { buildProvenanceIndex, mergeFragments } from '../lib/normalize/merge.js'
import { checkOverrideStaleness, overrideFragment, type OverrideRecord } from '../lib/normalize/overrides.js'
import { validateModels } from '../lib/normalize/validate.js'
import type { ModelEntry, SourceFragment } from '../lib/normalize/schema.js'

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Recursively collect objects that match a signature predicate (for nested raw dumps). */
function collect(root: unknown, match: (o: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item)
    } else if (isRecord(node)) {
      if (match(node)) out.push(node)
      for (const value of Object.values(node)) visit(value)
    }
  }
  visit(root)
  return out
}

function loadOpenRouter(dir: string): SourceFragment[] {
  const path = join(dir, 'openrouter.json')
  if (!existsSync(path)) return []
  const payload = readJson<{ data?: OpenRouterModel[] }>(path)
  return (payload.data ?? []).filter((m) => m?.id).map((m) => openRouterFragment(m))
}

function loadBailian(dir: string): SourceFragment[] {
  const path = join(dir, 'bailian.json')
  if (!existsSync(path)) return []
  const records = collect(readJson(path), (o) => 'model_id' in o && 'tiered_pricing' in o)
  return records
    .map((r) => bailianFragment(r as unknown as BailianModel))
    .filter((f): f is SourceFragment => f !== null)
}

function loadModelsDev(dir: string): SourceFragment[] {
  const path = join(dir, 'models-dev.json')
  if (!existsSync(path)) return []
  const providers = readJson<Record<string, { models?: Record<string, ModelsDevRecord> }>>(path)
  const byId = new Map<string, ModelsDevRecord[]>()
  for (const [providerId, provider] of Object.entries(providers)) {
    if (!isRecord(provider) || !isRecord(provider.models)) continue
    for (const [modelId, record] of Object.entries(provider.models)) {
      const enriched: ModelsDevRecord = { ...record, id: record.id ?? modelId, provider: providerId }
      const bucket = byId.get(enriched.id)
      if (bucket) bucket.push(enriched)
      else byId.set(enriched.id, [enriched])
    }
  }
  return [...byId.values()]
    .map((records) => modelsDevFragment(records))
    .filter((f): f is SourceFragment => f !== null)
}

function loadLiteLLM(dir: string): SourceFragment[] {
  const path = join(dir, 'litellm.json')
  if (!existsSync(path)) return []
  const payload = readJson<{ data?: Record<string, Record<string, unknown>> }>(path)
  const data = payload.data ?? {}
  const fragments: SourceFragment[] = []
  for (const [name, record] of Object.entries(data)) {
    if (!isRecord(record) || !('mode' in record)) continue
    fragments.push(liteLLMFragment({ model_name: name, ...record } as LiteLLMModel))
  }
  return fragments
}

function loadVolcengine(dir: string): SourceFragment[] {
  const path = join(dir, 'volcengine.json')
  if (!existsSync(path)) return []
  const payload = readJson<{ models?: VolcengineModel[] }>(path)
  return volcengineFragments(payload.models ?? [])
}

function main(): void {
  const sources = arg('sources')
  if (!sources) {
    console.error('build-models: --sources=<dir> is required (assembled dir, e.g. sources/assembled)')
    process.exit(2)
  }
  const out = arg('out', join(process.cwd(), '.internal', 'normalize', 'models.json'))!
  const overridesPath = arg('overrides')
  const now = new Date().toISOString()

  const bySource = {
    openrouter: loadOpenRouter(sources),
    bailian: loadBailian(sources),
    'models-dev': loadModelsDev(sources),
    litellm: loadLiteLLM(sources),
    volcengine: loadVolcengine(sources),
  }
  const sourceFragments = Object.values(bySource).flat()

  const overrides: OverrideRecord[] = overridesPath && existsSync(overridesPath) ? readJson(overridesPath) : []
  const overrideFrags = overrides.map(overrideFragment)

  const autoEntries = mergeFragments(sourceFragments, { now })
  const finalEntries = mergeFragments([...sourceFragments, ...overrideFrags], { now })
  const autoById = new Map(autoEntries.map((e) => [e.id, e]))
  const staleness = checkOverrideStaleness(overrides, autoById)

  const validation = validateModels(finalEntries)

  // Clean models.json: facts + offers + other_parameters only. No embedded provenance.
  const output = { schema_version: 2, generated_at: now, count: finalEntries.length, models: finalEntries }
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, `${JSON.stringify(output, null, 2)}\n`)

  // Source tracking lives in a SEPARATE sidecar, never in the published models.json.
  const provenancePath = out.replace(/\.json$/u, '.provenance.json')
  const provenance = buildProvenanceIndex(sourceFragments)
  writeFileSync(provenancePath, `${JSON.stringify({ generated_at: now, sources: provenance }, null, 2)}\n`)

  const withOffers = finalEntries.filter((e: ModelEntry) => e.offers.length > 0).length
  console.log('build-models: wrote', out, '+', provenancePath)
  console.log('  fragments:', Object.entries(bySource).map(([s, f]) => `${s}=${f.length}`).join(' '))
  console.log('  canonical models:', finalEntries.length, '| with offers:', withOffers)
  console.log('  overrides:', overrides.length, '| stale audits:', staleness.length)
  for (const audit of staleness.filter((a) => a.status !== 'active')) {
    console.log(`  override ${audit.status}: ${audit.id}.${audit.field}`)
  }
  console.log('  validation:', validation.ok ? 'ok' : `${validation.errors.length} errors`)
  for (const error of validation.errors.slice(0, 20)) console.log('   -', error)
  if (!validation.ok && process.argv.includes('--strict')) process.exit(1)
}

main()
