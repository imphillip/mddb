import type { Brand, BrandGroup, ModelDetail, ModelGallery, ModelMetaItem, ModelSummary, ModelVariant } from './model-catalog.js'
import { buildModelGalleryFromModelsDevFile, type ModelsDevGallery } from './models-dev-gallery.js'
import { buildModelGalleryFromOpenRouterFile, type OpenRouterGallery } from './openrouter-gallery.js'

export type OverlaySourceStats = {
  openrouter: OpenRouterGallery['source']
  modelsDev: ModelsDevGallery['source'] & {
    matchedModels: number
    unmatchedModels: number
    addedProviderDeployments: number
  }
}

export type OverlayModelGallery = ModelGallery & {
  details: ModelDetail[]
  source: OverlaySourceStats
}

export function buildModelGalleryWithModelsDevOverlay(openRouterSourcePath: string, modelsDevSourcePath: string): OverlayModelGallery {
  const openRouterGallery = buildModelGalleryFromOpenRouterFile(openRouterSourcePath)
  const modelsDevGallery = buildModelGalleryFromModelsDevFile(modelsDevSourcePath)
  return overlayModelsDevGallery(openRouterGallery, modelsDevGallery)
}

export function overlayModelsDevGallery(openRouterGallery: OpenRouterGallery, modelsDevGallery: ModelsDevGallery): OverlayModelGallery {
  const modelsDevByTag = new Map(modelsDevGallery.details.map((detail) => [detail.tag, detail]))
  let matchedModels = 0
  let addedProviderDeployments = 0

  const details = openRouterGallery.details.map((openRouterDetail) => {
    const modelsDevDetail = modelsDevByTag.get(openRouterDetail.tag)
    if (modelsDevDetail === undefined) return openRouterDetail
    matchedModels += 1
    const overlaid = overlayModelDetail(openRouterDetail, modelsDevDetail)
    addedProviderDeployments += Math.max(0, countProviders(overlaid.variants) - countProviders(openRouterDetail.variants))
    return overlaid
  })
  const models = details.map(toSummary)
  const brands = rebuildBrands(openRouterGallery.brands, models)
  const variantCount = details.reduce((sum, detail) => sum + detail.variants.length, 0)

  return {
    brands,
    models,
    details,
    stats: {
      ...openRouterGallery.stats,
      modelCount: models.length,
      brandCount: brands.length,
      providerCount: openRouterGallery.stats.providerCount + addedProviderDeployments,
      variantCount,
    },
    source: {
      openrouter: openRouterGallery.source,
      modelsDev: {
        ...modelsDevGallery.source,
        matchedModels,
        unmatchedModels: modelsDevGallery.details.length - matchedModels,
        addedProviderDeployments,
      },
    },
  }
}

function overlayModelDetail(openRouterDetail: ModelDetail, modelsDevDetail: ModelDetail): ModelDetail {
  const providerNames = mergeStrings(openRouterDetail.providerNames, modelsDevDetail.providerNames)
  const variants = mergeVariants(openRouterDetail.variants, modelsDevDetail.variants)
  const meta = appendModelsDevMeta(openRouterDetail.meta, modelsDevDetail)
  const modalities = mergeStrings(openRouterDetail.modalities, modelsDevDetail.modalities)
  const releasedAt = chooseDate(openRouterDetail.releasedAt, modelsDevDetail.releasedAt)

  return {
    ...openRouterDetail,
    description: openRouterDetail.description,
    longDescription: `${openRouterDetail.longDescription} 已叠加 models.dev 的 provider / capability 观察值；OpenRouter 仍作为主数据源。`,
    modalities,
    providerNames,
    variantCount: variants.length,
    releasedAt,
    variants,
    meta,
  }
}

function mergeVariants(openRouterVariants: ModelVariant[], modelsDevVariants: ModelVariant[]): ModelVariant[] {
  const deploymentsBySlug = new Map<string, ModelVariant['providers'][number]>()
  for (const variant of openRouterVariants) {
    for (const provider of variant.providers) deploymentsBySlug.set(provider.slug, provider)
  }
  for (const variant of modelsDevVariants) {
    if (isLikelyDifferentCanonicalModel(variant.id)) continue
    for (const provider of variant.providers) {
      if (!deploymentsBySlug.has(provider.slug)) deploymentsBySlug.set(provider.slug, provider)
    }
  }

  const modelsDevDeployments = Array.from(deploymentsBySlug.values()).sort((a, b) => a.name.localeCompare(b.name))
  if (modelsDevDeployments.length === 0) return openRouterVariants

  return [
    ...openRouterVariants,
    {
      id: 'models-dev-observations',
      name: 'models.dev provider observations',
      summary: `models.dev 额外记录了 ${modelsDevDeployments.length} 个 provider / gateway 入口；作为叠加观察值展示，不覆盖 OpenRouter pricing。`,
      contextWindow: '—',
      inputPrice: '—',
      outputPrice: '—',
      differences: ['source models.dev', 'provider/capability overlay', 'OpenRouter remains primary pricing/source'],
      providers: modelsDevDeployments,
    },
  ]
}

function isLikelyDifferentCanonicalModel(variantId: string): boolean {
  return /(^|-)mini($|-)|(^|-)nano($|-)|(^|-)flash($|-)|(^|-)haiku($|-)|(^|-)embedding($|-)/.test(variantId)
}

function appendModelsDevMeta(openRouterMeta: ModelMetaItem[], modelsDevDetail: ModelDetail): ModelMetaItem[] {
  return [
    ...openRouterMeta,
    { label: 'models.dev matched', value: 'yes' },
    { label: 'models.dev source ids', value: metaValue(modelsDevDetail.meta, 'Source model ids') },
    { label: 'models.dev provider ids', value: metaValue(modelsDevDetail.meta, 'Source provider ids') },
    { label: 'models.dev provider names', value: modelsDevDetail.providerNames },
    { label: 'models.dev updated dates', value: metaValue(modelsDevDetail.meta, 'Updated dates') },
  ]
}

function metaValue(meta: ModelMetaItem[], label: string): string | string[] {
  return meta.find((item) => item.label === label)?.value ?? '—'
}

function rebuildBrands(existingBrands: BrandGroup[], models: ModelSummary[]): BrandGroup[] {
  const existingBySlug = new Map<string, Brand>(existingBrands.map((brand) => [brand.slug, brand]))
  const brandMap = new Map<string, BrandGroup>()
  for (const model of models) {
    const base = existingBySlug.get(model.brand.slug) ?? model.brand
    const current = brandMap.get(model.brand.slug)
    if (current === undefined) brandMap.set(model.brand.slug, { ...base, models: [model] })
    else current.models.push(model)
  }
  for (const brand of existingBrands) {
    if (!brandMap.has(brand.slug) && brand.models.length === 0) brandMap.set(brand.slug, { ...brand, models: [] })
  }
  return Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function countProviders(variants: ModelVariant[]): number {
  return new Set(variants.flatMap((variant) => variant.providers.map((provider) => provider.slug))).size
}

function mergeStrings(primary: string[], secondary: string[]): string[] {
  return Array.from(new Set([...primary, ...secondary])).sort()
}

function chooseDate(primary: string, secondary: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(primary)) return primary
  if (/^\d{4}-\d{2}-\d{2}$/.test(secondary)) return secondary
  return primary
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
