import { readFileSync } from 'node:fs'
import { normalizeModelTagCandidate } from './model-normalization.js'

export type BaseLlmNewApiModel = {
  model_name: string
  vendor_name: string
  description?: string
  tags?: string
  icon?: string
  price_per_m_input?: number | null
  price_per_m_output?: number | null
  price_per_m_cache_read?: number | null
  price_per_m_cache_write?: number | null
  ratio_model?: number | null
  ratio_completion?: number | null
  ratio_cache?: number | null
  model_price?: number | null
}

export type BaseLlmBillingKind = 'token' | 'unit' | 'unknown'

export type BaseLlmPricingVariant = {
  id: string
  canonicalTag: string
  sourceModelId: string
  providerName: string
  billingKind: BaseLlmBillingKind
  description: string
  tags: string[]
  contextWindow: string
  pricePerMillionInput?: number | undefined
  pricePerMillionOutput?: number | undefined
  pricePerMillionCacheRead?: number | undefined
  pricePerMillionCacheWrite?: number | undefined
  ratioModel?: number | undefined
  ratioCompletion?: number | undefined
  ratioCache?: number | undefined
  derivedInputPriceFromRatio?: number | undefined
  derivedOutputPriceFromRatio?: number | undefined
  unitPrice?: number | undefined
  unitPriceLabel?: string | undefined
}

export type BaseLlmModelPricing = {
  tag: string
  sourceModelId: string
  variants: BaseLlmPricingVariant[]
}

export type BaseLlmEnrichment = {
  models: Map<string, BaseLlmModelPricing>
  stats: {
    modelRows: number
    modelCount: number
    variantCount: number
    unitPricedRows: number
  }
}

export type BaseLlmSnapshot = {
  source: string
  baseRule: string
  models: BaseLlmNewApiModel[]
}

export function buildBaseLlmEnrichmentFromFile(path: string): BaseLlmEnrichment {
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as BaseLlmSnapshot
  return buildBaseLlmEnrichmentFromNewApiModels(snapshot.models)
}

export function ratioToUsdPerMillion(ratio: number): number {
  return roundMoney(ratio * 2)
}

export function buildBaseLlmEnrichmentFromNewApiModels(rows: BaseLlmNewApiModel[]): BaseLlmEnrichment {
  const models = new Map<string, BaseLlmModelPricing>()
  let unitPricedRows = 0

  for (const row of rows) {
    const canonicalTag = normalizeModelTagCandidate(row.model_name)
    const variant = toVariant(row, canonicalTag)
    if (variant.billingKind === 'unit') unitPricedRows += 1
    const current = models.get(canonicalTag)
    if (current === undefined) {
      models.set(canonicalTag, { tag: canonicalTag, sourceModelId: row.model_name, variants: [variant] })
    } else {
      current.variants.push(variant)
    }
  }

  for (const model of models.values()) {
    model.variants.sort((a, b) => a.providerName.localeCompare(b.providerName) || a.billingKind.localeCompare(b.billingKind) || a.id.localeCompare(b.id))
  }

  return {
    models,
    stats: {
      modelRows: rows.length,
      modelCount: models.size,
      variantCount: rows.length,
      unitPricedRows,
    },
  }
}

function toVariant(row: BaseLlmNewApiModel, canonicalTag: string): BaseLlmPricingVariant {
  const tags = parseTags(row.tags)
  const unitPrice = numberOrUndefined(row.model_price)
  const ratioModel = numberOrUndefined(row.ratio_model)
  const ratioCompletion = numberOrUndefined(row.ratio_completion)
  const pricePerMillionInput = numberOrUndefined(row.price_per_m_input)
  const pricePerMillionOutput = numberOrUndefined(row.price_per_m_output)
  const billingKind: BaseLlmBillingKind = unitPrice !== undefined ? 'unit' : ratioModel !== undefined || pricePerMillionInput !== undefined ? 'token' : 'unknown'
  return {
    id: `${canonicalTag}:${slug(row.vendor_name)}:${billingKind}:${contextWindowFromTags(tags)}`,
    canonicalTag,
    sourceModelId: row.model_name,
    providerName: row.vendor_name,
    billingKind,
    description: row.description ?? '',
    tags,
    contextWindow: contextWindowFromTags(tags),
    pricePerMillionInput,
    pricePerMillionOutput,
    pricePerMillionCacheRead: numberOrUndefined(row.price_per_m_cache_read),
    pricePerMillionCacheWrite: numberOrUndefined(row.price_per_m_cache_write),
    ratioModel,
    ratioCompletion,
    ratioCache: numberOrUndefined(row.ratio_cache),
    derivedInputPriceFromRatio: ratioModel === undefined ? undefined : ratioToUsdPerMillion(ratioModel),
    derivedOutputPriceFromRatio: ratioModel === undefined || ratioCompletion === undefined ? undefined : roundMoney(ratioToUsdPerMillion(ratioModel) * ratioCompletion),
    unitPrice,
    unitPriceLabel: unitPrice === undefined ? undefined : `$${formatMoney(unitPrice)} / request`,
  }
}

function parseTags(value: string | undefined): string[] {
  return value === undefined || value.trim() === '' ? [] : value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function contextWindowFromTags(tags: string[]): string {
  const tag = tags.find((item) => /^\d+(?:\.\d+)?[KkMm]$/.test(item))
  if (tag === undefined) return '—'
  const match = tag.match(/^(\d+(?:\.\d+)?)([KkMm])$/)
  if (!match) return '—'
  const amount = Number(match[1])
  const scale = match[2]!.toLowerCase() === 'm' ? 1_000_000 : 1_000
  return Math.round(amount * scale).toLocaleString('en-US')
}

function numberOrUndefined(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6))
}

function formatMoney(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function slug(value: string): string {
  return normalizeModelTagCandidate(value)
}
