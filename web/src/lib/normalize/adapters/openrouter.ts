// OpenRouter adapter (see ../../../../../normalizer-spec.md §4.1).
// Primary identity source; USD flat pricing. Raw per-token decimal prices are ×1e6.
import type { Modality, ModelFacts, Offer, Price, PriceComponent, PriceComponentKey, PriceUnit, SourceFragment } from '../schema.js'
import {
  canonicalId,
  cleanName,
  endpointsFromBaseUrl,
  matchKey,
  roundMoney,
  uniq,
  usdPerTokenTo1m,
  vendorPrefix,
} from '../primitives.js'

export interface OpenRouterModel {
  id: string
  canonical_slug?: string
  name?: string
  created?: number
  context_length?: number
  architecture?: {
    input_modalities?: string[]
    output_modalities?: string[]
    tokenizer?: string | null
  }
  pricing?: Record<string, string>
  top_provider?: {
    context_length?: number
    max_completion_tokens?: number | null
  }
  supported_parameters?: string[]
  knowledge_cutoff?: number | string | null
}

export interface OpenRouterAdapterOptions {
  observedAt?: string
}

// OpenRouter pricing keys: prompt/completion/cache/image/audio/internal_reasoning are
// per-token decimals (×1e6 -> per 1M); web_search/request are per-call (used as-is).
const PRICE_COMPONENT_MAP: Record<string, { component: PriceComponentKey; unit: PriceUnit; perToken: boolean }> = {
  prompt: { component: 'input', unit: 'per_1m_tokens', perToken: true },
  completion: { component: 'output', unit: 'per_1m_tokens', perToken: true },
  input_cache_read: { component: 'cache_read', unit: 'per_1m_tokens', perToken: true },
  input_cache_write: { component: 'cache_write', unit: 'per_1m_tokens', perToken: true },
  image: { component: 'image_input', unit: 'per_1m_tokens', perToken: true },
  audio: { component: 'audio_input', unit: 'per_1m_tokens', perToken: true },
  internal_reasoning: { component: 'reasoning', unit: 'per_1m_tokens', perToken: true },
  web_search: { component: 'web_search', unit: 'per_request', perToken: false },
  request: { component: 'request', unit: 'per_request', perToken: false },
}

export function openRouterFragment(
  raw: OpenRouterModel,
  options: OpenRouterAdapterOptions = {},
): SourceFragment {
  const id = canonicalId(raw.id)
  const vendor = vendorPrefix(raw.id)
  const displayName = raw.name ? cleanName(raw.name) : id
  const params = raw.supported_parameters ?? []

  const facts: ModelFacts = {
    model: displayName,
    context_length: raw.context_length ?? raw.top_provider?.context_length ?? null,
    max_output_tokens: raw.top_provider?.max_completion_tokens ?? null,
    release_timestamp: raw.created ?? null,
    knowledge_cutoff: raw.knowledge_cutoff ?? null,
    reasoning: params.includes('reasoning') || params.includes('include_reasoning'),
    tool_calling: params.includes('tools') || params.includes('tool_choice'),
  }
  if (vendor) {
    facts.author = vendor
    facts.author_id = vendor
  }
  const inMod = raw.architecture?.input_modalities
  if (inMod?.length) facts.input_modalities = inMod as Modality[]
  const outMod = raw.architecture?.output_modalities
  if (outMod?.length) facts.output_modalities = outMod as Modality[]

  const extra: Record<string, unknown> = {}
  if (raw.architecture?.tokenizer) extra['tokenizer'] = raw.architecture.tokenizer
  if (params.length) extra['supported_parameters'] = params
  if (Object.keys(extra).length) facts.other_parameters = extra

  const price = buildPrice(raw.pricing)
  const offer: Offer = {
    source: 'openrouter',
    url: `https://openrouter.ai/${raw.id}`,
    currency: 'USD',
    prices: price ? [price] : [],
    endpoints: endpointsFromBaseUrl('https://openrouter.ai/api/v1') ?? 'chat',
  }
  if (options.observedAt) offer.observed_at = options.observedAt

  return {
    source: 'openrouter',
    matchKey: matchKey(id),
    identityId: id,
    aliasIds: uniq([raw.id, raw.canonical_slug].filter((v): v is string => Boolean(v))),
    aliasNames: raw.name ? [cleanName(raw.name)] : [],
    facts,
    offer,
    provenance: null,
  }
}

function buildPrice(pricing: Record<string, string> | undefined): Price | null {
  if (!pricing) return null
  const price: Price = {}
  for (const [rawKey, spec] of Object.entries(PRICE_COMPONENT_MAP)) {
    const value = pricing[rawKey]
    if (value === undefined) continue
    const amount = spec.perToken ? usdPerTokenTo1m(value) : roundMoney(Number(value))
    if (!Number.isFinite(amount) || amount === 0) continue
    const component: PriceComponent = { amount, unit: spec.unit }
    price[spec.component] = component
  }
  return Object.keys(price).length ? price : null
}
