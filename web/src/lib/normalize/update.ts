// Daily-update apply step: merge a freshly-normalized candidate with the current
// published models, marking models that disappeared from every source as `delisted`
// (kept, not deleted) and clearing the mark when a model reappears.
import type { ModelEntry } from './schema.js'

export interface MergeResult {
  models: ModelEntry[]
  newlyDeprecated: string[] // were active, now absent -> freshly marked
  stillDeprecated: string[] // already marked, still absent -> mark preserved
  reactivated: string[] // were marked, back in candidate -> mark cleared
}

/**
 * Active set = whatever the candidate produced (stale deprecation marks cleared).
 * Carried-forward = models only in `current`: kept verbatim + a `delisted` mark whose
 * `since` date is preserved across runs (set once, on first disappearance).
 */
export function mergeWithDeprecations(
  current: readonly ModelEntry[],
  candidate: readonly ModelEntry[],
  options: { today: string },
): MergeResult {
  const currentById = new Map(current.map((m) => [m.id, m]))
  const candidateById = new Map(candidate.map((m) => [m.id, m]))
  const models: ModelEntry[] = []
  const reactivated: string[] = []

  for (const model of candidate) {
    if (currentById.get(model.id)?.deprecation) reactivated.push(model.id)
    if (model.deprecation) {
      const cleared = { ...model }
      delete cleared.deprecation
      models.push(cleared)
    } else {
      models.push(model)
    }
  }

  const newlyDeprecated: string[] = []
  const stillDeprecated: string[] = []
  for (const model of current) {
    if (candidateById.has(model.id)) continue
    if (model.deprecation) {
      stillDeprecated.push(model.id)
      models.push(model)
    } else {
      newlyDeprecated.push(model.id)
      models.push({ ...model, deprecation: { status: 'delisted', since: options.today } })
    }
  }

  models.sort((a, b) => a.id.localeCompare(b.id))
  return { models, newlyDeprecated: newlyDeprecated.sort(), stillDeprecated: stillDeprecated.sort(), reactivated: reactivated.sort() }
}
