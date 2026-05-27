// Identity resolution + field-level fact merge + offer assembly
// (see ../../../../normalizer-spec.md §5). The core fix over the old script:
// facts are merged PER FIELD across sources — no single source is the skeleton.
import type { ModelEntry, ModelFacts, Offer, ProvenanceRecord, SourceFragment } from './schema.js'
import { isNonCanonicalId, uniq, uniqNames } from './primitives.js'

/** Who may supply the canonical id, best first. models.dev never appears. */
export const IDENTITY_PRECEDENCE = ['overrides', 'openrouter', 'bailian', 'volcengine', 'litellm']

/** Per-field fact precedence, best first. models.dev is whitelist-only (§4.5). */
export const FACT_PRECEDENCE = [
  'overrides',
  'openrouter',
  'bailian',
  'volcengine',
  'litellm',
  'models-dev',
]

export interface MergeOptions {
  now?: string
}

function rank(order: readonly string[], source: string): number {
  const index = order.indexOf(source)
  return index === -1 ? order.length : index
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null
}

/** Group fragments that describe the same model by their matchKey. */
export function groupFragments(fragments: readonly SourceFragment[]): Map<string, SourceFragment[]> {
  const groups = new Map<string, SourceFragment[]>()
  for (const fragment of fragments) {
    const bucket = groups.get(fragment.matchKey)
    if (bucket) bucket.push(fragment)
    else groups.set(fragment.matchKey, [fragment])
  }
  return groups
}

/** Resolve a group's canonical id by identity precedence; null if none or non-canonical. */
export function resolveCanonicalId(group: readonly SourceFragment[]): string | null {
  const byIdentity = [...group].sort((a, b) => rank(IDENTITY_PRECEDENCE, a.source) - rank(IDENTITY_PRECEDENCE, b.source))
  const identityFragment = byIdentity.find((f) => f.identityId !== null)
  if (!identityFragment || identityFragment.identityId === null) return null
  // Router/product/free/latest/group ids are never canonical models (prune, don't emit).
  if (isNonCanonicalId(identityFragment.identityId)) return null
  return identityFragment.identityId
}

/** Merge one model's fragments (same matchKey) into a canonical entry, or null if no identity. */
export function mergeGroup(group: readonly SourceFragment[], options: MergeOptions = {}): ModelEntry | null {
  const id = resolveCanonicalId(group)
  if (id === null) return null
  const byIdentity = [...group].sort((a, b) => rank(IDENTITY_PRECEDENCE, a.source) - rank(IDENTITY_PRECEDENCE, b.source))
  const byFact = [...group].sort((a, b) => rank(FACT_PRECEDENCE, a.source) - rank(FACT_PRECEDENCE, b.source))

  const pick = <K extends keyof ModelFacts>(key: K): NonNullable<ModelFacts[K]> | null => {
    for (const fragment of byFact) {
      const value = fragment.facts[key]
      if (isPresent(value)) return value as NonNullable<ModelFacts[K]>
    }
    return null
  }

  const entry: ModelEntry = {
    id,
    model: (pick('model') as string | null) ?? id,
    offers: dedupeOffers(byIdentity.filter((f) => f.offer !== null).map((f) => f.offer as Offer)),
    // nullable facts always surface (default null), matching the target sample
    context_length: pick('context_length') as number | null,
    max_input_tokens: pick('max_input_tokens') as number | null,
    max_output_tokens: pick('max_output_tokens') as number | null,
    release_timestamp: pick('release_timestamp') as number | null,
    knowledge_cutoff: pick('knowledge_cutoff') as number | string | null,
    last_updated: options.now ?? new Date().toISOString(),
  }

  const author = pick('author') as string | null
  if (author !== null) {
    entry.author = author
    entry.author_id = (pick('author_id') as string | null) ?? author
  }
  const reasoning = pick('reasoning') as boolean | null
  if (reasoning !== null) entry.reasoning = reasoning
  const toolCalling = pick('tool_calling') as boolean | null
  if (toolCalling !== null) entry.tool_calling = toolCalling
  const inMod = pick('input_modalities')
  if (inMod) entry.input_modalities = inMod
  const outMod = pick('output_modalities')
  if (outMod) entry.output_modalities = outMod

  const aliasIds = uniq(byIdentity.flatMap((f) => f.aliasIds)).filter((alias) => alias !== id)
  if (aliasIds.length) entry.alias_id = aliasIds
  // Keep upstream display names even when they equal the (possibly un-curated) model
  // name — they are naming provenance and must not blink in/out with name overrides.
  const aliasNames = uniqNames(byIdentity.flatMap((f) => f.aliasNames))
  if (aliasNames.length) entry.alias = aliasNames

  const otherParameters = mergeOtherParameters(byFact)
  if (otherParameters) entry.other_parameters = otherParameters

  return entry
}

/**
 * Build the SEPARATE provenance sidecar (kept out of the published models.json):
 * canonical id -> per-source deduped record of which fields each fact-only source gave.
 */
export function buildProvenanceIndex(fragments: readonly SourceFragment[]): Record<string, ProvenanceRecord[]> {
  const index: Record<string, ProvenanceRecord[]> = {}
  for (const group of groupFragments(fragments).values()) {
    const id = resolveCanonicalId(group)
    if (id === null) continue
    const bySource = new Map<string, ProvenanceRecord>()
    for (const fragment of group) {
      const p = fragment.provenance
      if (!p) continue
      const record = bySource.get(p.source) ?? { source: p.source, source_ids: [], contributed: [] }
      if (p.source_id && !record.source_ids.includes(p.source_id)) record.source_ids.push(p.source_id)
      for (const field of p.contributed) if (!record.contributed.includes(field)) record.contributed.push(field)
      if (p.url && !record.url) record.url = p.url
      if (p.observed_at && !record.observed_at) record.observed_at = p.observed_at
      bySource.set(p.source, record)
    }
    if (bySource.size) index[id] = [...bySource.values()]
  }
  return index
}

/** Merge all fragments into canonical entries, sorted by id (deterministic output). */
export function mergeFragments(fragments: readonly SourceFragment[], options: MergeOptions = {}): ModelEntry[] {
  const entries: ModelEntry[] = []
  for (const group of groupFragments(fragments).values()) {
    const entry = mergeGroup(group, options)
    if (entry) entries.push(entry)
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id))
}

/** Keep one offer per (source, endpoints); prefer the one carrying more pricing detail. */
function dedupeOffers(offers: readonly Offer[]): Offer[] {
  const byKey = new Map<string, Offer>()
  for (const offer of offers) {
    const key = `${offer.source}|${offer.endpoints ?? ''}`
    const existing = byKey.get(key)
    if (!existing || offer.prices.length > existing.prices.length) byKey.set(key, offer)
  }
  return [...byKey.values()]
}

/** Union of per-source other_parameters; higher fact-precedence wins key conflicts. */
function mergeOtherParameters(byFact: readonly SourceFragment[]): Record<string, unknown> | null {
  const merged: Record<string, unknown> = {}
  for (const fragment of [...byFact].reverse()) {
    const extra = fragment.facts.other_parameters
    if (extra) Object.assign(merged, extra)
  }
  return Object.keys(merged).length ? merged : null
}
