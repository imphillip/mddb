import { existsSync, readFileSync } from 'node:fs'
import type { Brand, ModelDetail, ModelGallery, ModelMetaItem, ModelSummary, ModelVariant, ProviderDeployment } from './model-catalog.js'
import { brandDescription, importOpenRouterModels, type OpenRouterCatalog, type OpenRouterModelRecord, type OpenRouterModelsResponse } from './openrouter-importer.js'

export type OpenRouterGallery = ModelGallery & {
  details: ModelDetail[]
  source: {
    source: 'openrouter'
    path: string
    modelRows: number
    floatingAliasRows: number
    skippedRows: number
  }
}

export function loadOpenRouterModelsFromFile(sourcePath: string): OpenRouterModelsResponse {
  if (!existsSync(sourcePath)) throw new Error(`OpenRouter model list not found: ${sourcePath}`)
  const parsed: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'))
  if (!isRecord(parsed) || !Array.isArray(parsed.data)) throw new Error(`OpenRouter model list has unsupported shape: ${sourcePath}`)
  return parsed as OpenRouterModelsResponse
}

export function buildModelGalleryFromOpenRouterFile(sourcePath: string): OpenRouterGallery {
  return buildModelGalleryFromOpenRouterCatalog(importOpenRouterModels(loadOpenRouterModelsFromFile(sourcePath)), { sourcePath })
}

export function buildModelGalleryFromOpenRouterCatalog(catalog: OpenRouterCatalog, options: { sourcePath: string }): OpenRouterGallery {
  const groups = new Map<string, OpenRouterModelRecord[]>()
  const floatingAliasesByBrand = groupFloatingAliasesByBrand(catalog.floatingAliases)
  for (const record of catalog.records) {
    const current = groups.get(record.canonicalTag)
    if (current === undefined) groups.set(record.canonicalTag, [record])
    else current.push(record)
  }

  const details = Array.from(groups.entries())
    .map(([tag, records]) => toModelDetail(tag, records))
    .sort((a, b) => compareReleasedDescending(a.releasedAt, b.releasedAt) || a.name.localeCompare(b.name))
  const models = details.map(toSummary)
  const brandMap = new Map<string, Brand & { models: ModelSummary[] }>()
  for (const model of models) {
    const current = brandMap.get(model.brand.slug)
    if (current === undefined) brandMap.set(model.brand.slug, { ...model.brand, models: [model] })
    else current.models.push(model)
  }
  for (const [brandSlug, aliases] of floatingAliasesByBrand) {
    const current = brandMap.get(brandSlug)
    if (current !== undefined) current.description = brandDescription(brandSlug)
    else brandMap.set(brandSlug, { ...aliases[0]!.brand, description: brandDescription(brandSlug), models: [] })
  }
  const brands = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const providerCount = new Set(catalog.records.map((record) => record.sourceNamespace)).size
  const variantCount = details.reduce((sum, detail) => sum + detail.variants.length, 0)

  return {
    brands,
    models,
    details,
    source: { source: 'openrouter', path: options.sourcePath, modelRows: catalog.records.length, floatingAliasRows: catalog.floatingAliases.length, skippedRows: catalog.skipped.length },
    stats: { modelCount: models.length, brandCount: brands.length, providerCount, variantCount },
  }
}

function groupFloatingAliasesByBrand(records: OpenRouterModelRecord[]): Map<string, OpenRouterModelRecord[]> {
  const groups = new Map<string, OpenRouterModelRecord[]>()
  for (const record of records) {
    const current = groups.get(record.brand.slug)
    if (current === undefined) groups.set(record.brand.slug, [record])
    else current.push(record)
  }
  return groups
}

