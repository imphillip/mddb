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
    description: translateOpenRouterDescription(best.metadata.description, best.displayName, providerNames.length),
    longDescription: translateOpenRouterDescription(best.metadata.description, best.displayName, providerNames.length),
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
    officialPriceSets: records.map((record) => record.officialPriceSet),
  }
}

function translateOpenRouterDescription(description: string | null | undefined, displayName: string, providerCount: number): string {
  if (!description) return `${displayName} 由 OpenRouter 收录，并包含 ${providerCount} 个来源命名空间观察值。`
  const trimmed = description.trim()
  return `${displayName} 的 OpenRouter 模型介绍：${trimmed}`
}

function buildMetaItems(best: OpenRouterModelRecord, records: OpenRouterModelRecord[]): ModelMetaItem[] {
  const aliases = Array.from(new Set(records.flatMap((record) => record.aliases))).sort()
  const sourceIds = Array.from(new Set(records.map((record) => `${record.sourceNamespace}/${record.sourceModelId}`))).sort()
  const floatingAliases = records.map((record) => record.sourceAlias?.alias).filter((value): value is string => Boolean(value)).sort()
  return [
    { label: '规范标签', value: best.canonicalTag },
    { label: '显示名称', value: best.displayName },
    { label: '数据来源', value: best.source },
    { label: '来源命名空间', value: best.sourceNamespace },
    { label: '来源模型 ID', value: best.sourceModelId },
    { label: '来源 canonical slug', value: best.sourceCanonicalSlug },
    { label: 'OpenRouter 别名', value: aliases },
    { label: '浮动别名', value: floatingAliases },
    { label: '观察到的来源 ID', value: sourceIds },
    { label: '创建时间', value: best.metadata.created ? new Date(best.metadata.created * 1000).toISOString() : '—' },
    { label: '上下文长度', value: best.metadata.contextLength?.toLocaleString('en-US') ?? '—' },
    { label: '最大输出 token', value: best.metadata.maxCompletionTokens?.toLocaleString('en-US') ?? '—' },
    { label: '输入模态', value: best.metadata.inputModalities },
    { label: '输出模态', value: best.metadata.outputModalities },
    { label: '分词器', value: best.metadata.tokenizer ?? '—' },
    { label: '指令类型', value: best.metadata.instructType ?? '—' },
    { label: '支持参数', value: best.metadata.supportedParameters },
    { label: '支持声音', value: best.metadata.supportedVoices ?? [] },
    { label: '知识截止', value: best.metadata.knowledgeCutoff ?? '—' },
    { label: '过期日期', value: best.metadata.expirationDate ?? '—' },
    { label: 'Hugging Face ID', value: best.metadata.huggingFaceId ?? '—' },
    { label: '端点详情路径', value: best.metadata.endpointDetailsPath },
    { label: '单请求 prompt 限制', value: best.metadata.perRequestLimits?.prompt_tokens?.toLocaleString('en-US') ?? '—' },
    { label: '单请求 completion 限制', value: best.metadata.perRequestLimits?.completion_tokens?.toLocaleString('en-US') ?? '—' },
    { label: '内容审核', value: best.metadata.isModerated ? '是' : '否' },
    { label: '输入价格 / 1M USD', value: best.pricing.promptPer1mUsd.toLocaleString('en-US', { maximumFractionDigits: 6 }) },
    { label: '输出价格 / 1M USD', value: best.pricing.completionPer1mUsd.toLocaleString('en-US', { maximumFractionDigits: 6 }) },
    { label: '缓存读取 / 1M USD', value: best.pricing.cacheReadPer1mUsd?.toLocaleString('en-US', { maximumFractionDigits: 6 }) ?? '—' },
    { label: '缓存写入 / 1M USD', value: best.pricing.cacheWritePer1mUsd?.toLocaleString('en-US', { maximumFractionDigits: 6 }) ?? '—' },
    { label: '价格状态', value: best.pricing.ratioStatus },
    { label: '来源记录字段', value: Object.keys(best.sourceRecord.rawRecord).sort() },
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
      differences: [best.variant ? `变体 ${best.variant.marker}` : '标准记录', ...(best.snapshot ? [`快照 ${best.snapshot.marker}`] : []), `OpenRouter ID ${best.sourceNamespace}/${best.sourceModelId}`],
      providers: deployments,
    }
  })
}

function variantName(record: OpenRouterModelRecord): string {
  return [record.displayName, record.variant?.marker, record.snapshot?.marker].filter(Boolean).join(' · ')
}

function variantSummary(record: OpenRouterModelRecord, providerCount: number): string {
  if (record.snapshot) return `OpenRouter 快照 ${record.snapshot.marker}，${providerCount} 个来源/部署观察值。`
  if (record.variant) return `OpenRouter ${record.variant.marker} 变体，${providerCount} 个来源/部署观察值。`
  return `OpenRouter 标准记录，${providerCount} 个来源/部署观察值。`
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
