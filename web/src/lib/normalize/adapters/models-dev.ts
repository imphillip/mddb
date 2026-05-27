// models.dev adapter (see ../../../../../normalizer-spec.md §4.5).
// NARROW WHITELIST ONLY: never identity, never price/offer, never overrides structured
// sources. Supplies knowledge_cutoff (no other source has it) + release_date fallback.
// One model id spans many provider records with inconsistent fields, so each whitelist
// field is decided by deterministic majority vote over non-null values.
import type { ModelFacts, ProvenanceEntry, SourceFragment } from '../schema.js'
import { canonicalId, matchKey, toEpochSeconds } from '../primitives.js'

export interface ModelsDevRecord {
  provider?: string
  id: string
  knowledge?: string | null
  release_date?: string | null
}

export interface ModelsDevAdapterOptions {
  observedAt?: string
}

/** Build one whitelist fragment from all models.dev records that share a model id. */
export function modelsDevFragment(
  records: readonly ModelsDevRecord[],
  options: ModelsDevAdapterOptions = {},
): SourceFragment | null {
  const first = records[0]
  if (!first) return null
  const id = canonicalId(first.id)

  const knowledge = majority(records.map((r) => r.knowledge))
  const releaseDate = majority(records.map((r) => r.release_date))
  const releaseTimestamp = toEpochSeconds(releaseDate)

  const facts: ModelFacts = {}
  const contributed: string[] = []
  if (knowledge !== null) {
    facts.knowledge_cutoff = knowledge // keep month precision as "YYYY-MM"
    contributed.push('knowledge_cutoff')
  }
  if (releaseTimestamp !== null) {
    facts.release_timestamp = releaseTimestamp
    contributed.push('release_timestamp')
  }
  if (contributed.length === 0) return null

  const provenance: ProvenanceEntry = {
    source: 'models-dev',
    source_id: first.id,
    contributed,
  }
  if (options.observedAt) provenance.observed_at = options.observedAt

  return {
    source: 'models-dev',
    matchKey: matchKey(id),
    identityId: null, // never a canonical identity source
    aliasIds: [],
    aliasNames: [],
    facts,
    offer: null, // never produces price/offer
    provenance,
  }
}

/** Most common non-null value; alphabetical tiebreak for determinism. */
function majority(values: readonly (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [value, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}
