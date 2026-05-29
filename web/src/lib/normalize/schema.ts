// Target schema for the rewritten normalizer (see ../../../../normalizer-spec.md §1).
// One ModelEntry per canonical model. Facts are source-agnostic; commercial data
// lives in per-source Offers. This is intentionally NOT data/schema/models.schema.json
// (v1) yet — the rewrite produces a new schema; keep them in sync when it lands.

export type Modality =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'embedding'
  | 'file'
  | 'tool'
  | 'json'
  | 'other'

export type PriceUnit =
  | 'per_1m_tokens'
  | 'per_image'
  | 'per_video'
  | 'per_request'
  | 'per_query'
  | 'per_second'
  | 'per_audio_minute'
  | 'per_character'
  | 'per_pixel'
  | 'per_page'

export interface PriceComponent {
  amount: number
  unit: PriceUnit
}

/**
 * Billing dimension of a price component. Token text I/O + cache, plus non-token
 * dimensions whose metering is carried by the component's `unit` (per_image, per_second,
 * per_request, ...). Direction (input/output) is encoded in the key where it matters.
 */
export type PriceComponentKey =
  | 'input'
  | 'output'
  | 'cache_write'
  | 'cache_read'
  | 'image_input'
  | 'image_output'
  | 'audio_input'
  | 'audio_output'
  | 'video'
  | 'request'
  | 'web_search'
  | 'reasoning'
  | 'character'

export const PRICE_COMPONENT_KEYS: readonly PriceComponentKey[] = [
  'input',
  'output',
  'cache_read',
  'cache_write',
  'reasoning',
  'image_input',
  'image_output',
  'audio_input',
  'audio_output',
  'video',
  'character',
  'request',
  'web_search',
]

export interface PriceCondition {
  label?: string
  type: 'input_token' | 'output_token' | 'total_token'
  gt?: number
  gte?: number
  lt?: number
  lte?: number
}

/** A single pricing tier. Absent `conditions` = applies unconditionally. */
export type Price = { conditions?: PriceCondition[] } & Partial<Record<PriceComponentKey, PriceComponent>>

/** One data source's commercial/route observation of a model. */
export interface Offer {
  source: string
  url?: string
  observed_at?: string
  currency: string
  prices: Price[]
  other_params?: Record<string, unknown>
}

/**
 * Source-tracking for a fact-only contributor (LiteLLM specs, models.dev). This is NOT
 * part of the published models.json — it is collected into a separate provenance sidecar
 * (see buildProvenanceIndex). The clean entry only carries facts + offers + other_parameters.
 */
export interface ProvenanceEntry {
  source: string
  source_id?: string
  url?: string
  observed_at?: string
  contributed: string[]
}

/** One source's deduped contribution to a model, for the provenance sidecar. */
export interface ProvenanceRecord {
  source: string
  source_ids: string[]
  contributed: string[]
  url?: string
  observed_at?: string
}

/** Scalar/array facts that can be merged field-by-field across sources. */
export interface ModelFacts {
  model?: string
  author?: string
  author_id?: string
  input_modalities?: Modality[]
  output_modalities?: Modality[]
  reasoning?: boolean
  tool_calling?: boolean
  context_length?: number | null
  max_input_tokens?: number | null
  max_output_tokens?: number | null
  release_timestamp?: number | null
  knowledge_cutoff?: number | string | null
  other_parameters?: Record<string, unknown>
}

/** Lifecycle marker set by the daily update when a model disappears from every source. */
export interface Deprecation {
  status: 'delisted'
  since: string // YYYY-MM-DD, first day the model was absent from all sources
}

export interface ModelEntry extends ModelFacts {
  id: string
  model: string
  alias_id?: string[]
  alias?: string[]
  // Supported API operations (model-level fact, union across sources): chat / responses /
  // embeddings / images / audio.transcription / audio.speech / rerank / video / 3d.
  endpoints?: string[]
  last_updated?: string
  offers: Offer[]
  deprecation?: Deprecation
}

/**
 * One source's contribution to one model, before merge.
 * `identityId` is null when the source is not allowed to supply canonical identity.
 */
export interface SourceFragment {
  source: string
  matchKey: string
  identityId: string | null
  aliasIds: string[]
  aliasNames: string[]
  facts: ModelFacts
  /** API operation this source exposes the model under (aggregated to model-level endpoints[]). */
  endpoint?: string
  offer: Offer | null
  provenance: ProvenanceEntry | null
}
