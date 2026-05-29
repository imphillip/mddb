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
    // Carried-forward (delisted) entries are frozen — they aren't re-derived from sources,
    // so re-apply the pure-function format invariants (alias≠model, endpoints enum) to keep
    // historical records consistent with current rules.
    const carried = normalizeCarried(model)
    if (model.deprecation) {
      stillDeprecated.push(model.id)
      models.push(carried)
    } else {
      newlyDeprecated.push(model.id)
      models.push({ ...carried, deprecation: { status: 'delisted', since: options.today } })
    }
  }

  models.sort((a, b) => a.id.localeCompare(b.id))
  return { models, newlyDeprecated: newlyDeprecated.sort(), stillDeprecated: stillDeprecated.sort(), reactivated: reactivated.sort() }
}

// Legacy endpoints values (pre-enum) -> normalized operation enum (README endpoints standard).
const LEGACY_ENDPOINT: Record<string, string> = {
  'openai/chat.completions': 'chat',
  'openai/responses': 'responses',
  'openai/embeddings': 'embeddings',
  'openai/images.generations': 'images',
  'openai/images.edits': 'images',
  'openai/audio.transcriptions': 'audio.transcription',
  'openai/audio.speech': 'audio.speech',
  'openai/rerank': 'rerank',
  'volcengine/video.generation': 'video',
  'volcengine/3d.generation': '3d',
}

function nameKey(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[\s._-]+/gu, '')
}

/** Re-apply entry-local format invariants to a carried-forward (frozen) model. */
function normalizeCarried(model: ModelEntry): ModelEntry {
  const out: ModelEntry = { ...model }
  if (Array.isArray(out.offers)) {
    out.offers = out.offers.map((offer) =>
      typeof offer.endpoints === 'string' && LEGACY_ENDPOINT[offer.endpoints]
        ? { ...offer, endpoints: LEGACY_ENDPOINT[offer.endpoints]! }
        : offer,
    )
  }
  if (Array.isArray(out.alias)) {
    const mk = nameKey(out.model)
    const filtered = out.alias.filter((a) => nameKey(a) !== mk)
    if (filtered.length) out.alias = filtered
    else delete out.alias
  }
  return out
}
