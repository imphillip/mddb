import { existsSync, readFileSync } from 'node:fs'
import type { Brand, ModelDetail, ModelGallery, ModelSummary, ModelVariant } from './model-catalog.js'
import { resolveModelsDevIdentity } from './model-identity.js'

export type ModelsDevIndexProvider = {
  id: string
  name: string
  modelCount: number
  api?: string
  doc?: string
  iconURL?: string
}

export type ModelsDevIndexModel = {
  id: string
  name: string
  providerId: string
  updated?: string
  inputPrice?: number | undefined
  outputPrice?: number | undefined
  cacheReadPrice?: number | undefined
  cacheWritePrice?: number | undefined
  contextWindow?: number | undefined
  outputLimit?: number | undefined
  inputModalities?: string[] | undefined
  outputModalities?: string[] | undefined
  family?: string | undefined
  knowledge?: string | undefined
  releaseDate?: string | undefined
  openWeights?: boolean | undefined
  temperature?: boolean | undefined
  structuredOutput?: boolean | undefined
  rawRecord?: Record<string, unknown> | undefined
  flags: {
    attachment: boolean
    reasoning: boolean
    tool_call: boolean
  }
}

export type ModelsDevIndex = {
  providers: ModelsDevIndexProvider[]
  models: ModelsDevIndexModel[]
}

export type ModelsDevGallery = ModelGallery & {
  details: ModelDetail[]
  source: {
    path: string
    modelRows: number
    providerRows: number
  }
}

export type ModelsDevGalleryOptions = {
  sourcePath: string
}

type CanonicalModelGroup = {
  tag: string
  displayName: string
  brand: Brand
  models: ModelsDevIndexModel[]
  brandLogoUrl?: string | undefined
}

type VersionGroup = {
  id: string
  displayName: string
  snapshot: string | null
  models: ModelsDevIndexModel[]
}

type ModelsDevPricing = {
  inputPrice: string
  outputPrice: string
  contextWindow: string
}

const UNKNOWN_BRAND: Brand = {
  slug: 'other',
  name: 'Other',
  description: 'models.dev 本地索引中的其他模型厂牌。',
}

