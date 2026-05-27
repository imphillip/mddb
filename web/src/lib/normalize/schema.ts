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
  | 'per_second'
  | 'per_audio_minute'
  | 'per_character'

export interface PriceComponent {
  amount: number
  unit: PriceUnit
}

export type PriceComponentKey = 'input' | 'output' | 'cache_write' | 'cache_read'

export interface PriceCondition {
  label?: string
  type: 'input_token' | 'output_token' | 'total_token'
  gt?: number
  gte?: number
  lt?: number
  lte?: number
}

/** A single pricing tier. Absent `conditions` = applies unconditionally. */
export interface Price {
  conditions?: PriceCondition[]
  input?: PriceComponent
  output?: PriceComponent
  cache_write?: PriceComponent
  cache_read?: PriceComponent
}

/** One data source's commercial/route observation of a model. */
export interface Offer {
  source: string
  url?: string
  observed_at?: string
  currency: string
  prices: Price[]
  endpoints?: string
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

export interface ModelEntry extends ModelFacts {
  id: string
  model: string
  alias_id?: string[]
  alias?: string[]
  last_updated?: string
  offers: Offer[]
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
  offer: Offer | null
  provenance: ProvenanceEntry | null
}
