import { normalizeModelName, stripSnapshotSuffix, type NormalizeModelNameResult } from './model-normalization.js'

export type PriceSource = 'basellm' | 'models.dev' | 'openrouter' | 'manual'

export type ModelPriceFact = {
  modelTag: string
  source: PriceSource
  sourceModelKey: string
  sourceProvider: string | null
  currency: 'USD'
  unit: '1m_tokens'
  inputPrice: number | null
  outputPrice: number | null
  cacheReadPrice: number | null
  cacheWritePrice: number | null
  rawSourceUrl: string
  observedAt: string
}

export type ModelSourceRecord = {
  modelTag: string
  source: PriceSource
  sourceModelKey: string
  sourceProvider: string | null
  sourceUrl: string
  observedAt: string
  rawRecord: Record<string, unknown>
  normalized: Record<string, unknown>
  lossyFields: Record<string, unknown>
}

export type SourceImportResult = {
  prices: ModelPriceFact[]
  sourceRecords: ModelSourceRecord[]
}

export type SourceImportOptions = {
  sourceUrl: string
  observedAt: string
  knownTags: string[]
}

type ModelsDevCatalog = Record<string, { models?: Record<string, Record<string, unknown>> }>

type ModelsDevCost = {
  input?: unknown
  output?: unknown
  cache_read?: unknown
  cache_write?: unknown
}

type ModelsDevCandidate = {
  provider: string
  modelKey: string
  modelTag: string
  rawRecord: Record<string, unknown>
  match: NormalizeModelNameResult
  cost: ModelsDevCost
  inputPrice: number
  outputPrice: number | null
  cacheReadPrice: number | null
  cacheWritePrice: number | null
}

type RatioConfig = Record<string, unknown>

const MODELS_DEV_SOURCE: PriceSource = 'models.dev'
const BASELLM_SOURCE: PriceSource = 'basellm'
const USD_PER_RATIO_UNIT_PER_1M_TOKENS = 2

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null
  }
  return value
}

function readMap(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function readCost(record: Record<string, unknown>): ModelsDevCost {
  const cost = record.cost
  return isRecord(cost) ? cost : {}
}

function roundPrice(value: number): number {
  return Number(value.toFixed(12))
}

function makeLossyFields(provider: string | null, modelKey: string, unmodeledFields?: Record<string, unknown>): Record<string, unknown> {
  const normalized = normalizeModelNameForLoss(modelKey)
  const lossyFields: Record<string, unknown> = {}
  if (provider !== null) {
    lossyFields.providerNamespace = provider
  }
  if (normalized.snapshot !== null) {
    lossyFields.normalizedAwaySnapshot = normalized.snapshot
  }
  if (unmodeledFields !== undefined && Object.keys(unmodeledFields).length > 0) {
    lossyFields.unmodeledFields = unmodeledFields
  }
  return lossyFields
}

function normalizeModelNameForLoss(modelKey: string): { snapshot: string | null } {
  const normalized = modelKey
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return stripSnapshotSuffix(normalized)
}

function getUnmodeledModelsDevFields(record: Record<string, unknown>): Record<string, unknown> {
  const modeledKeys = new Set(['id', 'name', 'cost'])
  const unmodeled: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!modeledKeys.has(key)) {
      unmodeled[key] = value
    }
  }
  return unmodeled
}

function buildModelsDevCandidate(
  provider: string,
  modelKey: string,
  rawRecord: Record<string, unknown>,
  match: NormalizeModelNameResult,
): ModelsDevCandidate | { reason: string; cost: ModelsDevCost } {
  const cost = readCost(rawRecord)
  const inputPrice = readNumber(cost.input)
  const outputPrice = readNumber(cost.output)
  const cacheReadPrice = readNumber(cost.cache_read)
  const cacheWritePrice = readNumber(cost.cache_write)

  if (inputPrice === null) {
    return { reason: 'missing_input_price', cost }
  }
  if (inputPrice < 0) {
    return { reason: 'negative_input_price', cost }
  }
  if (outputPrice !== null && outputPrice < 0) {
    return { reason: 'negative_output_price', cost }
  }
  if (inputPrice === 0 && outputPrice !== null && outputPrice > 0) {
    return { reason: 'input_price_zero_with_nonzero_output', cost }
  }

  return {
    provider,
    modelKey,
    modelTag: match.matchedTag!,
    rawRecord,
    match,
    cost,
    inputPrice,
    outputPrice,
    cacheReadPrice: cacheReadPrice !== null && cacheReadPrice >= 0 ? cacheReadPrice : null,
    cacheWritePrice: cacheWritePrice !== null && cacheWritePrice >= 0 ? cacheWritePrice : null,
  }
}

