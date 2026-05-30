// Frozen maintainer facts (data/models-dev-frozen.json). This is the last snapshot of the
// now-removed models.dev source: `knowledge_cutoff` (no live source provides it) and the
// `release_timestamp` values that no remaining live source supplies. Applied AFTER merge,
// FILL-ONLY (never overrides a value a live source produced):
//   - knowledge_cutoff -> other_parameters.knowledge_cutoff (NOT a top-level field anymore)
//   - release_timestamp -> top-level release_timestamp
import type { ModelEntry } from './schema.js'

export interface FrozenFacts {
  knowledge_cutoff?: number | string
  release_timestamp?: number
}

/** Mutates entries in place; returns the number of fields filled. */
export function applyFrozenFacts(entries: ModelEntry[], frozen: Record<string, FrozenFacts>): number {
  let applied = 0
  for (const entry of entries) {
    const f = frozen[entry.id]
    if (!f) continue
    if (f.release_timestamp != null && entry.release_timestamp == null) {
      entry.release_timestamp = f.release_timestamp
      applied += 1
    }
    if (f.knowledge_cutoff != null) {
      const op = entry.other_parameters ?? {}
      if (op['knowledge_cutoff'] == null) {
        op['knowledge_cutoff'] = f.knowledge_cutoff
        entry.other_parameters = op
        applied += 1
      }
    }
  }
  return applied
}
