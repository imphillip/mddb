// LiteLLM adapter (see ../../../../../normalizer-spec.md §4.4).
// Enrichment-first: non-chat model types (embedding/rerank/audio/image/video),
// USD specs and complex pricing. Canonical identity ONLY for clean, non-gateway-shaped
// ids (LiteLLM is last in identity precedence); gateway/config-shaped keys are
// enrichment-only. Non-token costs that have no Price slot are bucketed, never dropped.
import type { Modality, ModelFacts, Offer, Price, PriceComponentKey, SourceFragment } from '../schema.js'
import { canonicalId, matchKey, usdPerTokenTo1m } from '../primitives.js'

export interface LiteLLMModel {
  model_name: string
  mode?: string
  litellm_provider?: string
  max_input_tokens?: number
  max_output_tokens?: number
  max_tokens?: number
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_creation_input_token_cost?: number
  cache_read_input_token_cost?: number
  supports_function_calling?: boolean
  supports_reasoning?: boolean
  supports_vision?: boolean
  supports_video_input?: boolean
  supports_audio_input?: boolean
  supports_pdf_input?: boolean
  output_vector_size?: number
  [key: string]: unknown
}

export interface LiteLLMAdapterOptions {
  observedAt?: string
}

const TOKEN_PRICE_MAP: Record<string, PriceComponentKey> = {
  input_cost_per_token: 'input',
  output_cost_per_token: 'output',
  cache_creation_input_token_cost: 'cache_write',
  cache_read_input_token_cost: 'cache_read',
}

const MODE_ENDPOINTS: Record<string, string> = {
  chat: 'openai/chat.completions',
  completion: 'openai/chat.completions',
  responses: 'openai/responses',
  embedding: 'openai/embeddings',
  image_generation: 'openai/images.generations',
  image_edit: 'openai/images.edits',
  audio_transcription: 'openai/audio.transcriptions',
  audio_speech: 'openai/audio.speech',
  rerank: 'openai/rerank',
}

const MODE_OUTPUT_MODALITY: Record<string, Modality> = {
  embedding: 'embedding',
  image_generation: 'image',
  image_edit: 'image',
  audio_speech: 'audio',
  video_generation: 'video',
}

/** True for clean, model-shaped ids; false for arn/config/multi-segment gateway keys. */
export function liteLLMCanonicalEligible(name: string): boolean {
  if (/[\s:]/u.test(name)) return false
  const parts = name.split('/')
  if (parts.length > 2) return false
  const model = parts[parts.length - 1] ?? ''
  if (/\d+-x-\d+|x-\d|steps/u.test(model)) return false
  return model.length > 0
}

export function liteLLMFragment(raw: LiteLLMModel, options: LiteLLMAdapterOptions = {}): SourceFragment {
  const mode = raw.mode ?? 'chat'
  const id = canonicalId(raw.model_name)
  const eligible = liteLLMCanonicalEligible(raw.model_name)

  const facts: ModelFacts = {}
  if (raw.supports_reasoning !== undefined) facts.reasoning = raw.supports_reasoning
  if (raw.supports_function_calling !== undefined) facts.tool_calling = raw.supports_function_calling
  const input = inputModalities(raw)
  if (input.length) facts.input_modalities = input
  const output = outputModalities(mode)
  if (output.length) facts.output_modalities = output
  if (raw.max_input_tokens !== undefined || raw.max_tokens !== undefined) {
    facts.context_length = raw.max_input_tokens ?? raw.max_tokens ?? null
  }
  if (raw.max_input_tokens !== undefined) facts.max_input_tokens = raw.max_input_tokens
  if (raw.max_output_tokens !== undefined) facts.max_output_tokens = raw.max_output_tokens
  if (raw.output_vector_size !== undefined) {
    facts.other_parameters = { output_vector_size: raw.output_vector_size }
  }

  const offer = buildOffer(raw, mode, options)

  return {
    source: 'litellm',
    matchKey: matchKey(id),
    identityId: eligible ? id : null,
    aliasIds: [],
    aliasNames: [],
    facts,
    offer,
    provenance: null,
  }
}

function inputModalities(raw: LiteLLMModel): Modality[] {
  const set = new Set<Modality>(['text'])
  if (raw.supports_vision) set.add('image')
  if (raw.supports_video_input) set.add('video')
  if (raw.supports_audio_input) set.add('audio')
  if (raw.supports_pdf_input) set.add('file')
  return [...set]
}

function outputModalities(mode: string): Modality[] {
  const mapped = MODE_OUTPUT_MODALITY[mode]
  return mapped ? [mapped] : ['text']
}

function buildOffer(raw: LiteLLMModel, mode: string, options: LiteLLMAdapterOptions): Offer {
  const price: Price = {}
  for (const [rawKey, target] of Object.entries(TOKEN_PRICE_MAP)) {
    const value = raw[rawKey]
    if (typeof value !== 'number') continue
    price[target] = { amount: usdPerTokenTo1m(value), unit: 'per_1m_tokens' }
  }

  // Non-token costs (per_image, per_second, above_1hr tiers...) have no Price slot yet:
  // bucket the raw numbers rather than drop them.
  const otherParams: Record<string, unknown> = {}
  if (raw.litellm_provider) otherParams['litellm_provider'] = raw.litellm_provider
  otherParams['mode'] = mode
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number') continue
    if (key in TOKEN_PRICE_MAP) continue
    if (key.includes('cost')) otherParams[key] = value
  }

  const offer: Offer = {
    source: 'litellm',
    currency: 'USD',
    prices: Object.keys(price).length ? [price] : [],
    other_params: otherParams,
  }
  const endpoints = MODE_ENDPOINTS[mode]
  if (endpoints) offer.endpoints = endpoints
  if (options.observedAt) offer.observed_at = options.observedAt
  return offer
}