const BRAND_RULES: Array<{ slug: string; name: string; aliases: string[]; description: string }> = [
  { slug: 'openai', name: 'OpenAI', aliases: ['openai', 'gpt', 'chatgpt', 'o1', 'o3', 'o4'], description: 'GPT、o 系列与 OpenAI 多模态模型。' },
  { slug: 'anthropic', name: 'Anthropic', aliases: ['anthropic', 'claude'], description: 'Claude 系列，擅长代码、智能体与长文本推理。' },
  { slug: 'google', name: 'Google', aliases: ['google', 'gemini', 'gemma'], description: 'Gemini 与 Gemma 系列，强调长上下文、多模态与云部署。' },
  { slug: 'deepseek', name: 'DeepSeek', aliases: ['deepseek'], description: '高性价比推理与代码模型，开放权重生态活跃。' },
  { slug: 'meta', name: 'Meta', aliases: ['meta', 'llama'], description: 'Llama 开放模型家族，适合私有化与多云托管。' },
  { slug: 'alibaba', name: 'Alibaba', aliases: ['alibaba', 'qwen', 'qwq', 'qvq', 'tongyi'], description: 'Qwen / 通义千问系列与阿里云模型服务。' },
  { slug: 'mistral', name: 'Mistral AI', aliases: ['mistral', 'mixtral', 'codestral'], description: 'Mistral、Mixtral 与 Codestral 开放及商用模型。' },
  { slug: 'xai', name: 'xAI', aliases: ['xai', 'grok'], description: 'Grok 系列模型。' },
  { slug: 'moonshot', name: 'Moonshot AI', aliases: ['moonshot', 'kimi'], description: 'Kimi / Moonshot 长上下文模型。' },
  { slug: 'zhipu', name: 'Zhipu AI', aliases: ['zhipu', 'glm'], description: 'GLM / 智谱模型系列。' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadModelsDevIndexFromFile(sourcePath: string): ModelsDevIndex {
  if (!existsSync(sourcePath)) {
    throw new Error(`models.dev local index not found: ${sourcePath}`)
  }
  const parsed: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'))
  if (isRecord(parsed) && Array.isArray(parsed.providers) && Array.isArray(parsed.models)) {
    return {
      providers: parsed.providers.filter(isModelsDevProvider),
      models: parsed.models.filter(isModelsDevModel),
    }
  }
  if (isRecord(parsed)) {
    const providers = Object.values(parsed).map(normalizeModelsDevApiProvider).filter((value): value is ModelsDevIndexProvider => value !== null)
    const models = providers.flatMap((provider) => {
      const rawProvider = parsed[provider.id]
      if (!isRecord(rawProvider) || !isRecord(rawProvider.models)) return []
      return Object.values(rawProvider.models).map((model) => normalizeModelsDevApiModel(model, provider.id)).filter((value): value is ModelsDevIndexModel => value !== null)
    })
    return { providers, models }
  }
  throw new Error(`models.dev local index has unsupported shape: ${sourcePath}`)
}

export function buildModelGalleryFromModelsDevFile(sourcePath: string): ModelsDevGallery {
  return buildModelGalleryFromModelsDevIndex(loadModelsDevIndexFromFile(sourcePath), { sourcePath })
}

export function buildModelGalleryFromModelsDevIndex(index: ModelsDevIndex, options: ModelsDevGalleryOptions): ModelsDevGallery {
  const providers = new Map(index.providers.map((provider) => [provider.id, provider]))
  const grouped = new Map<string, CanonicalModelGroup>()

  for (const model of index.models) {
    const tag = canonicalTagForModelsDevModel(model)
    const brand = inferBrand(model)
    const brandLogoUrl = providerLogoUrl(providers.get(brand.slug)) ?? (brand.slug === model.providerId ? providerLogoUrl(providers.get(model.providerId)) : undefined)
    const existing = grouped.get(tag)
    if (existing === undefined) {
      grouped.set(tag, { tag, displayName: normalizeDisplayName(model.name || model.id), brand: { ...brand, logoUrl: brandLogoUrl }, models: [model], brandLogoUrl })
    } else {
      existing.models.push(model)
      existing.displayName = chooseDisplayName(existing.displayName, model.name || model.id)
      if (existing.brand.slug === UNKNOWN_BRAND.slug && brand.slug !== UNKNOWN_BRAND.slug) {
        existing.brand = { ...brand, logoUrl: brandLogoUrl }
        existing.brandLogoUrl = brandLogoUrl
      } else if (existing.brand.logoUrl === undefined && existing.brand.slug === brand.slug && brandLogoUrl !== undefined) {
        existing.brand.logoUrl = brandLogoUrl
        existing.brandLogoUrl = brandLogoUrl
      }
    }
  }

  const details = Array.from(grouped.values())
    .map((group) => toModelDetail(group, providers))
    .sort((a, b) => compareReleasedDescending(a.releasedAt, b.releasedAt) || a.name.localeCompare(b.name))
  const models = details.map(toSummary)
  const brandMap = new Map<string, Brand & { models: ModelSummary[] }>()
  for (const model of models) {
    const current = brandMap.get(model.brand.slug)
    if (current === undefined) {
      brandMap.set(model.brand.slug, { ...model.brand, models: [model] })
    } else {
      current.models.push(model)
    }
  }
  const brands = Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  const providerCount = new Set(index.models.map((model) => model.providerId)).size
  const variantCount = details.reduce((sum, detail) => sum + detail.variants.length, 0)

  return {
    brands,
    models,
    details,
    source: {
      path: options.sourcePath,
      modelRows: index.models.length,
      providerRows: index.providers.length,
    },
    stats: {
      modelCount: models.length,
      brandCount: brands.length,
      providerCount,
      variantCount,
    },
  }
}

function isModelsDevProvider(value: unknown): value is ModelsDevIndexProvider {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.modelCount === 'number' &&
    (value.iconURL === undefined || typeof value.iconURL === 'string')
  )
}

function normalizeModelsDevApiProvider(value: unknown): ModelsDevIndexProvider | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  const models = isRecord(value.models) ? value.models : {}
  const provider: ModelsDevIndexProvider = { id: value.id, name: value.name, modelCount: Object.keys(models).length }
  if (typeof value.iconURL === 'string') provider.iconURL = value.iconURL
  return provider
}

