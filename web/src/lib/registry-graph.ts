import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OpenRouterRawGraph, OpenRouterRawNode, OpenRouterRawEdge, PricingObservation, ProviderObservation } from './openrouter-raw-graph.js'

type JsonRecord = Record<string, unknown>

type RegistryModel = {
  id: string
  model?: string
  alias?: string[]
  author?: string
  input_modalities?: string[]
  output_modalities?: string[]
  reasoning?: boolean
  tool_calling?: boolean
  context_length?: number | null
  max_output_tokens?: number | null
  release_timestamp?: number | string | null
  other_parameters?: JsonRecord
  last_updated?: string
  sources?: JsonRecord[]
}

type RegistryPrice = {
  conditions?: JsonRecord
  prices?: Record<string, { amount?: number; unit?: string }>
  currency?: string
  source?: string
  observed_at?: string
  raw_pricing?: JsonRecord
}

type RegistryOffer = {
  model_id?: string
  model?: string
  endpoint_path?: string
  api_model_id?: string
  mode?: string
  prices?: RegistryPrice[]
  other_parameters?: JsonRecord
  sources?: JsonRecord[]
}

type RegistryProvider = {
  schema_version?: number
  id: string
  provider?: string
  currency?: string
  offers?: RegistryOffer[]
  other_parameters?: JsonRecord
  last_updated?: string
  sources?: JsonRecord[]
}

export function buildRegistryGraphFromFiles(root = process.cwd()): OpenRouterRawGraph {
  const modelsPath = join(root, 'data', 'models.json')
  const providersDir = join(root, 'data', 'providers')
  const modelsPayload = readJson(modelsPath) as { schema_version?: number; models?: RegistryModel[] }
  const models = Array.isArray(modelsPayload.models) ? modelsPayload.models : []
  const providers = existsSync(providersDir)
    ? readdirSync(providersDir).filter((name) => name.endsWith('.json')).map((name) => readJson(join(providersDir, name)) as RegistryProvider).sort((a, b) => a.id.localeCompare(b.id))
    : []

  const sourceNodes = models.map((model) => makeSourceNode(model))
  const sourceRoutes = new Set(sourceNodes.map((node) => node.route))
  const sourceByModelId = new Map(sourceNodes.map((node) => [node.modelId, node]))
  const sourceByAlias = new Map<string, OpenRouterRawNode>()
  for (const model of models) {
    const node = sourceByModelId.get(model.id)
    if (!node) continue
    sourceByAlias.set(model.id.toLowerCase(), node)
    for (const alias of model.alias ?? []) sourceByAlias.set(alias.toLowerCase(), node)
  }

  const endpointNodes: OpenRouterRawNode[] = []
  const edges: OpenRouterRawEdge[] = []
  const pricing: PricingObservation[] = []
  const providerObservations: ProviderObservation[] = []
  const endpointNodeById = new Map<string, OpenRouterRawNode>()

  for (const provider of providers) {
    for (const offer of provider.offers ?? []) {
      const target = sourceByAlias.get(String(offer.other_parameters?.source_model_id ?? '').toLowerCase())
        ?? sourceByAlias.get(String(offer.model_id ?? '').toLowerCase())
        ?? sourceByAlias.get(String(offer.model ?? '').toLowerCase())
      if (!target) continue
      const endpoint = endpointFromOffer(provider, offer)
      const endpointNode = makeEndpointNode(provider, offer, target, endpoint, sourceRoutes)
      if (!endpointNodeById.has(endpointNode.id)) endpointNodeById.set(endpointNode.id, endpointNode)
      edges.push({ id: `edge:${endpointNode.id}:deployment_of:${target.id}`, from: endpointNode.id, to: target.id, type: 'deployment_of', label: `provider ${provider.provider ?? provider.id} offers ${target.sourceId}`, raw: { provider: provider.id, offer } })
      edges.push({ id: `edge:${target.id}:has_endpoint:${endpointNode.id}`, from: target.id, to: endpointNode.id, type: 'has_endpoint', label: `${provider.provider ?? provider.id} · ${offer.api_model_id ?? offer.model_id ?? target.modelId}`, raw: offer })
      providerObservations.push({ id: `provider:registry:${target.sourceId}:${normalizeSlug(provider.id)}`, source: 'openrouter', providerName: provider.provider ?? provider.id, relation: 'deployment_of', targetSourceId: target.sourceId, confidence: 'provider_observation', provenance: { providerId: provider.id, apiModelId: offer.api_model_id, sourceModelId: offer.other_parameters?.source_model_id } })
      for (const obs of pricingObservationsFromOffer(target.sourceId, provider, offer)) pricing.push(obs)
    }
  }
  endpointNodes.push(...Array.from(endpointNodeById.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId)))
  const nodes = [...sourceNodes, ...endpointNodes]
  const providerRows = providers.map((provider) => ({ id: normalizeSlug(provider.id), name: provider.provider ?? titleize(provider.id), currency: provider.currency ?? 'USD', raw: provider as unknown as Record<string, unknown> }))

  return {
    generatedAt: new Date().toISOString(),
    schema: { urlShape: '/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    graphModel: { version: 'v2-observation-graph', identityBoundary: 'openrouter-source-id', pricingPolicy: 'provider-specific-observations-preserve-billing-mode', provenancePolicy: 'facts-are-nodes-or-observations-with-source-links' },
    source: { modelsPath, endpointsPath: providersDir, sitemapPath: '', pagesPath: '' },
    stats: {
      apiModels: models.length,
      sitemapModelPages: models.length,
      pageOnlyModels: 0,
      endpointWrappers: providers.reduce((sum, provider) => sum + (provider.offers?.length ?? 0), 0),
      endpointRows: endpointNodes.length,
      pricingObservations: pricing.length,
      providerObservations: providerObservations.length,
      sourceNodes: sourceNodes.length,
      endpointNodes: endpointNodes.length,
      pageRows: 0,
      nodes: nodes.length,
      edges: edges.length,
    },
    providers: providerRows,
    nodes,
    edges,
    indices: {
      bySourceId: Object.fromEntries(nodes.map((node) => [node.sourceId, node.id])),
      byRoute: Object.fromEntries(nodes.map((node) => [node.route, node.id])),
      pageOnlyNodeIds: [],
      apiNodeIds: sourceNodes.map((node) => node.id),
    },
    observations: { pricing: dedupeById(pricing), providers: dedupeById(providerObservations) },
  }
}

