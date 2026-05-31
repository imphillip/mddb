// LiteLLM adapter (see ../../../../../normalizer-spec.md §4.4).
// Enrichment-first: non-chat model types (embedding/rerank/audio/image/video),
// USD specs and complex pricing. Canonical identity ONLY for clean, non-gateway-shaped
// ids (LiteLLM is last in identity precedence); gateway/config-shaped keys are
// enrichment-only. Non-token costs that have no Price slot are bucketed, never dropped.
import type { Modality, ModelFacts, Offer, Price, PriceComponentKey, PriceUnit, SourceFragment } from '../schema.js'
import { canonicalId, foldSnapshotId, matchKey, roundMoney, usdPerTokenTo1m } from '../primitives.js'

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

// LiteLLM does not carry a `author` field, and `litellm_provider` is mostly the GATEWAY/host
// (bedrock / azure / fireworks_ai / vertex_ai …), not the model developer. So derive the developer
// from the id prefix (bedrock/vertex ids encode it: anthropic.claude-*, amazon.titan-*, ai21.*),
// falling back to litellm_provider only when it is itself a developer. Outputs match OpenRouter's
// canonical author ids so the same developer never gets two spellings.
const ID_GATEWAY_PREFIX = /^(us|eu|apac|au|global|sa|ca|me|jp|in|databricks|google|aws)[.\-]/u
const AUTHOR_BY_ID: ReadonlyArray<[RegExp, string]> = [
  [/^(anthropic|claude)/u, 'anthropic'],
  [/^(amazon|nova-|titan)/u, 'amazon'],
  [/^(ai21|jamba|j2-)/u, 'ai21'],
  [/^(cohere|command|embed-|rerank-)/u, 'cohere'],
  [/^(meta|llama|codellama)/u, 'meta-llama'],
  [/^(gpt|chatgpt|o[1345]([.\-]|$)|ada|babbage|davinci|curie|text-(embedding|davinci|curie|ada|babbage|moderation)|codex|dall-e|whisper|tts-|gpt-image|computer-use|omni-moderation)/u, 'openai'],
  [/^(mistral|mixtral|codestral|pixtral|ministral|magistral|devstral)/u, 'mistralai'],
  [/^(gemini|gemma|codegemma|palm|chat-bison|text-bison|imagen|veo|medlm|learnlm)/u, 'google'],
  [/^deepseek/u, 'deepseek'],
  [/^(qwen|qwq|qvq|tongyi|farui|alibaba|gte-)/u, 'qwen'],
  [/^(kimi|moonshot)/u, 'moonshotai'],
  [/^minimax/u, 'minimax'],
  [/^hermes/u, 'nousresearch'],
  [/^(doubao|seedream|seedance|seed-|seed3d|hitem|hyper3d)/u, 'bytedance'],
  [/^(phi-|phi3|phi4)/u, 'microsoft'],
  [/^granite/u, 'ibm-granite'],
  [/^grok/u, 'x-ai'],
  [/^(glm|chatglm|codegeex)/u, 'z-ai'],
  [/^yi-/u, '01-ai'],
  [/^jina/u, 'jina-ai'],
  [/^(stability|stable-|sdxl|sd3|sd-)/u, 'stability-ai'],
  [/^eleven/u, 'elevenlabs'],
  [/^(bge-|baai)/u, 'baai'],
  [/^voyage/u, 'voyage-ai'],
  [/^mpt-/u, 'mosaicml'],
  [/^flux/u, 'black-forest-labs'],
  [/^gen[34]/u, 'runwayml'],
  [/^(text-unicorn|text-multilingual|multimodalembedding|imagegeneration|chirp)/u, 'google'],
  [/^reka/u, 'rekaai'],
  [/^lfm/u, 'liquid'],
  [/^vicuna/u, 'lmsys'],
  [/^nomic/u, 'nomic-ai'],
  [/^internlm/u, 'internlm'],
  [/^mamba-codestral/u, 'mistralai'],
  [/^snowflake-arctic/u, 'snowflake'],
  [/^recraft/u, 'recraft'],
  [/^playai/u, 'playai'],
  [/^orca/u, 'microsoft'],
  [/^(dolphin|chatdolphin)/u, 'cognitivecomputations'],
  [/^snowflake-llama/u, 'meta-llama'],
  [/^snowflake/u, 'snowflake'],
  [/^(mai-|phi)/u, 'microsoft'],
  [/^v0-/u, 'vercel'],
  [/^llava/u, 'llava-hf'],
  [/^sarvam/u, 'sarvam-ai'],
  [/^jais/u, 'inceptionai'],
]
const AUTHOR_BY_PROVIDER: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  mistral: 'mistralai',
  cohere: 'cohere',
  gemini: 'google',
  xai: 'x-ai',
  perplexity: 'perplexity',
  deepseek: 'deepseek',
  deepgram: 'deepgram',
  dashscope: 'qwen',
  ai21: 'ai21',
  voyage: 'voyage-ai',
  jina_ai: 'jina-ai',
  elevenlabs: 'elevenlabs',
  cerebras: 'cerebras',
  'vertex_ai-anthropic_models': 'anthropic',
  'vertex_ai-language-models': 'google',
  'vertex_ai-mistral_models': 'mistralai',
  'vertex_ai-ai21_models': 'ai21',
  'vertex_ai-llama_models': 'meta-llama',
}

