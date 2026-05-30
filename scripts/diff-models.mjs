#!/usr/bin/env node
// Daily-update change detector (read-only). Compares the current published models.json
// against a freshly-normalized candidate and reports what changed:
//   - added   : new canonical models
//   - removed : models gone from every source (possible delist/deprecation)
//   - changed : field-level fact changes + per-source offer/price changes
//
// It NEVER writes data/models.json. A guardrail flags suspicious mass-removals
// (usually a source outage, not real delistings) so a daily job can refuse to apply.
//
// Usage:
//   node scripts/diff-models.mjs \
//     [--current=data/models.json] [--candidate=.internal/update/models.next.json] \
//     [--report=.internal/update/change-report.json] [--max-removed-pct=5]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const currentPath = arg('current') ?? join(root, 'data', 'models.json')
const candidatePath = arg('candidate') ?? join(root, '.internal', 'update', 'models.next.json')
const reportPath = arg('report') ?? join(root, '.internal', 'update', 'change-report.json')
const maxRemovedPct = Number(arg('max-removed-pct') ?? '5')

const SCALAR_FACTS = ['model', 'author', 'context_length', 'max_input_tokens', 'max_output_tokens', 'reasoning', 'tool_calling', 'knowledge_cutoff', 'release_timestamp']
const ARRAY_FACTS = ['input_modalities', 'output_modalities', 'alias', 'alias_id']

const current = indexById(readModels(currentPath))
const candidate = indexById(readModels(candidatePath))

const addedIds = [...candidate.keys()].filter((id) => !current.has(id)).sort()
// A current id that a candidate now lists as an alias_id was folded (e.g. a dated snapshot
// into its base), not removed — exclude it from removals so the guardrail doesn't false-alarm.
const foldedAway = new Set([...candidate.values()].flatMap((m) => m.alias_id ?? []))
const foldedIds = [...current.keys()].filter((id) => !candidate.has(id) && foldedAway.has(id)).sort()
const removedIds = [...current.keys()].filter((id) => !candidate.has(id) && !foldedAway.has(id)).sort()
const changed = []
for (const [id, before] of current) {
  const after = candidate.get(id)
  if (!after) continue
  const diff = diffModel(before, after)
  if (diff.length) changed.push({ id, changes: diff })
}

const removedPct = current.size ? (removedIds.length / current.size) * 100 : 0
const guardrailTripped = removedPct > maxRemovedPct
const report = {
  generated_at: new Date().toISOString(),
  current: { path: rel(currentPath), count: current.size },
  candidate: { path: rel(candidatePath), count: candidate.size },
  summary: { added: addedIds.length, removed: removedIds.length, folded: foldedIds.length, changed: changed.length, removed_pct: round(removedPct) },
  guardrail: { max_removed_pct: maxRemovedPct, tripped: guardrailTripped },
  added: addedIds,
  removed: removedIds,
  folded: foldedIds,
  changed,
}
mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

printReport(report)
process.exit(guardrailTripped ? 1 : 0)

// ---------- helpers ----------
function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
function rel(p) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p
}
function round(n) {
  return Math.round(n * 100) / 100
}
function readModels(path) {
  if (!existsSync(path)) {
    console.error(`diff-models: file not found: ${path}`)
    process.exit(2)
  }
  const payload = JSON.parse(readFileSync(path, 'utf8'))
  const models = Array.isArray(payload.models) ? payload.models : []
  if (models.length === 0) {
    console.error(`diff-models: ${path} has 0 models — refusing to diff (looks broken)`)
    process.exit(2)
  }
  return models
}
function indexById(models) {
  return new Map(models.map((m) => [String(m.id), m]))
}
function diffModel(before, after) {
  const changes = []
  for (const key of SCALAR_FACTS) {
    if (norm(before[key]) !== norm(after[key])) changes.push({ field: key, from: before[key] ?? null, to: after[key] ?? null })
  }
  for (const key of ARRAY_FACTS) {
    const a = JSON.stringify(before[key] ?? [])
    const b = JSON.stringify(after[key] ?? [])
    if (a !== b) changes.push({ field: key, from: before[key] ?? [], to: after[key] ?? [] })
  }
  changes.push(...offerChanges(before, after))
  return changes
}
function norm(v) {
  return v === undefined || v === null ? '' : JSON.stringify(v)
}
function offerSig(model) {
  const sig = {}
  for (const offer of model.offers ?? []) {
    sig[offer.source] = {
      currency: offer.currency ?? null,
      prices: priceFingerprint(offer.prices),
      status: offer.other_params?.pricing_status ?? null,
    }
  }
  return sig
}
// Compact, order-stable fingerprint of EVERY price component across EVERY tier — so changes to
// non-token components (video / image_output / request / cache) and multi-tier / variant pricing
// are not missed (the old version only looked at input/output of the first tier).
function priceFingerprint(prices) {
  return (
    (prices ?? [])
      .map((p) => {
        const comps = Object.keys(p)
          .filter((k) => k !== 'conditions')
          .sort()
          .map((k) => `${k}=${p[k]?.amount}`)
          .join(',')
        const cond = (p.conditions ?? [])
          .map((c) => c.label ?? [c.type, c.gt, c.gte, c.lt, c.lte].filter((v) => v != null).join(''))
          .join('|')
        return cond ? `${cond}{${comps}}` : comps
      })
      .join(' ; ') || null
  )
}
function offerChanges(before, after) {
  const a = offerSig(before)
  const b = offerSig(after)
  const out = []
  for (const source of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!a[source]) out.push({ field: `offer:${source}`, change: 'added', to: b[source] })
    else if (!b[source]) out.push({ field: `offer:${source}`, change: 'removed', from: a[source] })
    else if (JSON.stringify(a[source]) !== JSON.stringify(b[source])) out.push({ field: `offer:${source}`, change: 'price', from: a[source], to: b[source] })
  }
  return out
}
function printReport(r) {
  const s = r.summary
  console.log(`\ndiff-models: current ${r.current.count} → candidate ${r.candidate.count}`)
  console.log(`  +${s.added} added   -${s.removed} removed   ⊙${s.folded} folded   ~${s.changed} changed   (removed ${s.removed_pct}%)`)
  console.log(`  guardrail max-removed ${r.guardrail.max_removed_pct}%: ${r.guardrail.tripped ? 'TRIPPED ⛔ (likely a source outage — do NOT apply)' : 'ok'}`)
  if (r.added.length) console.log(`\n  NEW (${r.added.length}): ${r.added.slice(0, 40).join(', ')}${r.added.length > 40 ? ' …' : ''}`)
  if (r.removed.length) console.log(`\n  REMOVED / possible delist (${r.removed.length}): ${r.removed.slice(0, 40).join(', ')}${r.removed.length > 40 ? ' …' : ''}`)
  if (r.changed.length) {
    console.log(`\n  CHANGED (${r.changed.length}), first 25:`)
    for (const c of r.changed.slice(0, 25)) {
      console.log(`   - ${c.id}: ${c.changes.map(fmtChange).join('; ')}`)
    }
  }
  console.log(`\n  full report: ${r.candidate.path ? rel(reportPath) : reportPath}`)
}
function fmtChange(c) {
  if (c.field.startsWith('offer:')) {
    const src = c.field.slice(6)
    if (c.change === 'added') return `+${src}`
    if (c.change === 'removed') return `-${src}`
    return `${src} price ${JSON.stringify(c.from)}→${JSON.stringify(c.to)}`
  }
  return `${c.field} ${JSON.stringify(c.from)}→${JSON.stringify(c.to)}`
}