function shouldReplaceModelsDevCandidate(current: ModelsDevCandidate, next: ModelsDevCandidate): boolean {
  const currentNonZero = current.inputPrice > 0
  const nextNonZero = next.inputPrice > 0
  if (currentNonZero !== nextNonZero) {
    return nextNonZero
  }
  if (nextNonZero && next.inputPrice !== current.inputPrice) {
    return next.inputPrice < current.inputPrice
  }
  return next.provider < current.provider
}

function toModelsDevPriceFact(candidate: ModelsDevCandidate, options: SourceImportOptions): ModelPriceFact {
  return {
    modelTag: candidate.modelTag,
    source: MODELS_DEV_SOURCE,
    sourceModelKey: candidate.modelKey,
    sourceProvider: candidate.provider,
    currency: 'USD',
    unit: '1m_tokens',
    inputPrice: candidate.inputPrice,
    outputPrice: candidate.outputPrice,
    cacheReadPrice: candidate.cacheReadPrice,
    cacheWritePrice: candidate.cacheWritePrice,
    rawSourceUrl: options.sourceUrl,
    observedAt: options.observedAt,
  }
}

function toPricingObject(price: ModelPriceFact): Record<string, number | null> {
  return {
    inputPrice: price.inputPrice,
    outputPrice: price.outputPrice,
    cacheReadPrice: price.cacheReadPrice,
    cacheWritePrice: price.cacheWritePrice,
  }
}

export function importModelsDevCatalog(rawCatalog: unknown, options: SourceImportOptions): SourceImportResult {
  const catalog = readMap(rawCatalog) as ModelsDevCatalog
  const selectedByTag = new Map<string, ModelsDevCandidate>()
  const observed: Array<{
    provider: string
    modelKey: string
    modelTag: string
    rawRecord: Record<string, unknown>
    match: NormalizeModelNameResult
    candidate: ModelsDevCandidate | null
    conversionReason: string | null
  }> = []

  for (const provider of Object.keys(catalog).sort()) {
    const providerData = catalog[provider]
    const models = providerData?.models ?? {}
    for (const modelKey of Object.keys(models).sort()) {
      const rawRecord = models[modelKey]
      if (!isRecord(rawRecord)) {
        continue
      }
      const match = normalizeModelName(modelKey, { tags: options.knownTags })
      if (match.matchedTag === null) {
        continue
      }

      const candidateOrFailure = buildModelsDevCandidate(provider, modelKey, rawRecord, match)
      const candidate = 'reason' in candidateOrFailure ? null : candidateOrFailure
      observed.push({
        provider,
        modelKey,
        modelTag: match.matchedTag,
        rawRecord,
        match,
        candidate,
        conversionReason: 'reason' in candidateOrFailure ? candidateOrFailure.reason : null,
      })
      if (candidate === null) {
        continue
      }
      const current = selectedByTag.get(candidate.modelTag)
      if (current === undefined || shouldReplaceModelsDevCandidate(current, candidate)) {
        selectedByTag.set(candidate.modelTag, candidate)
      }
    }
  }

  const prices = Array.from(selectedByTag.values())
    .sort((a, b) => a.modelTag.localeCompare(b.modelTag))
    .map((candidate) => toModelsDevPriceFact(candidate, options))

  const priceByTag = new Map(prices.map((price) => [price.modelTag, price]))
  const sourceRecords = observed.map((observation) => {
    const selected = selectedByTag.get(observation.modelTag)
    const price = priceByTag.get(observation.modelTag)
    const unmodeledFields = getUnmodeledModelsDevFields(observation.rawRecord)
    const lossyFields = makeLossyFields(observation.provider, observation.modelKey, unmodeledFields)
    if (observation.conversionReason !== null) {
      lossyFields.pricingConversion = { reason: observation.conversionReason }
    }
    if (selected !== undefined && selected.provider !== observation.provider) {
      lossyFields.conflict = {
        reason: 'lower_priority_pricing_candidate',
        selectedProvider: selected.provider,
      }
    }

    return {
      modelTag: observation.modelTag,
      source: MODELS_DEV_SOURCE,
      sourceModelKey: observation.modelKey,
      sourceProvider: observation.provider,
      sourceUrl: options.sourceUrl,
      observedAt: options.observedAt,
      rawRecord: observation.rawRecord,
      normalized: {
        matchedTag: observation.match.matchedTag,
        matchType: observation.match.matchType,
        pricing: price !== undefined && selected?.provider === observation.provider ? toPricingObject(price) : null,
      },
      lossyFields,
    }
  })

  return { prices, sourceRecords }
}

