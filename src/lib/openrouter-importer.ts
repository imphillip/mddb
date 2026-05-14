import type { Brand } from './model-catalog.js'

export type OpenRouterModelsResponse = {
  data: OpenRouterModel[]
}

export type OpenRouterModel = {
  id: string
  canonical_slug: string
  name: string
  created: number | null
  description?: string | null
  context_length: number | null
  architecture: {
    modality?: string | null
    input_modalities?: string[] | null
    output_modalities?: string[] | null
    tokenizer?: string | null
    instruct_type?: string | null
  }
  pricing: {
    prompt: string
    completion: string
    request?: string
    image?: string
    image_output?: string
    image_token?: string
    audio?: string
    audio_output?: string
    input_audio_cache?: string
    input_cache_read?: string
    input_cache_write?: string
    internal_reasoning?: string
    web_search?: string
    discount?: number
  }
  top_provider: {
    context_length: number | null
    max_completion_tokens: number | null
    is_moderated: boolean
  }
  supported_parameters: string[]
  default_parameters: Record<string, unknown> | null
  supported_voices: string[] | null
  knowledge_cutoff: string | null
  expiration_date: string | null
  hugging_face_id: string | null
  links: { details: string }
  per_request_limits: { prompt_tokens: number; completion_tokens: number } | null
}

export type OpenRouterCatalog = {
  records: OpenRouterModelRecord[]
  floatingAliases: OpenRouterModelRecord[]
  skipped: Array<{ id: string; reason: string }>
}

export type OpenRouterModelRecord = {
  source: 'openrouter'
  sourceNamespace: string
  sourceModelId: string
  sourceCanonicalSlug: string
  canonicalTag: string
  displayName: string
  brand: Pick<Brand, 'slug' | 'name'>
  snapshot: { marker: string; sourceCanonicalSlug: string } | null
  variant: { marker: string; kind: string } | null
  sourceAlias: { kind: 'latest'; alias: string; stable: false; targetCanonicalTag: string | null } | null
  aliases: string[]
  metadata: {
    description: string | null
    created: number | null
    contextLength: number | null
    maxCompletionTokens: number | null
    inputModalities: string[]
    outputModalities: string[]
    tokenizer: string | null
    instructType: string | null
    supportedParameters: string[]
    defaultParameters: Record<string, unknown> | null
    supportedVoices: string[] | null
    knowledgeCutoff: string | null
    expirationDate: string | null
    huggingFaceId: string | null
    endpointDetailsPath: string
    perRequestLimits: { prompt_tokens: number; completion_tokens: number } | null
    isModerated: boolean
  }
  pricing: {
    promptPer1mUsd: number
    completionPer1mUsd: number
    cacheReadPer1mUsd?: number
    cacheWritePer1mUsd?: number
    modelRatio?: number
    completionRatio?: number
    cacheRatio?: number
    createCacheRatio?: number
    ratioStatus: 'ok' | 'free' | 'missing-prompt-baseline'
  }
  sourceRecord: {
    rawRecord: OpenRouterModel
  }
}

const VARIANT_MARKERS = new Set(['free', 'fast', 'online', 'thinking', 'preview', 'experimental', 'turbo', 'mini', 'lite', 'max', 'high', 'low'])

const BRAND_DESCRIPTIONS: Record<string, string> = {
  anthropic: 'Claude 系列，擅长代码、智能体与长文本推理。',
  openai: 'GPT 与 o 系列，多模态、工具调用和通用智能入口。',
  google: 'Gemini 与 Gemma 系列，强调长上下文、多模态与云部署。',
  qwen: 'Qwen / 通义千问系列与阿里云模型服务。',
  inclusionai: 'InclusionAI 模型与开放服务入口。',
}

