// Bailian (Alibaba) adapter (see ../../../../../normalizer-spec.md §4.2).
// CNY tiered pricing + the only source for max_input_tokens + rate limits.
// `group-*` ids are collection groups, not models -> dropped (returns null).
import type {
  Modality,
  ModelFacts,
  Offer,
  Price,
  PriceComponent,
  PriceComponentKey,
  PriceCondition,
  SourceFragment,
} from '../schema.js'
import { canonicalId, cnyUnit, endpointsFromBaseUrl, matchKey, toEpochSeconds } from '../primitives.js'

interface BailianTierPrice {
  type?: string
  label?: string
  price?: number
  unit?: string
  // `price` is the standard list price; `discount` is a promotional ratio we DO NOT apply
  // (we record original prices, not promo prices).
  discount?: number | null
}
interface BailianTier {
  range_name?: string
  range_start_tokens?: number
  range_end_tokens?: number
  prices?: BailianTierPrice[]
}
interface BailianQpm {
  count_limit?: number
  count_limit_period?: number
  usage_limit?: number
  usage_limit_period?: number
  usage_limit_field?: string
}
interface BailianLimits {
  context_window?: number
  max_input_tokens?: number
  max_output_tokens?: number
  max_reasoning_tokens?: number
  reasoning_max_input_tokens?: number
  reasoning_max_output_tokens?: number
}
export interface BailianModel {
  source_url?: string
  model_id: string
  name?: string
  provider?: string
  pricing_currency?: string
  pricing?: BailianTierPrice[]
  tiered_pricing?: BailianTier[]
  limits?: BailianLimits
  qpm_info?: Record<string, BailianQpm>
  api_base_url?: string
  capabilities?: string[]
  features?: string[]
  latest_online_at?: string
}

export interface BailianAdapterOptions {
  observedAt?: string
}

const PRICE_TYPE_MAP: Record<string, PriceComponentKey> = {
  input_token: 'input',
  output_token: 'output',
  input_token_cache_creation_5m: 'cache_write',
  input_token_cache_read: 'cache_read',
}

export function bailianFragment(
  raw: BailianModel,
  options: BailianAdapterOptions = {},
): SourceFragment | null {
  if (raw.model_id.startsWith('group-')) return null
  const id = canonicalId(raw.model_id)
  const caps = raw.capabilities ?? []
  const features = raw.features ?? []

  const facts: ModelFacts = {
    reasoning: caps.includes('Reasoning'),
    tool_calling: features.includes('function-calling'),
    context_length: raw.limits?.context_window ?? null,
    max_input_tokens: raw.limits?.max_input_tokens ?? null,
    max_output_tokens: raw.limits?.max_output_tokens ?? null,
    release_timestamp: toEpochSeconds(raw.latest_online_at),
  }
  if (raw.name) facts.model = raw.name
  if (raw.provider) {
    facts.author = raw.provider
    facts.author_id = raw.provider
  }
  const modalities = modalitiesFromCapabilities(caps)
  if (modalities.input.length) facts.input_modalities = modalities.input
  if (modalities.output.length) facts.output_modalities = modalities.output

  const extra: Record<string, unknown> = {}
  for (const key of ['max_reasoning_tokens', 'reasoning_max_input_tokens', 'reasoning_max_output_tokens'] as const) {
    const value = raw.limits?.[key]
    if (value !== undefined) extra[key] = value
  }
  if (Object.keys(extra).length) facts.other_parameters = extra

  // Prefer tiered pricing (input-length tiers); otherwise fall back to the flat pricing[]
  // list (single unconditional tier). List prices only — the promo `discount` is ignored.
  const tieredPrices = (raw.tiered_pricing ?? []).map(buildTierPrice).filter(hasComponents)
  const flatPrice = tieredPrices.length === 0 ? buildFlatPrice(raw.pricing ?? []) : null
  const offer: Offer = {
    source: 'bailian',
    currency: raw.pricing_currency ?? 'CNY',
    prices: tieredPrices.length > 0 ? tieredPrices : flatPrice && hasComponents(flatPrice) ? [flatPrice] : [],
  }
  if (raw.source_url) offer.url = raw.source_url
  if (options.observedAt) offer.observed_at = options.observedAt
  const limits = deriveRateLimits(raw.qpm_info)
  if (limits) offer.other_params = limits
  const endpoint = endpointsFromBaseUrl(raw.api_base_url)

  return {
    source: 'bailian',
    matchKey: matchKey(id),
    identityId: id,
    aliasIds: [],
    aliasNames: raw.name ? [raw.name] : [],
    facts,
    ...(endpoint ? { endpoint } : {}),
    offer,
    provenance: null,
  }
}

function modalitiesFromCapabilities(caps: string[]): { input: Modality[]; output: Modality[] } {
  const input = new Set<Modality>()
  const output = new Set<Modality>()
  if (caps.includes('TG')) {
    input.add('text')
    output.add('text')
  }
  if (caps.includes('VU')) input.add('image')
  return { input: [...input], output: [...output] }
}

function buildTierPrice(tier: BailianTier): Price {
  const price: Price = {}
  const condition = buildCondition(tier)
  if (condition) price.conditions = [condition]
  for (const entry of tier.prices ?? []) {
    if (entry.type === undefined || entry.price === undefined) continue
    const target = PRICE_TYPE_MAP[entry.type]
    if (!target) continue
    const component: PriceComponent = { amount: entry.price, unit: cnyUnit(entry.unit ?? '') }
    price[target] = component
  }
  return price
}

/** Flat (non-tiered) pricing[] -> one unconditional Price. List prices; discount ignored. */
function buildFlatPrice(entries: BailianTierPrice[]): Price {
  const price: Price = {}
  for (const entry of entries) {
    if (entry.type === undefined || entry.price === undefined) continue
    const target = PRICE_TYPE_MAP[entry.type]
    if (!target) continue
    price[target] = { amount: entry.price, unit: cnyUnit(entry.unit ?? '') }
  }
  return price
}

function hasComponents(price: Price): boolean {
  return Boolean(price.input || price.output || price.cache_write || price.cache_read)
}

function buildCondition(tier: BailianTier): PriceCondition | null {
  const start = tier.range_start_tokens
  const end = tier.range_end_tokens
  if (start === undefined && end === undefined) return null
  const condition: PriceCondition = { type: 'input_token' }
  if (tier.range_name) condition.label = tier.range_name
  if (start !== undefined && start > 0) condition.gt = start
  if (end !== undefined) condition.lte = end
  return condition
}

function deriveRateLimits(qpm: Record<string, BailianQpm> | undefined): Record<string, number> | null {
  if (!qpm) return null
  const entry = qpm['model-default'] ?? Object.values(qpm)[0]
  if (!entry) return null
  const out: Record<string, number> = {}
  if (entry.count_limit !== undefined && entry.count_limit_period) {
    out['RPM'] = Math.round((entry.count_limit / entry.count_limit_period) * 60)
  }
  if (
    entry.usage_limit !== undefined &&
    entry.usage_limit_period &&
    entry.usage_limit_field === 'total_tokens'
  ) {
    out['TPM'] = Math.round((entry.usage_limit / entry.usage_limit_period) * 60)
  }
  return Object.keys(out).length ? out : null
}