function normalizeModelsDevApiModel(value: unknown, providerId: string): ModelsDevIndexModel | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  const name = typeof value.name === 'string' ? value.name : value.id
  const model: ModelsDevIndexModel = {
    id: value.id,
    name,
    providerId,
    flags: {
      attachment: Boolean(value.attachment),
      reasoning: Boolean(value.reasoning),
      tool_call: Boolean(value.tool_call),
    },
  }
  const updated = typeof value.last_updated === 'string' ? value.last_updated : typeof value.release_date === 'string' ? value.release_date : undefined
  if (updated !== undefined) model.updated = updated
  if (typeof value.release_date === 'string') model.releaseDate = value.release_date
  if (typeof value.family === 'string') model.family = value.family
  if (typeof value.knowledge === 'string') model.knowledge = value.knowledge
  if (typeof value.open_weights === 'boolean') model.openWeights = value.open_weights
  if (typeof value.temperature === 'boolean') model.temperature = value.temperature
  if (typeof value.structured_output === 'boolean') model.structuredOutput = value.structured_output
  const modalities = isRecord(value.modalities) ? value.modalities : {}
  const inputModalities = readStringArray(modalities.input)
  const outputModalities = readStringArray(modalities.output)
  if (inputModalities !== undefined) model.inputModalities = inputModalities
  if (outputModalities !== undefined) model.outputModalities = outputModalities
  const cost = isRecord(value.cost) ? value.cost : {}
  const inputPrice = readNumber(cost.input)
  const outputPrice = readNumber(cost.output)
  const cacheReadPrice = readNumber(cost.cache_read)
  const cacheWritePrice = readNumber(cost.cache_write)
  if (inputPrice !== undefined) model.inputPrice = inputPrice
  if (outputPrice !== undefined) model.outputPrice = outputPrice
  if (cacheReadPrice !== undefined) model.cacheReadPrice = cacheReadPrice
  if (cacheWritePrice !== undefined) model.cacheWritePrice = cacheWritePrice
  const limit = isRecord(value.limit) ? value.limit : {}
  const contextWindow = readNumber(limit.context)
  const outputLimit = readNumber(limit.output)
  if (contextWindow !== undefined) model.contextWindow = contextWindow
  if (outputLimit !== undefined) model.outputLimit = outputLimit
  model.rawRecord = value
  return model
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined
}

function isModelsDevModel(value: unknown): value is ModelsDevIndexModel {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.providerId === 'string' &&
    isRecord(value.flags) &&
    typeof value.flags.attachment === 'boolean' &&
    typeof value.flags.reasoning === 'boolean' &&
    typeof value.flags.tool_call === 'boolean'
  )
}

function canonicalTagForModelsDevModel(model: ModelsDevIndexModel): string {
  return resolveModelsDevIdentity(model).canonicalTag
}

function versionInfoForModelsDevModel(model: ModelsDevIndexModel): { canonicalTag: string; versionId: string; snapshot: string | null } {
  const identity = resolveModelsDevIdentity(model)
  const versionId = identity.snapshot ? identity.versionId : isAnthropicClaudeOpus(identity.canonicalTag) ? `${identity.canonicalTag}-thinking` : identity.versionId
  return {
    canonicalTag: identity.canonicalTag,
    versionId,
    snapshot: identity.snapshot?.marker ?? null,
  }
}

function inferBrand(model: ModelsDevIndexModel): Brand {
  const searchable = `${model.providerId} ${model.id} ${model.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const rule = BRAND_RULES.find((candidate) => candidate.aliases.some((alias) => searchable.includes(alias.toLowerCase().replace(/[^a-z0-9]+/g, '-'))))
  if (rule === undefined) {
    return UNKNOWN_BRAND
  }
  return { slug: rule.slug, name: rule.name, description: rule.description }
}

function providerLogoUrl(provider: ModelsDevIndexProvider | undefined): string | undefined {
  return provider?.iconURL ?? (provider === undefined ? undefined : `https://models.dev/logos/${provider.id}.svg`)
}

