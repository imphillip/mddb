import type { BrandGroup, ModelDetail, ModelGallery, ModelMetaItem, ModelSummary, ModelVariant, ProviderDeployment } from './model-catalog.js'
import { buildModelGalleryFromModelsDevFile, type ModelsDevGallery } from './models-dev-gallery.js'
import { buildModelGalleryFromOpenRouterFile, type OpenRouterGallery } from './openrouter-gallery.js'

export type ModelsDevProviderObservation = {
  tag: string
  providerNames: string[]
  providerDeployments: ProviderDeployment[]
  sourceIds: string[]
  brandLogoUrl?: string | undefined
}

export type ModelsDevIndependentCandidate = {
  tag: string
  name: string
  brand: string
  providers: string[]
  sourceIds: string[]
  reason: string
}

export type ModelsDevEnrichment = {
  matched: Map<string, ModelsDevProviderObservation>
  brandLogos: Map<string, string>
  independentCandidates: ModelsDevIndependentCandidate[]
  rejectedCandidates: ModelsDevIndependentCandidate[]
  source: ModelsDevGallery['source']
}

export type EnrichedOpenRouterGallery = OpenRouterGallery & {
  source: OpenRouterGallery['source'] & {
    modelsDev: {
      path: string
      modelRows: number
      providerRows: number
      matchedRows: number
      independentCandidateRows: number
      rejectedCandidateRows: number
    }
  }
}

export function buildModelGalleryWithModelsDevEnrichment(openRouterSourcePath: string, modelsDevSourcePath: string): EnrichedOpenRouterGallery {
  return overlayModelsDevEnrichment(buildModelGalleryFromOpenRouterFile(openRouterSourcePath), buildModelGalleryFromModelsDevFile(modelsDevSourcePath))
}

export function buildModelsDevEnrichment(openRouterGallery: ModelGallery & { details: ModelDetail[] }, modelsDevGallery: ModelsDevGallery): ModelsDevEnrichment {
  const openRouterTags = new Set(openRouterGallery.details.map((detail) => detail.tag))
  const brandLogos = new Map<string, string>()
  for (const brand of modelsDevGallery.brands) {
    if (brand.logoUrl !== undefined) brandLogos.set(brand.slug, brand.logoUrl)
  }

  const matched = new Map<string, ModelsDevProviderObservation>()
  const independentCandidates: ModelsDevIndependentCandidate[] = []
  const rejectedCandidates: ModelsDevIndependentCandidate[] = []

  for (const detail of modelsDevGallery.details) {
    if (openRouterTags.has(detail.tag)) {
      matched.set(detail.tag, {
        tag: detail.tag,
        providerNames: uniqueSorted(detail.providerNames),
        providerDeployments: uniqueDeployments(detail.variants.flatMap((variant) => variant.providers)),
        sourceIds: sourceIdsFor(detail),
        brandLogoUrl: detail.brand.logoUrl,
      })
      continue
    }

    const candidate = toCandidate(detail)
    if (isIndependentCandidate(detail)) independentCandidates.push(candidate)
    else rejectedCandidates.push(candidate)
  }

  independentCandidates.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
  rejectedCandidates.sort((a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name))
  return { matched, brandLogos, independentCandidates, rejectedCandidates, source: modelsDevGallery.source }
}

export function overlayModelsDevEnrichment(openRouterGallery: OpenRouterGallery, modelsDevGallery: ModelsDevGallery): EnrichedOpenRouterGallery {
  const enrichment = buildModelsDevEnrichment(openRouterGallery, modelsDevGallery)
  const details = openRouterGallery.details.map((detail) => enrichDetail(detail, enrichment))
  const models = details.map(toSummary)
  const brandModels = new Map(models.map((model) => [model.tag, model]))
  const brands = openRouterGallery.brands.map((brand) => enrichBrandGroup(brand, enrichment, brandModels))

  return {
    ...openRouterGallery,
    brands,
    models,
    details,
    source: {
      ...openRouterGallery.source,
      modelsDev: {
        path: enrichment.source.path,
        modelRows: enrichment.source.modelRows,
        providerRows: enrichment.source.providerRows,
        matchedRows: enrichment.matched.size,
        independentCandidateRows: enrichment.independentCandidates.length,
        rejectedCandidateRows: enrichment.rejectedCandidates.length,
      },
    },
  }
}