function toModelDetail(tag: string, records: OpenRouterModelRecord[]): ModelDetail {
  const best = choosePrimaryRecord(records)
  const variants = buildVariants(records)
  const providerNames = Array.from(new Set(records.map((record) => record.brand.name))).sort()
  const releasedAt = best.metadata.created ? new Date(best.metadata.created * 1000).toISOString().slice(0, 10) : '—'
  return {
    tag,
    route: `/models/${tag}`,
    name: best.displayName,
    brand: { ...best.brand, description: brandDescription(best.brand.slug) },
    description: best.metadata.description ?? `${best.displayName} is listed by OpenRouter with ${providerNames.length} provider namespace observation(s).`,
    longDescription: best.metadata.description ?? `${best.displayName} 页面由 OpenRouter /api/v1/models 生成；OpenRouter namespace 作为来源/provider 观察值保留。`,
    modalities: inferModalities(records),
    contextWindow: formatContext(best.metadata.contextLength),
    inputPrice: formatPrice(best.pricing.promptPer1mUsd),
    outputPrice: formatPrice(best.pricing.completionPer1mUsd),
    providerNames,
    variantCount: variants.length,
    weeklyTokens: '—',
    releasedAt,
    apiIdentifier: best.sourceModelId,
    variants,
    benchmarks: [],
    meta: buildMetaItems(best, records),
  }
}

function buildMetaItems(best: OpenRouterModelRecord, records: OpenRouterModelRecord[]): ModelMetaItem[] {
  const aliases = Array.from(new Set(records.flatMap((record) => record.aliases))).sort()
  const sourceIds = Array.from(new Set(records.map((record) => `${record.sourceNamespace}/${record.sourceModelId}`))).sort()
  const floatingAliases = records.map((record) => record.sourceAlias?.alias).filter((value): value is string => Boolean(value)).sort()
  return [
    { label: 'Canonical tag', value: best.canonicalTag },
    { label: 'Display name', value: best.displayName },
    { label: 'Source', value: best.source },
    { label: 'Source namespace', value: best.sourceNamespace },
    { label: 'Source model id', value: best.sourceModelId },
    { label: 'Source canonical slug', value: best.sourceCanonicalSlug },
    { label: 'OpenRouter aliases', value: aliases },
    { label: 'Floating aliases', value: floatingAliases },
    { label: 'Observed source ids', value: sourceIds },
    { label: 'Created', value: best.metadata.created ? new Date(best.metadata.created * 1000).toISOString() : '—' },
    { label: 'Context length', value: best.metadata.contextLength?.toLocaleString('en-US') ?? '—' },
    { label: 'Max completion tokens', value: best.metadata.maxCompletionTokens?.toLocaleString('en-US') ?? '—' },
    { label: 'Input modalities', value: best.metadata.inputModalities },
    { label: 'Output modalities', value: best.metadata.outputModalities },
    { label: 'Tokenizer', value: best.metadata.tokenizer ?? '—' },
    { label: 'Instruct type', value: best.metadata.instructType ?? '—' },
    { label: 'Supported parameters', value: best.metadata.supportedParameters },
    { label: 'Supported voices', value: best.metadata.supportedVoices ?? [] },
    { label: 'Knowledge cutoff', value: best.metadata.knowledgeCutoff ?? '—' },
    { label: 'Expiration date', value: best.metadata.expirationDate ?? '—' },
    { label: 'Hugging Face id', value: best.metadata.huggingFaceId ?? '—' },
    { label: 'Endpoint details path', value: best.metadata.endpointDetailsPath },
    { label: 'Per-request prompt limit', value: best.metadata.perRequestLimits?.prompt_tokens?.toLocaleString('en-US') ?? '—' },
    { label: 'Per-request completion limit', value: best.metadata.perRequestLimits?.completion_tokens?.toLocaleString('en-US') ?? '—' },
    { label: 'Moderated', value: best.metadata.isModerated ? 'yes' : 'no' },
    { label: 'Prompt price / 1M USD', value: best.pricing.promptPer1mUsd.toLocaleString('en-US', { maximumFractionDigits: 6 }) },
    { label: 'Completion price / 1M USD', value: best.pricing.completionPer1mUsd.toLocaleString('en-US', { maximumFractionDigits: 6 }) },
    { label: 'Cache read / 1M USD', value: best.pricing.cacheReadPer1mUsd?.toLocaleString('en-US', { maximumFractionDigits: 6 }) ?? '—' },
    { label: 'Cache write / 1M USD', value: best.pricing.cacheWritePer1mUsd?.toLocaleString('en-US', { maximumFractionDigits: 6 }) ?? '—' },
    { label: 'Pricing status', value: best.pricing.ratioStatus },
    { label: 'Source record fields', value: Object.keys(best.sourceRecord.rawRecord).sort() },
  ]
}