export function importOpenRouterModels(response: OpenRouterModelsResponse): OpenRouterCatalog {
  const records: OpenRouterModelRecord[] = []
  const floatingAliases: OpenRouterModelRecord[] = []
  const skipped: OpenRouterCatalog['skipped'] = []

  for (const model of response.data) {
    const prompt = parsePrice(model.pricing.prompt)
    const completion = parsePrice(model.pricing.completion)
    if ((prompt === null && completion === null) || (prompt !== null && prompt < 0) || (completion !== null && completion < 0)) {
      skipped.push({ id: model.id, reason: 'negative-token-pricing' })
      continue
    }

    const [namespace, ...modelIdParts] = model.id.split('/')
    const sourceNamespace = namespace ?? ''
    const sourceModelId = modelIdParts.join('/') || (sourceNamespace === 'openrouter' ? sourceNamespace : model.id)
    const sourceAlias = sourceAliasFromModelId(model.id, sourceModelId)
    const baseIdentity = identityFromSourceId(sourceModelId)
    if (sourceNamespace === 'openrouter' && (sourceModelId === 'free' || sourceModelId === 'auto')) {
      baseIdentity.canonicalTag = `openrouter-${sourceModelId}`
    }
    const canonicalIdentity = identityFromCanonicalSlug(model.canonical_slug, sourceNamespace)
    const snapshot = canonicalIdentity.snapshot ? { marker: canonicalIdentity.snapshot, sourceCanonicalSlug: model.canonical_slug } : null
    const variant = baseIdentity.variant ? { marker: baseIdentity.variant, kind: baseIdentity.variant } : canonicalIdentity.variant ? { marker: canonicalIdentity.variant, kind: canonicalIdentity.variant } : null
    const brand = inferBrand(model, sourceNamespace)

    const record: OpenRouterModelRecord = {
      source: 'openrouter',
      sourceNamespace,
      sourceModelId,
      sourceCanonicalSlug: model.canonical_slug,
      canonicalTag: baseIdentity.canonicalTag,
      displayName: displayNameFor(model, baseIdentity.canonicalTag),
      brand,
      snapshot,
      variant,
      sourceAlias,
      aliases: Array.from(new Set([model.id, model.canonical_slug])),
      metadata: {
        description: model.description ?? null,
        created: model.created,
        contextLength: model.context_length ?? model.top_provider.context_length,
        maxCompletionTokens: model.top_provider.max_completion_tokens,
        inputModalities: model.architecture.input_modalities ?? [],
        outputModalities: model.architecture.output_modalities ?? [],
        tokenizer: model.architecture.tokenizer ?? null,
        instructType: model.architecture.instruct_type ?? null,
        supportedParameters: model.supported_parameters,
        defaultParameters: model.default_parameters,
        supportedVoices: model.supported_voices,
        knowledgeCutoff: model.knowledge_cutoff,
        expirationDate: model.expiration_date,
        huggingFaceId: model.hugging_face_id,
        endpointDetailsPath: model.links.details,
        perRequestLimits: model.per_request_limits,
        isModerated: model.top_provider.is_moderated,
      },
      pricing: derivePricing(prompt ?? 0, completion ?? 0, parsePrice(model.pricing.input_cache_read), parsePrice(model.pricing.input_cache_write)),
      sourceRecord: { rawRecord: model },
    }
    if (record.sourceAlias) floatingAliases.push(record)
    else records.push(record)
  }

  return { records, floatingAliases, skipped }
}

function identityFromSourceId(sourceModelId: string): { canonicalTag: string; variant: string | null } {
  let normalized = normalizeTag(sourceModelId)
  let variant: string | null = null
  const parts = normalized.split('-').filter(Boolean)
  const last = parts.at(-1)
  if (last && VARIANT_MARKERS.has(last) && parts.length > 1) {
    variant = last
    parts.pop()
    normalized = parts.join('-')
  }
  normalized = stripTrailingSnapshot(normalized).value
  normalized = normalizeClaudeOrder(normalized)
  return { canonicalTag: normalized, variant }
}

function identityFromCanonicalSlug(canonicalSlug: string, namespace: string): { snapshot: string | null; variant: string | null } {
  let value = canonicalSlug.includes('/') ? canonicalSlug.split('/').slice(1).join('/') : canonicalSlug
  if (namespace && value.startsWith(`${namespace}-`)) value = value.slice(namespace.length + 1)
  let normalized = normalizeTag(value)
  const snapshotResult = stripTrailingSnapshot(normalized)
  normalized = snapshotResult.value
  const parts = normalized.split('-').filter(Boolean)
  const last = parts.at(-1)
  const variant = last && VARIANT_MARKERS.has(last) ? last : null
  return { snapshot: snapshotResult.snapshot, variant }
}

function stripTrailingSnapshot(value: string): { value: string; snapshot: string | null } {
  const dashed = value.match(/^(.*)-(\d{4})-(\d{2})-(\d{2})$/)
  if (dashed) return { value: dashed[1]!, snapshot: `${dashed[2]}-${dashed[3]}-${dashed[4]}` }
  const compact = value.match(/^(.*)-(\d{8})$/)
  if (compact) return { value: compact[1]!, snapshot: compact[2]! }
  return { value, snapshot: null }
}

function normalizeClaudeOrder(value: string): string {
  return value.replace(/^claude-(\d+)-(\d+)-(haiku|sonnet|opus)$/u, 'claude-$3-$1-$2')
}