function normalizeDisplayName(value: string): string {
  return value
    .replace(/^[A-Za-z]+:\s*/, '')
    .replace(/(?<=[a-zA-Z])-(?=\d{4})/g, ' ')
    .replace(/(?<=\d{4})-(?=\d)/g, ' ')
    .replace(/(?<=\d{2})-(?=\d{2}\b)/g, ' ')
    .replace(/(?<=\d{2})-(?=[a-zA-Z])/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bR1\b/g, 'R1')
}

function chooseDisplayName(current: string, next: string): string {
  const normalizedNext = normalizeDisplayName(next)
  const currentScore = displayNameScore(current)
  const nextScore = displayNameScore(normalizedNext)
  return nextScore > currentScore ? normalizedNext : current
}

function displayNameScore(value: string): number {
  let score = 100 - value.length
  if (!value.includes('/')) score += 8
  if (!/\d{4}/.test(value)) score += 20
  if (/^[A-Z0-9 ._-]+$/.test(value)) score += 3
  if (/\b(GPT|Claude|Gemini|DeepSeek|Llama|Qwen)\b/.test(value)) score += 10
  return score
}

function toModelDetail(group: CanonicalModelGroup, providers: Map<string, ModelsDevIndexProvider>): ModelDetail {
  const providerNames = Array.from(new Set(group.models.map((model) => providers.get(model.providerId)?.name ?? model.providerId))).sort()
  const variants = versionGroupsFor(group.models)
    .sort((a, b) => Number(Boolean(b.snapshot)) - Number(Boolean(a.snapshot)) || a.displayName.localeCompare(b.displayName))
    .map((versionGroup) => toVariant(versionGroup, providers))
  const releasedAt = earliestUpdatedDate(group.models) ?? '—'
  const modalities = inferModalities(group.models)

  return {
    tag: group.tag,
    route: `/${group.tag}`,
    name: group.displayName,
    brand: group.brand,
    description: `${group.displayName} 在 models.dev 本地索引中收录了 ${providerNames.length} 个 provider 部署。`,
    longDescription: `${group.displayName} 页面由参考库里的 models.dev 静态索引生成，provider 会作为同一规范模型下的部署属性展示。`,
    modalities,
    ...pricingForModels(group.models),
    providerNames,
    variantCount: variants.length,
    weeklyTokens: '—',
    releasedAt,
    apiIdentifier: group.tag,
    variants,
    benchmarks: [],
    meta: [
      { label: 'Canonical tag', value: group.tag },
      { label: 'Display name', value: group.displayName },
      { label: 'Source', value: 'models.dev' },
      { label: 'Provider names', value: providerNames },
      { label: 'Source model ids', value: Array.from(new Set(group.models.map((model) => model.id))).sort() },
      { label: 'Source provider ids', value: Array.from(new Set(group.models.map((model) => model.providerId))).sort() },
      ...modelsDevMetaItems(group.models, modalities),
      { label: 'Updated dates', value: Array.from(new Set(group.models.map((model) => model.updated).filter((value): value is string => Boolean(value)))).sort() },
    ],
    officialPriceSets: [],
  }
}

function compareReleasedDescending(a: string, b: string): number {
  return releaseSortValue(b).localeCompare(releaseSortValue(a))
}

function releaseSortValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '0000-00-00'
}