function choosePrimaryRecord(records: OpenRouterModelRecord[]): OpenRouterModelRecord {
  return records.slice().sort((a, b) => recordScore(b) - recordScore(a) || a.displayName.localeCompare(b.displayName))[0]!
}

function recordScore(record: OpenRouterModelRecord): number {
  return (record.variant === null ? 20 : 0) + (record.snapshot === null ? 10 : 0) + (record.pricing.ratioStatus === 'ok' ? 5 : 0) + (record.metadata.description ? 1 : 0)
}

function buildVariants(records: OpenRouterModelRecord[]): ModelVariant[] {
  const groups = new Map<string, OpenRouterModelRecord[]>()
  for (const record of records) {
    const id = [record.canonicalTag, record.variant?.marker, record.snapshot?.marker].filter(Boolean).join('-')
    const current = groups.get(id)
    if (current === undefined) groups.set(id, [record])
    else current.push(record)
  }
  return Array.from(groups.entries()).map(([id, group]) => {
    const best = choosePrimaryRecord(group)
    const deployments = uniqueDeployments(group.map(toDeployment))
    return {
      id,
      name: variantName(best),
      summary: variantSummary(best, deployments.length),
      contextWindow: formatContext(best.metadata.contextLength),
      inputPrice: formatPrice(best.pricing.promptPer1mUsd),
      outputPrice: formatPrice(best.pricing.completionPer1mUsd),
      differences: [best.variant ? `variant ${best.variant.marker}` : 'standard', ...(best.snapshot ? [`snapshot ${best.snapshot.marker}`] : []), `OpenRouter id ${best.sourceNamespace}/${best.sourceModelId}`],
      providers: deployments,
    }
  })
}

function variantName(record: OpenRouterModelRecord): string {
  return [record.displayName, record.variant?.marker, record.snapshot?.marker].filter(Boolean).join(' · ')
}

function variantSummary(record: OpenRouterModelRecord, providerCount: number): string {
  if (record.snapshot) return `OpenRouter snapshot ${record.snapshot.marker}，${providerCount} 个来源/provider 观察值。`
  if (record.variant) return `OpenRouter ${record.variant.marker} variant，${providerCount} 个来源/provider 观察值。`
  return `OpenRouter 标准记录，${providerCount} 个来源/provider 观察值。`
}

function toDeployment(record: OpenRouterModelRecord): ProviderDeployment {
  return {
    slug: record.sourceNamespace || record.brand.slug,
    name: record.brand.name,
    region: 'OpenRouter',
    uptime: '—',
    latency: '—',
    throughput: '—',
  }
}

function uniqueDeployments(deployments: ProviderDeployment[]): ProviderDeployment[] {
  const bySlug = new Map<string, ProviderDeployment>()
  for (const deployment of deployments) {
    if (!bySlug.has(deployment.slug)) bySlug.set(deployment.slug, deployment)
  }
  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function inferModalities(records: OpenRouterModelRecord[]): string[] {
  const input = new Set(records.flatMap((record) => record.metadata.inputModalities))
  const supported = new Set(records.flatMap((record) => record.metadata.supportedParameters))
  return [
    '文本',
    ...(input.has('image') ? ['视觉'] : []),
    ...(input.has('audio') ? ['音频'] : []),
    ...(input.has('video') ? ['视频'] : []),
    ...(supported.has('reasoning') ? ['推理'] : []),
    ...(supported.has('tools') ? ['工具'] : []),
    ...(supported.has('response_format') ? ['结构化输出'] : []),
  ]
}

function formatContext(value: number | null): string {
  if (!value) return '—'
  if (value >= 1_000_000) return `${Number(value / 1_000_000).toLocaleString('en-US')}M`
  if (value >= 1_000) return `${Number(value / 1_000).toLocaleString('en-US')}K`
  return value.toLocaleString('en-US')
}

function formatPrice(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} / 1M`
}

function compareReleasedDescending(a: string, b: string): number {
  return releaseSortValue(b).localeCompare(releaseSortValue(a))
}

function releaseSortValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '0000-00-00'
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