function makeSourceNode(model: RegistryModel): OpenRouterRawNode {
  const provider = normalizeSlug(model.author ?? model.id.split('/')[0] ?? 'unknown')
  const modelId = model.id
  const route = `/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`
  const sourceId = primarySourceId(model)
  const sourceUrl = primarySourceUrl(model, sourceId)
  return {
    id: nodeIdForSource(model.id),
    nodeKind: 'source_model',
    dataSource: 'openrouter',
    provider,
    providerName: titleize(provider),
    modelId,
    route,
    urlProvider: encodeURIComponent(provider),
    urlModelId: encodeURIComponent(modelId),
    sourceId,
    sourceUrl,
    status: 'api',
    namespace: provider,
    modelIdWithinNamespace: modelId,
    displayName: model.model ?? model.id,
    raw: { model: registryModelToRawModel(model) },
    derived: {
      author: model.author ?? provider,
      canonicalSlug: null,
      pageOnlyType: null,
      endpointCount: 0,
      endpointContextLengths: model.context_length === null || model.context_length === undefined ? [] : [model.context_length],
      endpointProviders: [],
      inputModalities: model.input_modalities ?? [],
      outputModalities: model.output_modalities ?? [],
      pricingKeys: [],
    },
  }
}

function makeEndpointNode(provider: RegistryProvider, offer: RegistryOffer, target: OpenRouterRawNode, endpoint: JsonRecord, sourceRoutes: Set<string>): OpenRouterRawNode {
  const providerSlug = normalizeSlug(provider.id)
  const modelId = String(offer.model_id ?? target.modelId)
  const baseRoute = `/${encodeURIComponent(providerSlug)}/${encodeURIComponent(modelId)}`
  const route = sourceRoutes.has(baseRoute) ? `${baseRoute}/endpoint` : baseRoute
  const context = offer.other_parameters?.context_length ?? (isRecord(target.raw.model) ? target.raw.model.context_length : undefined)
  return {
    id: nodeIdForEndpoint(`${providerSlug}/${modelId}`),
    nodeKind: 'endpoint_deployment',
    dataSource: 'openrouter',
    provider: providerSlug,
    providerName: provider.provider ?? titleize(providerSlug),
    modelId,
    route,
    urlProvider: encodeURIComponent(providerSlug),
    urlModelId: encodeURIComponent(modelId),
    sourceId: `${providerSlug}/${modelId}`,
    sourceUrl: target.sourceUrl,
    status: 'endpoint',
    namespace: providerSlug,
    modelIdWithinNamespace: modelId,
    displayName: offer.model ?? target.displayName ?? modelId,
    raw: { endpoint, endpointWrapper: endpointWrapperFromOffer(target, endpoint) },
    derived: {
      author: target.derived.author,
      canonicalSlug: null,
      pageOnlyType: null,
      endpointCount: 1,
      endpointContextLengths: context === null || context === undefined ? [] : [context],
      endpointProviders: [provider.provider ?? titleize(providerSlug)],
      inputModalities: target.derived.inputModalities,
      outputModalities: target.derived.outputModalities,
      pricingKeys: Object.keys(isRecord(endpoint.pricing) ? endpoint.pricing : {}).sort(),
    },
  }
}

function registryModelToRawModel(model: RegistryModel): JsonRecord {
  return {
    id: primarySourceId(model),
    name: model.model,
    context_length: model.context_length,
    created: timestampSeconds(model.release_timestamp ?? releaseDateFromSources(model) ?? model.last_updated),
    architecture: {
      input_modalities: model.input_modalities ?? [],
      output_modalities: model.output_modalities ?? [],
      tokenizer: model.other_parameters?.tokenizer,
    },
    top_provider: {
      context_length: model.context_length,
      max_completion_tokens: model.max_output_tokens,
    },
    supported_parameters: model.other_parameters?.supported_parameters,
    mddb_registry: model,
  }
}

