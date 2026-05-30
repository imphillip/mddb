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
  PriceUnit,
  SourceFragment,
} from '../schema.js'
import { PRICE_COMPONENT_KEYS } from '../schema.js'
import { canonicalId, endpointsFromBaseUrl, foldSnapshotId, matchKey, toEpochSeconds } from '../primitives.js'

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

// Normalize Bailian `provider` values to OpenRouter's canonical author ids (avoid double spellings).
// `qwen-domain-model` is a category (industry-tuned Qwen variants), not a developer.
const PROVIDER_ALIAS: Record<string, string> = {
  'qwen-domain-model': 'qwen',
  'mini-max': 'minimax',
  'moonshot-ai': 'moonshotai',
}

// CNY unit label -> { canonical PriceUnit, amount scale }. Bailian quotes in mixed units
// (每百万tokens / 每千tokens / 每张 / 每秒 / 每万字符 / 次), so we normalize both unit and amount.
const CNY_UNIT_RULES: ReadonlyArray<[RegExp, { unit: PriceUnit; scale: number }]> = [
  [/百万\s*tokens?/iu, { unit: 'per_1m_tokens', scale: 1 }],
  [/千\s*tokens?/iu, { unit: 'per_1m_tokens', scale: 1000 }], // per 1K tokens -> per 1M
  [/万字符/u, { unit: 'per_character', scale: 1 / 10000 }], // per 10K chars -> per char
  [/字符/u, { unit: 'per_character', scale: 1 }],
  [/张/u, { unit: 'per_image', scale: 1 }],
  [/秒/u, { unit: 'per_second', scale: 1 }],
  [/页/u, { unit: 'per_page', scale: 1 }],
  [/次/u, { unit: 'per_request', scale: 1 }],
]

function cnyComponent(amount: number, label: string): PriceComponent | null {
  for (const [re, { unit, scale }] of CNY_UNIT_RULES) {
    if (re.test(label)) {
      const scaled = amount * scale
      // avoid binary-float noise (e.g. 0.30000000000000004) while keeping tiny per-sec/char prices
      return { amount: Number(scaled.toPrecision(12)), unit }
    }
  }
  return null
}

// Map a Bailian price `type` to a canonical price component + an optional variant label for
// non-numeric pricing axes (batch / thinking / resolution / audio / input-modality condition / 3D
// spec). Returns null for types we deliberately don't model as an offer price (e.g. fine-tuning).
function classifyBailianType(type: string): { component: PriceComponentKey; variant?: string } | null {
  const t = type.toLowerCase()
  if (t === 'ft') return null // model fine-tuning (training), not an inference offer

  const variants: string[] = []
  if (/batch/u.test(t)) variants.push('批量推理')
  if (/thinking/u.test(t)) variants.push('深度思考')
  const res = t.match(/(\d{3,4})p/u)
  if (res) variants.push(`${res[1]}P`)
  if (/no_audio/u.test(t)) variants.push('无音频')
  if (/no_reference_video/u.test(t)) variants.push('无参考视频')
  else if (/reference_video/u.test(t)) variants.push('含参考视频')
  if (/purein/u.test(t)) variants.push('输入仅文本')
  else if (/multiin/u.test(t)) variants.push('输入含多模态')
  const m3d = t.match(/generation_3d_(.+)/u)
  if (m3d?.[1]) variants.push(m3d[1].replace(/_/gu, ' '))
  // there is only one cache_read/cache_write component, so carry the cached modality in the label
  // (text default) to keep per-modality cache prices in distinct, labelled tiers.
  if (/cache/u.test(t)) {
    if (/audio/u.test(t)) variants.push('音频缓存')
    else if (/vision/u.test(t)) variants.push('图片/视频缓存')
  }
  const variant = variants.length ? variants.join(' · ') : undefined

  let component: PriceComponentKey | null = null
  if (/cache/u.test(t)) component = /creation/u.test(t) ? 'cache_write' : 'cache_read'
  else if (/3d/u.test(t)) component = 'request'
  else if (/tts|cosy/u.test(t)) component = 'character'
  else if (/content_duration/u.test(t)) component = 'audio_input'
  else if (/video|\d{3,4}p/u.test(t)) component = 'video'
  else if (/vision_input|embedding_image/u.test(t)) component = 'image_input'
  else if (/image/u.test(t)) component = 'image_output'
  else if (/audio_output|multi_output/u.test(t)) component = 'audio_output'
  else if (/audio_input/u.test(t)) component = 'audio_input'
  else if (/embedding/u.test(t)) component = 'input'
  else if (/input/u.test(t)) component = 'input'
  else if (/output/u.test(t)) component = 'output'
  if (!component) return null
  return variant ? { component, variant } : { component }
}