function sourceAliasFromModelId(sourceId: string, sourceModelId: string): OpenRouterModelRecord['sourceAlias'] {
  const normalized = normalizeTag(sourceModelId)
  if (!normalized.endsWith('-latest')) return null
  return { kind: 'latest', alias: sourceId, stable: false, targetCanonicalTag: null }
}

function inferBrand(model: OpenRouterModel, namespace: string): Pick<Brand, 'slug' | 'name'> {
  const namePrefix = model.name.includes(':') ? model.name.split(':')[0]!.trim() : ''
  const normalizedNamespace = normalizeBrandText(namespace)
  const inferredName = namePrefix || inferBrandNameFromUntypedDisplayName(model.name, normalizedNamespace) || titleCase(normalizedNamespace || 'Unknown')
  const normalizedName = normalizeBrandName(inferredName)
  const slug = normalizeTag(normalizedName || normalizedNamespace || 'unknown') || 'unknown'
  return { slug, name: normalizedName }
}

function normalizeBrandText(value: string): string {
  return value.replace(/^~+/u, '').trim()
}

function normalizeBrandName(value: string): string {
  const cleaned = normalizeBrandText(value)
  const aliases: Record<string, string> = {
    anthropic: 'Anthropic',
    moonshotai: 'MoonshotAI',
    openai: 'OpenAI',
    google: 'Google',
    'baidu qianfan': 'Baidu',
    'bytedance seed': 'ByteDance',
    llama: 'Meta',
    'meta llama': 'Meta',
    mistralai: 'Mistral',
    nous: 'NousResearch',
  }
  return aliases[cleaned.toLowerCase()] ?? cleaned
}

function inferBrandNameFromUntypedDisplayName(name: string, namespace: string): string {
  const normalizedName = normalizeBrandText(name)
  const normalizedNamespace = normalizeBrandText(namespace)
  if (!normalizedName || !normalizedNamespace) return ''
  const namespaceWords = normalizedNamespace.replace(/[-_]+/gu, ' ').trim().split(/\s+/u).filter(Boolean)
  if (namespaceWords.length === 0) return ''
  const firstWords = normalizedName.split(/\s+/u).slice(0, namespaceWords.length).join(' ')
  if (normalizeTag(firstWords) === normalizeTag(normalizedNamespace)) return firstWords
  return ''
}

function displayNameFor(model: OpenRouterModel, canonicalTag: string): string {
  const raw = model.name.includes(':') ? model.name.split(':').slice(1).join(':').trim() : model.name
  const noParens = raw.replace(/\s*\((?:free|fast|online|thinking|preview|experimental|turbo|mini|lite|max|high|low)\)\s*$/iu, '').trim()
  if (noParens) return normalizeDisplayName(noParens)
  return normalizeDisplayName(canonicalTag)
}

function normalizeDisplayName(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase())
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bClaude\s+(Haiku|Sonnet|Opus)\s+(\d+)\.(\d+)\b/gi, (_match, family, major, minor) => `Claude ${titleCase(family)} ${major}.${minor}`)
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b[a-z]/g, (match) => match.toUpperCase())
}

function normalizeTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/@[^/]+$/g, '')
    .replace(/:/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parsePrice(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function derivePricing(prompt: number, completion: number, cacheRead: number | null, cacheWrite: number | null): OpenRouterModelRecord['pricing'] {
  const pricing: OpenRouterModelRecord['pricing'] = {
    promptPer1mUsd: roundPrice(prompt * 1_000_000),
    completionPer1mUsd: roundPrice(completion * 1_000_000),
    ratioStatus: prompt === 0 && completion > 0 ? 'missing-prompt-baseline' : prompt === 0 && completion === 0 ? 'free' : 'ok',
  }
  if (cacheRead !== null) pricing.cacheReadPer1mUsd = roundPrice(cacheRead * 1_000_000)
  if (cacheWrite !== null) pricing.cacheWritePer1mUsd = roundPrice(cacheWrite * 1_000_000)
  if (prompt > 0) {
    pricing.modelRatio = roundPrice(prompt * 500_000)
    pricing.completionRatio = roundPrice(completion / prompt)
    if (cacheRead !== null) pricing.cacheRatio = roundPrice(cacheRead / prompt)
    if (cacheWrite !== null) pricing.createCacheRatio = roundPrice(cacheWrite / prompt)
  } else if (prompt === 0 && completion === 0) {
    pricing.modelRatio = 0
  }
  return pricing
}

function roundPrice(value: number): number {
  return Number(value.toPrecision(12))
}

export function brandDescription(slug: string): string {
  return BRAND_DESCRIPTIONS[slug] ?? 'OpenRouter 模型目录中的模型厂牌。'
}
