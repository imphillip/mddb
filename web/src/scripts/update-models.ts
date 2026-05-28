// Daily-update APPLY step. Merges the normalized candidate into the published
// data/models.json: new + changed models replace, disappeared models are kept and
// marked `delisted` (not deleted). Guardrail aborts (exit 1, no write) if too many
// models would be newly delisted in one run — that signals a source outage, not
// genuine delistings.
//
// Usage:
//   node dist/scripts/update-models.js \
//     [--candidate=.internal/update/models.next.json] [--out=data/models.json] \
//     [--max-newly-deprecated-pct=5] [--today=YYYY-MM-DD] [--dry-run]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mergeWithDeprecations } from '../lib/normalize/update.js'
import type { ModelEntry } from '../lib/normalize/schema.js'

const root = process.cwd()
const candidatePath = arg('candidate') ?? join(root, '.internal', 'update', 'models.next.json')
const outPath = arg('out') ?? join(root, 'data', 'models.json')
const maxNewlyDeprecatedPct = Number(arg('max-newly-deprecated-pct') ?? '5')
const today = arg('today') ?? new Date().toISOString().slice(0, 10)
const dryRun = process.argv.includes('--dry-run')

const current = readModels(outPath)
const candidate = readModels(candidatePath)
const result = mergeWithDeprecations(current, candidate, { today })

const newlyPct = current.length ? (result.newlyDeprecated.length / current.length) * 100 : 0
const tripped = newlyPct > maxNewlyDeprecatedPct

const activeCount = result.models.filter((m) => !m.deprecation).length
console.log(`update-models: current ${current.length} → merged ${result.models.length} (${activeCount} active, ${result.models.length - activeCount} delisted)`)
console.log(`  +newly delisted ${result.newlyDeprecated.length} (${round(newlyPct)}%)  reactivated ${result.reactivated.length}  still delisted ${result.stillDeprecated.length}`)
if (result.newlyDeprecated.length) console.log(`  newly delisted: ${result.newlyDeprecated.slice(0, 40).join(', ')}`)
if (result.reactivated.length) console.log(`  reactivated: ${result.reactivated.slice(0, 40).join(', ')}`)

if (tripped) {
  console.error(`update-models: GUARDRAIL TRIPPED — ${round(newlyPct)}% > ${maxNewlyDeprecatedPct}% newly delisted in one run. Likely a source outage; NOT writing ${rel(outPath)}.`)
  process.exit(1)
}
if (dryRun) {
  console.log(`update-models: --dry-run, not writing ${rel(outPath)}`)
  process.exit(0)
}

const output = { schema_version: 2, generated_at: new Date().toISOString(), count: result.models.length, models: result.models }
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`update-models: wrote ${rel(outPath)}`)

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
function rel(p: string): string {
  return p.startsWith(root) ? p.slice(root.length + 1) : p
}
function round(n: number): number {
  return Math.round(n * 100) / 100
}
function readModels(path: string): ModelEntry[] {
  if (!existsSync(path)) {
    console.error(`update-models: file not found: ${path}`)
    process.exit(2)
  }
  const payload = JSON.parse(readFileSync(path, 'utf8')) as { models?: ModelEntry[] }
  const models = Array.isArray(payload.models) ? payload.models : []
  if (models.length === 0) {
    console.error(`update-models: ${path} has 0 models — refusing (looks broken)`)
    process.exit(2)
  }
  return models
}