// Group flat pricing[] entries into Price tiers keyed by variant. Distinct components share a tier;
// a component that would collide within a variant spills into another tier (so no value is lost).
function buildFlatPrices(entries: BailianTierPrice[]): Price[] {
  const tiers: Array<{ variant?: string; price: Price }> = []
  for (const entry of entries) {
    if (entry.type === undefined || entry.price == null) continue
    const cls = classifyBailianType(entry.type)
    if (!cls) continue
    const component = cnyComponent(entry.price, entry.unit ?? '')
    if (!component) continue
    let tier = tiers.find((x) => x.variant === cls.variant && x.price[cls.component] === undefined)
    if (tier === undefined) {
      const price: Price = cls.variant ? { conditions: [{ type: 'variant', label: cls.variant }] } : {}
      tier = cls.variant === undefined ? { price } : { variant: cls.variant, price }
      tiers.push(tier)
    }
    tier.price[cls.component] = component
  }
  return tiers.map((x) => x.price).filter(hasComponents)
}

export function bailianFragment(
  raw: BailianModel,
  options: BailianAdapterOptions = {},
): SourceFragment | null {
  if (raw.model_id.startsWith('group-')) return null
  const fullId = canonicalId(raw.model_id)
  const id = foldSnapshotId(fullId) // dated snapshots fold to base; original kept as alias
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
    const author = PROVIDER_ALIAS[raw.provider.toLowerCase()] ?? raw.provider
    facts.author = author
    facts.author_id = author
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

  // Prefer tiered pricing (input-length tiers); otherwise use the flat pricing[] list (grouped
  // into variant tiers). List prices only — the promo `discount` is ignored.
  const tieredPrices = (raw.tiered_pricing ?? []).map(buildTierPrice).filter(hasComponents)
  const prices = tieredPrices.length > 0 ? tieredPrices : buildFlatPrices(raw.pricing ?? [])
  const offer: Offer = {
    source: 'bailian',
    currency: raw.pricing_currency ?? 'CNY',
    prices,
  }
  if (raw.source_url) offer.url = raw.source_url
  if (options.observedAt) offer.observed_at = options.observedAt
  const limits = deriveRateLimits(raw.qpm_info)
  if (limits) offer.other_params = limits
  const endpoint = endpointFromCapabilities(caps, raw.api_base_url)

  // Drop genuinely empty rows: no price AND no spec facts (e.g. CV tools with no public pricing).
  // These would otherwise pollute the registry as bare name-only entries.
  if (!hasUsefulData(facts, offer)) return null

  return {
    source: 'bailian',
    matchKey: matchKey(id),
    identityId: id,
    aliasIds: id !== fullId ? [fullId] : [],
    aliasNames: raw.name ? [raw.name] : [],
    facts,
    ...(endpoint ? { endpoint } : {}),
    offer,
    provenance: null,
  }
}

function hasUsefulData(facts: ModelFacts, offer: Offer): boolean {
  if (offer.prices.length > 0) return true
  return (
    facts.context_length != null ||
    facts.max_input_tokens != null ||
    facts.max_output_tokens != null ||
    Boolean(facts.input_modalities?.length) ||
    Boolean(facts.output_modalities?.length)
  )
}

