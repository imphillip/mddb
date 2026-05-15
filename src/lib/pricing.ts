export type PricingSource = 'openrouter' | 'models.dev' | 'basellm' | 'manual'

export type PricingMode = 'token' | 'request' | 'image' | 'audio' | 'time' | 'web_search' | 'reasoning' | 'other'

export type PricingScope =
  | 'input'
  | 'output'
  | 'cache_read'
  | 'cache_write'
  | 'request'
  | 'image_input'
  | 'image_output'
  | 'image_token'
  | 'audio_input'
  | 'audio_output'
  | 'audio_cache'
  | 'internal_reasoning'
  | 'web_search'
  | 'other'

export type PriceCondition = {
  key: 'context_length' | 'resolution' | 'duration' | 'batch' | 'priority' | 'region' | 'tier' | 'other'
  value: string
}

export type PriceComponent = {
  mode: PricingMode
  scope: PricingScope
  currency: 'USD'
  amount: number
  unit: '1m_tokens' | 'request' | 'image' | 'audio_second' | 'audio_minute' | 'hour' | 'unit'
  conditions: PriceCondition[]
  sourceField: string
}

export type OfficialPriceSet = {
  priceSetId: string
  modelTag: string
  source: PricingSource
  sourceModelKey: string
  sourceProvider: string | null
  components: PriceComponent[]
  rawPricing: Record<string, unknown>
  warnings: string[]
}

const OPENROUTER_PRICE_FIELD_MAP: Record<string, Omit<PriceComponent, 'amount' | 'conditions' | 'sourceField'>> = {
  prompt: { mode: 'token', scope: 'input', currency: 'USD', unit: '1m_tokens' },
  completion: { mode: 'token', scope: 'output', currency: 'USD', unit: '1m_tokens' },
  input_cache_read: { mode: 'token', scope: 'cache_read', currency: 'USD', unit: '1m_tokens' },
  input_cache_write: { mode: 'token', scope: 'cache_write', currency: 'USD', unit: '1m_tokens' },
  request: { mode: 'request', scope: 'request', currency: 'USD', unit: 'request' },
  image: { mode: 'image', scope: 'image_input', currency: 'USD', unit: 'image' },
  image_output: { mode: 'image', scope: 'image_output', currency: 'USD', unit: 'image' },
  image_token: { mode: 'token', scope: 'image_token', currency: 'USD', unit: '1m_tokens' },
  audio: { mode: 'audio', scope: 'audio_input', currency: 'USD', unit: 'unit' },
  audio_output: { mode: 'audio', scope: 'audio_output', currency: 'USD', unit: 'unit' },
  input_audio_cache: { mode: 'audio', scope: 'audio_cache', currency: 'USD', unit: 'unit' },
  internal_reasoning: { mode: 'reasoning', scope: 'internal_reasoning', currency: 'USD', unit: '1m_tokens' },
  web_search: { mode: 'web_search', scope: 'web_search', currency: 'USD', unit: 'request' },
}

const PER_TOKEN_FIELDS = new Set(['prompt', 'completion', 'input_cache_read', 'input_cache_write', 'image_token', 'internal_reasoning'])

export function parseOpenRouterOfficialPriceSet(args: {
  modelTag: string
  sourceModelKey: string
  sourceProvider: string | null
  pricing: Record<string, unknown>
}): OfficialPriceSet {
  const components: PriceComponent[] = []
  const warnings: string[] = []
  const rawPricing = { ...args.pricing }

  const isFreeTierObservation = args.sourceModelKey.endsWith(':free')
  if (isFreeTierObservation) {
    warnings.push('free-tier-preserved-not-official-price')
  }

  for (const [field, value] of Object.entries(args.pricing)) {
    if (value === undefined || value === null || value === '') continue
    if (field === 'discount') {
      warnings.push('discount-preserved-not-applied')
      continue
    }
    const parsed = parsePriceValue(value)
    if (parsed === null) {
      warnings.push(`unparsed-pricing-field:${field}`)
      continue
    }
    const mapping = OPENROUTER_PRICE_FIELD_MAP[field]
    if (!mapping) {
      warnings.push(`unknown-pricing-field:${field}`)
      continue
    }
    if (isFreeTierObservation || parsed === 0) {
      if (!warnings.includes('free-tier-preserved-not-official-price')) {
        warnings.push('free-tier-preserved-not-official-price')
      }
      continue
    }
    components.push({
      ...mapping,
      amount: PER_TOKEN_FIELDS.has(field) ? roundPrice(parsed * 1_000_000) : parsed,
      conditions: [],
      sourceField: field,
    })
  }

  return {
    priceSetId: `openrouter:${args.sourceModelKey}`,
    modelTag: args.modelTag,
    source: 'openrouter',
    sourceModelKey: args.sourceModelKey,
    sourceProvider: args.sourceProvider,
    components,
    rawPricing,
    warnings,
  }
}

export function summarizeTokenPrice(components: PriceComponent[], scope: 'input' | 'output'): string {
  const component = components.find((item) => item.mode === 'token' && item.scope === scope && item.unit === '1m_tokens')
  return component ? `$${formatNumber(component.amount)} / 1M` : '—'
}

export function annotatePriceSetConditions(items: Array<{ priceSet: OfficialPriceSet; contextLength?: number | null }>): OfficialPriceSet[] {
  const contextLengths = new Set(items.map((item) => item.contextLength).filter((value): value is number => typeof value === 'number' && value > 0))
  return items.map(({ priceSet, contextLength }) => {
    const contextCondition: PriceCondition | null = contextLengths.size > 1 && contextLength ? { key: 'context_length', value: String(contextLength) } : null
    if (!contextCondition) return priceSet
    return {
      ...priceSet,
      components: priceSet.components.map((component) => ({
        ...component,
        conditions: [
          ...component.conditions,
          ...(hasCondition(component.conditions, contextCondition.key) ? [] : [contextCondition]),
        ],
      })),
    }
  })
}

export function detectUnexplainedPriceConflicts(priceSets: OfficialPriceSet[]): string[] {
  const seen = new Map<string, PriceComponent>()
  const warnings: string[] = []
  for (const priceSet of priceSets) {
    for (const component of priceSet.components) {
      const conditionKey = component.conditions.map((condition) => `${condition.key}:${condition.value}`).sort().join('|')
      const key = `${priceSet.modelTag}:${component.mode}:${component.scope}:${component.unit}:${conditionKey}`
      const existing = seen.get(key)
      if (existing && existing.amount !== component.amount) {
        warnings.push(`unexplained-price-conflict:${priceSet.modelTag}:${component.mode}:${component.scope}`)
      } else if (!existing) {
        seen.set(key, component)
      }
    }
  }
  return Array.from(new Set(warnings))
}

function hasCondition(conditions: PriceCondition[], key: PriceCondition['key']): boolean {
  return conditions.some((condition) => condition.key === key)
}

function parsePriceValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function roundPrice(value: number): number {
  return Number(value.toFixed(12))
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : Number(value.toFixed(6)).toString()
}
