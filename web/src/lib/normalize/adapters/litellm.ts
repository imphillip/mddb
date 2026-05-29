// LiteLLM adapter (see ../../../../../normalizer-spec.md §4.4).
// Enrichment-first: non-chat model types (embedding/rerank/audio/image/video),
// USD specs and complex pricing. Canonical identity ONLY for clean, non-gateway-shaped
// ids (LiteLLM is last in identity precedence); gateway/config-shaped keys are
// enrichment-only. Non-token costs that have no Price slot are bucketed, never dropped.
import type { Modality, ModelFacts, Offer, Price, PriceComponentKey, PriceUnit, SourceFragment } from '../schema.js'
import { canonicalId, matchKey, roundMoney, usdPerTokenTo1m } from '../primitives.js'

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

// Normalized API-operation enum (see README endpoints standard): protocol-agnostic.
const MODE_ENDPOINTS: Record<string, string> = {
  chat: 'chat',
  completion: 'chat',
  responses: 'responses',
  embedding: 'embeddings',
  image_generation: 'images',
  image_edit: 'images',
  audio_transcription: 'audio.transcription',
  audio_speech: 'audio.speech',
  rerank: 'rerank',
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
  const endpoint = MODE_ENDPOINTS[mode]

  return {
    source: 'litellm',
    matchKey: matchKey(id),
    identityId: eligible ? id : null,
    aliasIds: [],
    aliasNames: [],
    facts,
    ...(endpoint ? { endpoint } : {}),
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

  // Map non-token costs (per_image / per_second / per_character / per_query ...) into real
  // price components. Long-tail / conditional variants we can't safely place are bucketed.
  const otherParams: Record<string, unknown> = {}
  if (raw.litellm_provider) otherParams['litellm_provider'] = raw.litellm_provider
  otherParams['mode'] = mode
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number') continue
    if (key in TOKEN_PRICE_MAP || !key.includes('cost')) continue
    const mapped = liteLLMCostComponent(key)
    if (mapped && price[mapped.component] === undefined) {
      const amount = mapped.perToken ? usdPerTokenTo1m(value) : roundMoney(value)
      if (Number.isFinite(amount)) {
        price[mapped.component] = { amount, unit: mapped.unit }
        continue
      }
    }
    otherParams[key] = value // unmapped / conditional tier -> keep, don't drop
  }

  const offer: Offer = {
    source: 'litellm',
    currency: 'USD',
    prices: Object.keys(price).some((k) => k !== 'conditions') ? [price] : [],
    other_params: otherParams,
  }
  if (options.observedAt) offer.observed_at = options.observedAt
  return offer
}

/** Map a LiteLLM `*_cost_per_*` field name to a price component + unit (null = bucket). */
function liteLLMCostComponent(key: string): { component: PriceComponentKey; unit: PriceUnit; perToken: boolean } | null {
  // Conditional / resolution / batch / session variants can't be placed on a flat tier safely.
  if (/above_|premium|priority|_1024|_512|interval|batch|no_audio|code_interpreter|file_search|vector_store|computer_use|per_credit|per_page|per_gb/u.test(key)) {
    return null
  }
  const io: 'input' | 'output' = key.startsWith('output') ? 'output' : 'input'
  if (/per_reasoning_token$/u.test(key)) return { component: 'reasoning', unit: 'per_1m_tokens', perToken: true }
  if (/per_audio_token$/u.test(key)) return { component: io === 'output' ? 'audio_output' : 'audio_input', unit: 'per_1m_tokens', perToken: true }
  if (/per_image_token$/u.test(key)) return { component: io === 'output' ? 'image_output' : 'image_input', unit: 'per_1m_tokens', perToken: true }
  if (/per_token$/u.test(key)) return null // plain text tokens handled by TOKEN_PRICE_MAP
  if (/per_video_per_second$/u.test(key)) return { component: 'video', unit: 'per_second', perToken: false }
  if (/per_second$/u.test(key)) return { component: io === 'output' ? 'audio_output' : 'audio_input', unit: 'per_second', perToken: false }
  if (/per_image$/u.test(key)) return { component: io === 'output' ? 'image_output' : 'image_input', unit: 'per_image', perToken: false }
  if (/per_pixel$/u.test(key)) return { component: io === 'output' ? 'image_output' : 'image_input', unit: 'per_pixel', perToken: false }
  if (/per_character$/u.test(key)) return { component: 'character', unit: 'per_character', perToken: false }
  if (/per_query$/u.test(key)) return { component: 'request', unit: 'per_query', perToken: false }
  if (/per_request$/u.test(key)) return { component: 'request', unit: 'per_request', perToken: false }
  return null
}
