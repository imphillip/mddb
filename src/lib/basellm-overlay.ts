import type { ModelDetail, ModelGallery, ModelMetaItem, ModelSummary, ModelVariant } from './model-catalog.js'
import type { OpenRouterGallery } from './openrouter-gallery.js'
import type { BaseLlmEnrichment, BaseLlmPricingVariant } from './basellm-gallery.js'

export type BaseLlmEnrichedGallery = OpenRouterGallery & {
  source: OpenRouterGallery['source'] & {
    basellm: {
      modelRows: number
      matchedRows: number
      variantRows: number
      unitPricedRows: number
    }
  }
}

export function overlayBaseLlmEnrichment(gallery: OpenRouterGallery, enrichment: BaseLlmEnrichment): BaseLlmEnrichedGallery {
  const details = gallery.details.map((detail) => enrichDetail(detail, enrichment))
  const models = details.map(toSummary)
  const matchedRows = details.filter((detail) => enrichment.models.has(detail.tag)).length
  return {
    ...gallery,
    details,
    models,
    source: {
      ...gallery.source,
      basellm: {
        modelRows: enrichment.stats.modelRows,
        matchedRows,
        variantRows: enrichment.stats.variantCount,
        unitPricedRows: enrichment.stats.unitPricedRows,
      },
    },
  }
}

function enrichDetail(detail: ModelDetail, enrichment: BaseLlmEnrichment): ModelDetail {
  const model = enrichment.models.get(detail.tag)
  if (model === undefined) return detail
  const variants = model.variants.map(toModelVariant)
  const meta: ModelMetaItem[] = [
    ...detail.meta,
    { label: 'BaseLLM pricing variants', value: String(model.variants.length) },
    { label: 'BaseLLM billing kinds', value: unique(model.variants.map((variant) => variant.billingKind)) },
    { label: 'BaseLLM providers', value: unique(model.variants.map((variant) => variant.providerName)) },
  ]
  return {
    ...detail,
    variants: [...detail.variants, ...variants],
    variantCount: detail.variants.length + variants.length,
    meta,
  }
}

function toModelVariant(variant: BaseLlmPricingVariant): ModelVariant {
  return {
    id: `basellm:${slug(variant.providerName)}:${variant.billingKind}:${variant.contextWindow}`,
    name: `BaseLLM · ${variant.providerName}`,
    summary: summaryFor(variant),
    contextWindow: variant.contextWindow,
    inputPrice: variant.billingKind === 'unit' ? variant.unitPriceLabel ?? '—' : formatPrice(variant.pricePerMillionInput ?? variant.derivedInputPriceFromRatio),
    outputPrice: variant.billingKind === 'unit' ? '—' : formatPrice(variant.pricePerMillionOutput ?? variant.derivedOutputPriceFromRatio),
    differences: differenceItems(variant),
    providers: [{ slug: slug(variant.providerName), name: variant.providerName, region: '—', uptime: '—', latency: '—', throughput: '—' }],
  }
}

function summaryFor(variant: BaseLlmPricingVariant): string {
  if (variant.billingKind === 'unit') return `BaseLLM / NewAPI 单位计费记录：${variant.unitPriceLabel ?? '价格未知'}。`
  if (variant.billingKind === 'token') return `BaseLLM / NewAPI ratio 计费记录；ratio_model=${variant.ratioModel ?? '—'}，500k tokens = $1。`
  return 'BaseLLM / NewAPI provider 记录；当前未提供可换算价格。'
}

function differenceItems(variant: BaseLlmPricingVariant): string[] {
  return [
    `source model ${variant.sourceModelId}`,
    `billing ${variant.billingKind}`,
    `provider ${variant.providerName}`,
    `context ${variant.contextWindow}`,
    ...(variant.ratioModel === undefined ? [] : [`ratio_model ${variant.ratioModel}`]),
    ...(variant.ratioCompletion === undefined ? [] : [`ratio_completion ${variant.ratioCompletion}`]),
    ...(variant.ratioCache === undefined ? [] : [`ratio_cache ${variant.ratioCache}`]),
    ...(variant.unitPriceLabel === undefined ? [] : [variant.unitPriceLabel]),
    ...variant.tags.map((tag) => `tag ${tag}`),
  ]
}

function toSummary(detail: ModelDetail): ModelSummary {
  return {
    tag: detail.tag,
    route: detail.route,
    name: detail.name,
    brand: detail.brand,
    description: detail.description,
    modalities: detail.modalities,
    contextWindow: detail.contextWindow,
    inputPrice: detail.inputPrice,
    outputPrice: detail.outputPrice,
    providerNames: detail.providerNames,
    variantCount: detail.variantCount,
    weeklyTokens: detail.weeklyTokens,
    releasedAt: detail.releasedAt,
  }
}

function formatPrice(value: number | undefined): string {
  return value === undefined ? '—' : `$${Number(value.toFixed(6)).toString()} / 1M`
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}