// Bailian capability code -> API operation + input/output modalities. Reliable, source-declared
// signal (much cleaner than guessing from prices/base_url) for the non-chat model types.
const CAP_CONFIG: Record<string, { endpoint?: string; in?: Modality[]; out?: Modality[] }> = {
  TG: { endpoint: 'chat', in: ['text'], out: ['text'] },
  VU: { endpoint: 'chat', in: ['text', 'image'], out: ['text'] },
  IU: { endpoint: 'chat', in: ['text', 'image'], out: ['text'] },
  AU: { endpoint: 'chat', in: ['text', 'audio'], out: ['text'] },
  OMNI: { endpoint: 'chat', in: ['text', 'image', 'audio'], out: ['text', 'audio'] },
  'Multimodal-Omni': { endpoint: 'chat', in: ['text', 'image', 'audio'], out: ['text', 'audio'] },
  'Realtime-Omni': { endpoint: 'chat', in: ['text', 'image', 'audio'], out: ['text', 'audio'] },
  IG: { endpoint: 'images', in: ['text', 'image'], out: ['image'] },
  VG: { endpoint: 'video', in: ['text', 'image'], out: ['video'] },
  ASR: { endpoint: 'audio.transcription', in: ['audio'], out: ['text'] },
  'Realtime-ASR': { endpoint: 'audio.transcription', in: ['audio'], out: ['text'] },
  'Realtime-Audio-Translate': { endpoint: 'audio.transcription', in: ['audio'], out: ['text', 'audio'] },
  TTS: { endpoint: 'audio.speech', in: ['text'], out: ['audio'] },
  'Realtime-Text-to-Speech': { endpoint: 'audio.speech', in: ['text'], out: ['audio'] },
  TR: { endpoint: 'rerank', in: ['text'], out: ['text'] },
  ME: { endpoint: 'embeddings', in: ['text', 'image'], out: ['embedding'] },
  '3D-generation': { endpoint: '3d', in: ['text', 'image'], out: ['other'] },
}
// When several capabilities are present, prefer the chat operation; else the first media operation.
const ENDPOINT_PRIORITY = ['chat', 'embeddings', 'rerank', 'images', 'video', 'audio.transcription', 'audio.speech', '3d']

function modalitiesFromCapabilities(caps: string[]): { input: Modality[]; output: Modality[] } {
  const input = new Set<Modality>()
  const output = new Set<Modality>()
  for (const cap of caps) {
    const cfg = CAP_CONFIG[cap]
    if (!cfg) continue
    for (const m of cfg.in ?? []) input.add(m)
    for (const m of cfg.out ?? []) output.add(m)
  }
  return { input: [...input], output: [...output] }
}

function endpointFromCapabilities(caps: string[], baseUrl: string | null | undefined): string | null {
  const ops = new Set<string>()
  for (const cap of caps) {
    const e = CAP_CONFIG[cap]?.endpoint
    if (e) ops.add(e)
  }
  for (const op of ENDPOINT_PRIORITY) if (ops.has(op)) return op
  return endpointsFromBaseUrl(baseUrl) // fall back to the API base-url signal (compatible-mode -> chat)
}

// Tiered (input-length) pricing: one Price per range, components mapped via the classifier.
function buildTierPrice(tier: BailianTier): Price {
  const price: Price = {}
  const condition = buildCondition(tier)
  if (condition) price.conditions = [condition]
  for (const entry of tier.prices ?? []) {
    if (entry.type === undefined || entry.price == null) continue
    const cls = classifyBailianType(entry.type)
    if (!cls) continue
    const component = cnyComponent(entry.price, entry.unit ?? '')
    if (component && price[cls.component] === undefined) price[cls.component] = component
  }
  return price
}

function hasComponents(price: Price): boolean {
  return PRICE_COMPONENT_KEYS.some((key) => price[key] !== undefined)
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