function versionGroupsFor(models: ModelsDevIndexModel[]): VersionGroup[] {
  const groups = new Map<string, VersionGroup>()
  for (const model of models) {
    const versionInfo = versionInfoForModelsDevModel(model)
    const displayName = displayNameForVersion(model, versionInfo.versionId)
    const current = groups.get(versionInfo.versionId)
    const existingCanonicalClaudeOpus = isAnthropicClaudeOpus(versionInfo.canonicalTag) && versionInfo.snapshot === null && versionInfo.versionId !== versionInfo.canonicalTag
      ? groups.get(versionInfo.canonicalTag)
      : undefined
    if (existingCanonicalClaudeOpus) {
      groups.delete(versionInfo.canonicalTag)
      existingCanonicalClaudeOpus.id = versionInfo.versionId
      existingCanonicalClaudeOpus.models.push(model)
      existingCanonicalClaudeOpus.displayName = displayName
      groups.set(versionInfo.versionId, existingCanonicalClaudeOpus)
      continue
    }
    const firstAnthropicClaudeOpus = isAnthropicClaudeOpus(versionInfo.canonicalTag)
      ? groups.get(`${versionInfo.canonicalTag}-thinking`) ?? (versionInfo.versionId !== versionInfo.canonicalTag ? groups.get(versionInfo.canonicalTag) : undefined)
      : undefined
    if (firstAnthropicClaudeOpus && versionInfo.snapshot === null) {
      firstAnthropicClaudeOpus.models.push(model)
      firstAnthropicClaudeOpus.displayName = chooseDisplayName(firstAnthropicClaudeOpus.displayName, displayName)
      continue
    }
    if (current === undefined) {
      groups.set(versionInfo.versionId, { id: versionInfo.versionId, displayName, snapshot: versionInfo.snapshot, models: [model] })
    } else {
      current.models.push(model)
      current.displayName = chooseDisplayName(current.displayName, displayName)
    }
  }
  return Array.from(groups.values())
}

function isAnthropicClaudeOpus(canonicalTag: string): boolean {
  return /^claude-opus-\d+-\d+$/.test(canonicalTag)
}

function displayNameForVersion(model: ModelsDevIndexModel, versionId: string): string {
  if (/^claude-opus-\d+-\d+-thinking$/.test(versionId)) {
    return 'Claude Opus ' + versionId.match(/^claude-opus-(\d+)-(\d+)-thinking$/)!.slice(1).join('.') + ' Thinking'
  }
  return normalizeDisplayName(model.name || model.id)
}

function toVariant(versionGroup: VersionGroup, providers: Map<string, ModelsDevIndexProvider>): ModelVariant {
  const deployments = uniqueDeployments(
    versionGroup.models
      .slice()
      .sort((a, b) => providerName(a.providerId, providers).localeCompare(providerName(b.providerId, providers)) || a.id.localeCompare(b.id))
      .map((model) => {
        const provider = providers.get(model.providerId)
        return {
          slug: model.providerId,
          name: provider?.name ?? model.providerId,
          logoUrl: providerLogoUrl(provider),
          region: '—',
          uptime: '—',
          latency: '—',
          throughput: '—',
        }
      }),
  )
  const updatedDates = Array.from(new Set(versionGroup.models.map((model) => model.updated).filter((value): value is string => Boolean(value)))).sort()
  return {
    id: versionGroup.id,
    name: versionGroup.displayName,
    summary: versionGroup.snapshot ? `snapshot 版本 ${versionGroup.displayName}。` : `同一模型版本在 ${deployments.length} 个 provider 上可用。`,
    ...pricingForModels(versionGroup.models),
    differences: [versionGroup.snapshot ? `快照 ${versionGroup.snapshot}` : versionGroup.id, ...modelsDevDifferenceItems(versionGroup.models), ...updatedDates.map((date) => `更新日期 ${date}`)],
    providers: deployments,
  }
}

function uniqueDeployments(deployments: ModelVariant['providers']): ModelVariant['providers'] {
  const bySlug = new Map<string, ModelVariant['providers'][number]>()
  for (const deployment of deployments) {
    if (!bySlug.has(deployment.slug)) {
      bySlug.set(deployment.slug, deployment)
    }
  }
  return Array.from(bySlug.values())
}

function providerName(providerId: string, providers: Map<string, ModelsDevIndexProvider>): string {
  return providers.get(providerId)?.name ?? providerId
}