function enrichDetail(detail: ModelDetail, enrichment: ModelsDevEnrichment): ModelDetail {
  const observation = enrichment.matched.get(detail.tag)
  const logoUrl = detail.brand.logoUrl ?? observation?.brandLogoUrl ?? enrichment.brandLogos.get(detail.brand.slug)
  const brand = logoUrl === undefined ? detail.brand : { ...detail.brand, logoUrl }
  if (observation === undefined) return { ...detail, brand }

  const providerNames = uniqueSorted([...detail.providerNames, ...observation.providerNames])
  const observationVariant: ModelVariant = {
    id: 'models-dev-provider-observations',
    name: 'models.dev provider observations',
    summary: `models.dev 收录到 ${observation.providerNames.length} 个 provider 部署，可作为 OpenRouter 之外的 availability 观察。`,
    contextWindow: '—',
    inputPrice: '—',
    outputPrice: '—',
    differences: ['provider availability observed in models.dev', 'not used as canonical pricing/context authority'],
    providers: observation.providerDeployments,
  }
  return {
    ...detail,
    brand,
    providerNames,
    variantCount: detail.variantCount + 1,
    variants: [...detail.variants, observationVariant],
    meta: appendModelsDevMeta(detail.meta, observation),
  }
}

function enrichBrandGroup(brand: BrandGroup, enrichment: ModelsDevEnrichment, modelByTag: Map<string, ModelSummary>): BrandGroup {
  const logoUrl = brand.logoUrl ?? enrichment.brandLogos.get(brand.slug)
  const models = (brand.models ?? []).map((model) => modelByTag.get(model.tag) ?? model)
  return logoUrl === undefined ? { ...brand, models } : { ...brand, logoUrl, models }
}

function appendModelsDevMeta(meta: ModelMetaItem[], observation: ModelsDevProviderObservation): ModelMetaItem[] {
  return [
    ...meta,
    { label: 'models.dev providers', value: observation.providerNames },
    { label: 'models.dev source ids', value: observation.sourceIds },
  ]
}

function toSummary(detail: ModelDetail): ModelSummary {
  const { longDescription: _longDescription, variants: _variants, apiIdentifier: _apiIdentifier, benchmarks: _benchmarks, meta: _meta, ...summary } = detail
  return summary
}

function toCandidate(detail: ModelDetail): ModelsDevIndependentCandidate {
  return {
    tag: detail.tag,
    name: detail.name,
    brand: detail.brand.name,
    providers: detail.providerNames,
    sourceIds: sourceIdsFor(detail),
    reason: candidateReason(detail),
  }
}

function isIndependentCandidate(detail: ModelDetail): boolean {
  if (detail.brand.slug === 'other') return false
  if (isLikelyAliasOrWrapper(detail)) return false
  return true
}

function isLikelyAliasOrWrapper(detail: ModelDetail): boolean {
  const text = `${detail.tag} ${detail.name} ${detail.providerNames.join(' ')}`.toLowerCase()
  return /\b(copy|router|gateway|proxy|replicate|together|fireworks|openrouter|azure|bedrock|vertex|endpoint|api)\b/.test(text)
}

function candidateReason(detail: ModelDetail): string {
  if (detail.brand.slug === 'other') return 'unknown brand in models.dev; likely provider-specific alias or wrapper'
  return `${detail.brand.name} appears as a distinct models.dev brand not currently present in OpenRouter canonical rows`
}

function sourceIdsFor(detail: ModelDetail): string[] {
  const ids = new Set<string>([detail.apiIdentifier])
  for (const variant of detail.variants) {
    ids.add(variant.id)
  }
  return uniqueSorted([...ids].filter(Boolean))
}

function uniqueDeployments(deployments: ProviderDeployment[]): ProviderDeployment[] {
  const bySlug = new Map<string, ProviderDeployment>()
  for (const deployment of deployments) {
    if (!bySlug.has(deployment.slug)) bySlug.set(deployment.slug, deployment)
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}


