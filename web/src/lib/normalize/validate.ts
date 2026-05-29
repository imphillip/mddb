// Validator for normalized output (see ../../../../normalizer-spec.md §6 and
// docs/data-source-rules.md hard rules). Lightweight structural + invariant checks
// (the repo has no JSON-Schema runtime dep); the formal contract lives in
// data/schema/models.v2.schema.json.
import type { ModelEntry, Offer, Price } from './schema.js'
import { PRICE_COMPONENT_KEYS } from './schema.js'
import { isNonCanonicalId } from './primitives.js'

export { isNonCanonicalId }

const SLUG = /^[a-z0-9][a-z0-9._-]*$/u
const PRICE_UNITS = new Set([
  'per_1m_tokens',
  'per_image',
  'per_video',
  'per_request',
  'per_query',
  'per_second',
  'per_audio_minute',
  'per_character',
  'per_pixel',
  'per_page',
])
const MODALITIES = new Set(['text', 'image', 'audio', 'video', 'embedding', 'file', 'tool', 'json', 'other'])
const ENDPOINT_OPERATIONS = new Set(['chat', 'responses', 'embeddings', 'images', 'audio.transcription', 'audio.speech', 'rerank', 'video', '3d'])
const PRICE_COMPONENTS = PRICE_COMPONENT_KEYS

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

export function validateModels(entries: readonly ModelEntry[]): ValidationResult {
  const errors: string[] = []
  const seen = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!
    const where = entry.id || `#${i}`

    if (!entry.id || !SLUG.test(entry.id)) errors.push(`${where}: invalid id slug`)
    if (isNonCanonicalId(entry.id)) errors.push(`${where}: non-canonical id (router/product/free/latest/group)`)
    if (seen.has(entry.id)) errors.push(`${where}: duplicate id`)
    seen.add(entry.id)
    if (!entry.model || typeof entry.model !== 'string') errors.push(`${where}: missing model name`)
    if (i > 0 && entries[i - 1]!.id.localeCompare(entry.id) > 0) errors.push(`${where}: entries not sorted by id`)

    for (const mod of [...(entry.input_modalities ?? []), ...(entry.output_modalities ?? [])]) {
      if (!MODALITIES.has(mod)) errors.push(`${where}: invalid modality "${mod}"`)
    }
    for (const op of entry.endpoints ?? []) {
      if (!ENDPOINT_OPERATIONS.has(op)) errors.push(`${where}: invalid endpoint operation "${op}"`)
    }

    const sources = new Set<string>()
    for (const offer of entry.offers) {
      validateOffer(offer, where, errors)
      if (sources.has(offer.source)) errors.push(`${where}: duplicate offer source ${offer.source}`)
      sources.add(offer.source)
    }
  }

  return { ok: errors.length === 0, errors }
}

function validateOffer(offer: Offer, where: string, errors: string[]): void {
  if (!offer.source) errors.push(`${where}: offer missing source`)
  if (offer.prices.length > 0 && !offer.currency) errors.push(`${where}/${offer.source}: priced offer missing currency`)
  for (const price of offer.prices) validatePrice(price, `${where}/${offer.source}`, errors)
}

function validatePrice(price: Price, where: string, errors: string[]): void {
  let hasComponent = false
  for (const key of PRICE_COMPONENTS) {
    const component = price[key]
    if (!component) continue
    hasComponent = true
    if (typeof component.amount !== 'number' || !Number.isFinite(component.amount)) {
      errors.push(`${where}: price ${key} has non-numeric amount`)
    }
    if (!PRICE_UNITS.has(component.unit)) errors.push(`${where}: price ${key} has invalid unit "${component.unit}"`)
  }
  if (!hasComponent) errors.push(`${where}: price tier has no components`)
  for (const condition of price.conditions ?? []) {
    if (!['input_token', 'output_token', 'total_token'].includes(condition.type)) {
      errors.push(`${where}: invalid condition type "${condition.type}"`)
    }
  }
}