function endpointFromOffer(provider: RegistryProvider, offer: RegistryOffer): JsonRecord {
  const rawPricing = firstRawPricing(offer)
  return {
    tag: provider.id,
    provider_name: provider.provider ?? provider.id,
    name: `${provider.provider ?? provider.id} | ${offer.api_model_id ?? offer.model_id ?? offer.model ?? 'unknown'}`,
    context_length: offer.other_parameters?.context_length,
    max_completion_tokens: offer.other_parameters?.max_output_tokens,
    supported_parameters: offer.other_parameters?.supported_parameters,
    pricing: rawPricing,
    path: offer.endpoint_path,
    api_model_id: offer.api_model_id,
    mode: offer.mode,
    mddb_offer: offer,
  }
}

function endpointWrapperFromOffer(target: OpenRouterRawNode, endpoint: JsonRecord): JsonRecord {
  return { response: { data: { id: target.sourceId, name: target.displayName, endpoints: [endpoint] } } }
}

function firstRawPricing(offer: RegistryOffer): JsonRecord {
  const price = (offer.prices ?? [])[0]
  if (isRecord(price?.raw_pricing)) return price.raw_pricing
  const values = price?.prices ?? {}
  const raw: JsonRecord = {}
  if (values.input?.amount !== undefined) raw.prompt = String(values.input.amount / 1_000_000)
  if (values.output?.amount !== undefined) raw.completion = String(values.output.amount / 1_000_000)
  if (values.cache_read?.amount !== undefined) raw.input_cache_read = String(values.cache_read.amount / 1_000_000)
  if (values.cache_write?.amount !== undefined) raw.input_cache_write = String(values.cache_write.amount / 1_000_000)
  return raw
}

function pricingObservationsFromOffer(sourceId: string, provider: RegistryProvider, offer: RegistryOffer): PricingObservation[] {
  const rows: PricingObservation[] = []
  for (const price of offer.prices ?? []) {
    for (const [key, value] of Object.entries(price.prices ?? {})) {
      const amount = value.amount
      if (typeof amount !== 'number' || !Number.isFinite(amount)) continue
      rows.push({
        id: `pricing:registry:${sourceId}:${normalizeSlug(provider.id)}:${key}`,
        source: 'openrouter',
        sourceId,
        providerName: provider.provider ?? provider.id,
        billingMode: billingModeForPriceKey(key),
        unit: value.unit === 'per_1m_tokens' ? '1M_tokens' : 'custom',
        amountUsd: amount,
        confidence: 'provider_observation',
        conditions: price.conditions,
        provenance: { providerId: provider.id, apiModelId: offer.api_model_id, priceSource: price.source, observedAt: price.observed_at },
      })
    }
  }
  return rows
}

function billingModeForPriceKey(key: string): PricingObservation['billingMode'] {
  if (key === 'input') return 'token_input'
  if (key === 'output') return 'token_output'
  if (key === 'cache_read') return 'cache_read'
  if (key === 'cache_write') return 'cache_write'
  return 'custom'
}

function primarySourceId(model: RegistryModel): string { return String(model.sources?.find((source) => source.source === 'openrouter')?.source_id ?? model.alias?.[0] ?? model.id) }
function primarySourceUrl(model: RegistryModel, sourceId: string): string { return String(model.sources?.find((source) => typeof source.url === 'string')?.url ?? `https://openrouter.ai/${sourceId}`) }
function releaseDateFromSources(model: RegistryModel): unknown {
  for (const source of model.sources ?? []) {
    const direct = source.release_timestamp ?? source.release_date ?? source.released_at ?? source.published_at ?? source.created
    if (direct !== undefined) return direct
    if (isRecord(source.raw)) {
      const raw = source.raw
      const nested = raw.created ?? raw.release_date ?? raw.released_at ?? raw.published_at
      if (nested !== undefined) return nested
    }
  }
  return undefined
}
function timestampSeconds(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return Math.floor(numeric > 1_000_000_000_000 ? numeric / 1000 : numeric)
    const time = Date.parse(value)
    if (Number.isFinite(time)) return Math.floor(time / 1000)
  }
  return undefined
}
function nodeIdForSource(sourceId: string): string { return `registry-source:${sourceId}` }
function nodeIdForEndpoint(sourceId: string): string { return `registry-endpoint:${sourceId}` }
function dedupeById<T extends { id: string }>(rows: T[]): T[] { return Array.from(new Map(rows.map((row) => [row.id, row])).values()) }
function readJson(path: string): unknown { return JSON.parse(readFileSync(path, 'utf8')) }
function normalizeSlug(value: string): string { return String(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-') || 'unknown' }
function titleize(value: string): string { return value.split(/[-_]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ') }
function isRecord(value: unknown): value is JsonRecord { return typeof value === 'object' && value !== null && !Array.isArray(value) }