// A leading `<vendor>.`/`<vendor>-` namespace directly names the author (handles ids whose model
// part doesn't self-identify the vendor, e.g. openai.gpt-5, nvidia.nemotron, zai.glm-5, xai.grok-3).
const VENDOR_NAMESPACE: ReadonlyArray<[RegExp, string]> = [
  [/^amazon[.\-]/u, 'amazon'],
  [/^anthropic[.\-]/u, 'anthropic'],
  [/^ai21[.\-]/u, 'ai21'],
  [/^cohere[.\-]/u, 'cohere'],
  [/^meta[.\-]/u, 'meta-llama'],
  [/^mistral[.\-]/u, 'mistralai'],
  [/^minimax[.\-]/u, 'minimax'],
  [/^qwen[.\-]/u, 'qwen'],
  [/^deepseek[.\-]/u, 'deepseek'],
  [/^moonshotai?[.\-]/u, 'moonshotai'],
  [/^bytedance[.\-]/u, 'bytedance'],
  [/^openai[.\-]/u, 'openai'],
  [/^xai[.\-]/u, 'x-ai'],
  [/^nvidia[.\-]/u, 'nvidia'],
  [/^zai[.\-]/u, 'z-ai'],
]

export function authorFromLiteLLM(rawId: string, provider: string | undefined): string | null {
  const id = rawId.toLowerCase().replace(ID_GATEWAY_PREFIX, '')
  for (const [re, author] of VENDOR_NAMESPACE) if (re.test(id)) return author
  for (const [re, author] of AUTHOR_BY_ID) if (re.test(id)) return author
  if (provider) {
    const mapped = AUTHOR_BY_PROVIDER[provider.toLowerCase()]
    if (mapped) return mapped
  }
  return null
}

// Many LiteLLM ids carry a redundant vendor namespace prefix (bedrock / vertex / databricks routes).
// The vendor is now the `author` field, so strip the prefix to get the clean canonical id — this also
// folds gateway/region duplicates (us.anthropic.claude-opus-4-7, anthropic.claude-..., databricks-
// claude-... → claude-opus-4-7). CAUTION: only strip where the vendor is a pure NAMESPACE, never the
// model-name root — so a DOT prefix is always safe (amazon.titan, qwen.qwen3), but a DASH prefix is
// stripped only for namespace-only vendors (anthropic-claude, meta-llama), NOT mistral-7b / qwen-3 /
// deepseek-coder where the vendor IS the name.
const VENDOR_DOT_PREFIX = /^(amazon|anthropic|ai21|cohere|meta|mistral|minimax|qwen|deepseek|moonshotai?|bytedance|openai|xai|nvidia|zai)\./u
const VENDOR_DASH_PREFIX = /^(amazon|anthropic|ai21|cohere|meta)-/u

export function cleanLiteLLMId(id: string): string {
  const stripped = id.replace(ID_GATEWAY_PREFIX, '').replace(VENDOR_DOT_PREFIX, '').replace(VENDOR_DASH_PREFIX, '')
  return stripped.length > 0 ? stripped : id
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
  // Strip redundant vendor/gateway/region prefixes (author is its own field), then fold dated
  // snapshots (gpt-4.1-2025-04-14 -> gpt-4.1). Keep the original id as an alias.
  const rawId = canonicalId(raw.model_name)
  const fullId = cleanLiteLLMId(rawId)
  const id = foldSnapshotId(fullId)
  const eligible = liteLLMCanonicalEligible(raw.model_name)

  const facts: ModelFacts = {}
  // derive author from the ORIGINAL id (more signal than the cleaned one)
  const author = authorFromLiteLLM(rawId, raw.litellm_provider)
  if (author) {
    facts.author = author
    facts.author_id = author
  }
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
    // LiteLLM may only MINT a canonical model when its developer is identifiable. A no-author
    // litellm row (search_api, sample_spec, together-ai-* pricing tiers, generic service tiers)
    // is not a trustworthy model — it can still attach facts/offers to a model another source owns
    // (matchKey), but never becomes canonical on its own.
    identityId: eligible && author !== null ? id : null,
    aliasIds: [...new Set([rawId, fullId].filter((a) => a !== id))],
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
    // A 0 cost is "no charge for this dimension" (e.g. embeddings have no output) — not a real
    // price; omit it rather than recording a meaningless amount:0 component.
    if (typeof value !== 'number' || value === 0) continue
    price[target] = { amount: usdPerTokenTo1m(value), unit: 'per_1m_tokens' }
  }

  // Map non-token costs (per_image / per_second / per_character / per_query ...) into real
  // price components. Long-tail / conditional variants we can't safely place are bucketed.
  const otherParams: Record<string, unknown> = {}
  if (raw.litellm_provider) otherParams['litellm_provider'] = raw.litellm_provider
  otherParams['mode'] = mode
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'number' || value === 0) continue
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