function earliestUpdatedDate(models: ModelsDevIndexModel[]): string | null {
  const dates = models.map((model) => model.updated).filter((value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value !== '1970-01-01')
  if (dates.length === 0) return null
  return dates.sort()[0]!
}

function inferModalities(models: ModelsDevIndexModel[]): string[] {
  const flags = models.reduce(
    (acc, model) => ({
      attachment: acc.attachment || model.flags.attachment,
      reasoning: acc.reasoning || model.flags.reasoning,
      tool_call: acc.tool_call || model.flags.tool_call,
    }),
    { attachment: false, reasoning: false, tool_call: false },
  )
  return ['文本', ...(flags.attachment ? ['视觉'] : []), ...(flags.reasoning ? ['推理'] : []), ...(flags.tool_call ? ['工具'] : [])]
}



function modelsDevMetaItems(models: ModelsDevIndexModel[], fallbackModalities: string[]): Array<{ label: string; value: string | string[] }> {
  return [
    { label: '输入模态', value: uniqueStrings(models.flatMap((model) => model.inputModalities ?? [])).length > 0 ? uniqueStrings(models.flatMap((model) => model.inputModalities ?? [])) : fallbackModalities },
    { label: '输出模态', value: uniqueStrings(models.flatMap((model) => model.outputModalities ?? [])) },
    { label: '模型家族', value: uniqueStrings(models.map((model) => model.family).filter((value): value is string => Boolean(value))) },
    { label: '知识截止', value: uniqueStrings(models.map((model) => model.knowledge).filter((value): value is string => Boolean(value))) },
    { label: '发布日期', value: uniqueStrings(models.map((model) => model.releaseDate).filter((value): value is string => Boolean(value))) },
    { label: '输出 token 限制', value: uniqueStrings(models.map((model) => model.outputLimit).filter((value): value is number => value !== undefined).map((value) => value.toLocaleString('en-US'))) },
    { label: '缓存读取价格', value: uniqueStrings(models.map((model) => model.cacheReadPrice).filter((value): value is number => value !== undefined).map(formatPrice)) },
    { label: '缓存写入价格', value: uniqueStrings(models.map((model) => model.cacheWritePrice).filter((value): value is number => value !== undefined).map(formatPrice)) },
    { label: '开放权重', value: booleanSummary(models.map((model) => model.openWeights)) },
    { label: '温度控制', value: booleanSummary(models.map((model) => model.temperature)) },
    { label: '结构化输出', value: booleanSummary(models.map((model) => model.structuredOutput)) },
  ]
}

function modelsDevDifferenceItems(models: ModelsDevIndexModel[]): string[] {
  const items: string[] = []
  const families = uniqueStrings(models.map((model) => model.family).filter((value): value is string => Boolean(value)))
  const knowledge = uniqueStrings(models.map((model) => model.knowledge).filter((value): value is string => Boolean(value)))
  const outputLimits = uniqueStrings(models.map((model) => model.outputLimit).filter((value): value is number => value !== undefined).map((value) => value.toLocaleString('en-US')))
  if (families.length > 0) items.push(`模型家族 ${families.join(' / ')}`)
  if (knowledge.length > 0) items.push(`知识截止 ${knowledge.join(' / ')}`)
  if (outputLimits.length > 0) items.push(`输出限制 ${outputLimits.join(' / ')}`)
  const openWeights = booleanSummary(models.map((model) => model.openWeights))
  if (openWeights !== '—') items.push(`开放权重 ${openWeights}`)
  return items
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
}

function booleanSummary(values: Array<boolean | undefined>): string {
  const defined = values.filter((value): value is boolean => typeof value === 'boolean')
  if (defined.length === 0) return '—'
  const unique = Array.from(new Set(defined))
  if (unique.length > 1) return '混合'
  return unique[0] ? '是' : '否'
}

function pricingForModels(models: ModelsDevIndexModel[]): ModelsDevPricing {
  const inputPrice = firstNumber(models.map((model) => model.inputPrice))
  const outputPrice = firstNumber(models.map((model) => model.outputPrice))
  const contextWindow = firstNumber(models.map((model) => model.contextWindow))
  return {
    inputPrice: formatPrice(inputPrice),
    outputPrice: formatPrice(outputPrice),
    contextWindow: contextWindow === undefined ? '—' : contextWindow.toLocaleString('en-US'),
  }
}

function firstNumber(values: Array<number | undefined>): number | undefined {
  return values.find((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

function formatPrice(value: number | undefined): string {
  return value === undefined ? '—' : `$${formatNumber(value)} / 1M`
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : Number(value.toFixed(6)).toString()
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