function collectRatioModelKeys(ratioConfig: RatioConfig): string[] {
  const keys = new Set<string>()
  for (const field of ['model_ratio', 'completion_ratio', 'cache_ratio', 'create_cache_ratio']) {
    for (const key of Object.keys(readMap(ratioConfig[field]))) {
      keys.add(key)
    }
  }
  return Array.from(keys).sort()
}

function readRatioValue(ratioConfig: RatioConfig, field: string, modelKey: string): number | null {
  return readNumber(readMap(ratioConfig[field])[modelKey])
}

export function importBaseLLMRatioConfig(rawRatioConfig: unknown, options: SourceImportOptions): SourceImportResult {
  const ratioConfig = readMap(rawRatioConfig)
  const prices: ModelPriceFact[] = []
  const sourceRecords: ModelSourceRecord[] = []

  for (const modelKey of collectRatioModelKeys(ratioConfig)) {
    const match = normalizeModelName(modelKey, { tags: options.knownTags })
    if (match.matchedTag === null) {
      continue
    }

    const modelRatio = readRatioValue(ratioConfig, 'model_ratio', modelKey)
    const completionRatio = readRatioValue(ratioConfig, 'completion_ratio', modelKey)
    const cacheRatio = readRatioValue(ratioConfig, 'cache_ratio', modelKey)
    const createCacheRatio = readRatioValue(ratioConfig, 'create_cache_ratio', modelKey)

    const inputPrice = modelRatio === null ? null : roundPrice(modelRatio * USD_PER_RATIO_UNIT_PER_1M_TOKENS)
    const outputPrice = inputPrice === null || completionRatio === null ? null : roundPrice(inputPrice * completionRatio)
    const cacheReadPrice = inputPrice === null || cacheRatio === null ? null : roundPrice(inputPrice * cacheRatio)
    const cacheWritePrice = inputPrice === null || createCacheRatio === null ? null : roundPrice(inputPrice * createCacheRatio)

    const price: ModelPriceFact = {
      modelTag: match.matchedTag,
      source: BASELLM_SOURCE,
      sourceModelKey: modelKey,
      sourceProvider: null,
      currency: 'USD',
      unit: '1m_tokens',
      inputPrice,
      outputPrice,
      cacheReadPrice,
      cacheWritePrice,
      rawSourceUrl: options.sourceUrl,
      observedAt: options.observedAt,
    }
    prices.push(price)

    const ratioFacts: Record<string, number> = {}
    if (modelRatio !== null) {
      ratioFacts.model_ratio = modelRatio
    }
    if (completionRatio !== null) {
      ratioFacts.completion_ratio = completionRatio
    }
    if (cacheRatio !== null) {
      ratioFacts.cache_ratio = cacheRatio
    }
    if (createCacheRatio !== null) {
      ratioFacts.create_cache_ratio = createCacheRatio
    }

    const lossyFields = makeLossyFields(null, modelKey)
    lossyFields.ratioConfig = ratioFacts

    sourceRecords.push({
      modelTag: match.matchedTag,
      source: BASELLM_SOURCE,
      sourceModelKey: modelKey,
      sourceProvider: null,
      sourceUrl: options.sourceUrl,
      observedAt: options.observedAt,
      rawRecord: ratioFacts,
      normalized: {
        matchedTag: match.matchedTag,
        matchType: match.matchType,
        pricing: toPricingObject(price),
      },
      lossyFields,
    })
  }

  return { prices, sourceRecords }
}
