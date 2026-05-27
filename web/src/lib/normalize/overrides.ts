// Overrides layer (see ../../../../normalizer-spec.md §7-flag2).
// Highest-priority, field-level human edits. Decoupled from any UI: this file is the
// data-layer source of truth; the normalizer consumes it as the top fact source.
// Includes a staleness check so a human edit never silently masks a source forever.
import type { ModelEntry, ModelFacts, SourceFragment } from './schema.js'
import { canonicalId, matchKey } from './primitives.js'

export interface OverrideRecord {
  /** Canonical id this override targets. */
  id: string
  /** Field-level edits. `model`/facts go to ModelFacts; alias arrays handled separately. */
  set: Partial<ModelFacts> & { alias?: string[]; alias_id?: string[] }
  /** Optional snapshot of the values being replaced, for drift detection. */
  was?: Record<string, unknown>
  by?: string
  at?: string
  reason?: string
}

export type OverrideStatus = 'active' | 'redundant' | 'drifted'

export interface OverrideAudit {
  id: string
  field: string
  status: OverrideStatus
  overrideValue: unknown
  autoValue: unknown
}

/** Turn an override into a top-precedence fragment for the merge. */
export function overrideFragment(record: OverrideRecord): SourceFragment {
  const { alias, alias_id, ...facts } = record.set
  return {
    source: 'overrides',
    matchKey: matchKey(canonicalId(record.id)),
    identityId: null, // overrides attach to an existing canonical model, they don't mint identity
    aliasIds: alias_id ?? [],
    aliasNames: alias ?? [],
    facts: facts as ModelFacts,
    offer: null,
    provenance: null,
  }
}

/**
 * Compare each override field against the auto-merged value (merge WITHOUT overrides):
 *  - redundant: a source now agrees with the override -> the override can be retired
 *  - drifted:   a source changed to a value that is neither the override nor `was` -> re-review
 *  - active:    the override is still doing its job
 */
export function checkOverrideStaleness(
  records: readonly OverrideRecord[],
  autoById: ReadonlyMap<string, ModelEntry>,
): OverrideAudit[] {
  const audits: OverrideAudit[] = []
  for (const record of records) {
    const id = canonicalId(record.id)
    const auto = autoById.get(id)
    const { alias: _alias, alias_id: _aliasId, ...facts } = record.set
    for (const [field, overrideValue] of Object.entries(facts)) {
      const autoValue = auto ? (auto as unknown as Record<string, unknown>)[field] : undefined
      const wasValue = record.was ? record.was[field] : undefined
      let status: OverrideStatus
      if (equal(autoValue, overrideValue)) status = 'redundant'
      else if (wasValue !== undefined && !equal(autoValue, wasValue)) status = 'drifted'
      else status = 'active'
      audits.push({ id, field, status, overrideValue, autoValue: autoValue ?? null })
    }
  }
  return audits
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
