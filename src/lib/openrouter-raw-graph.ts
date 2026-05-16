import { existsSync, readFileSync } from 'node:fs'

export type OpenRouterRawGraph = {
  generatedAt: string
  schema: {
    urlShape: '/models/<provider>/<model-id>'
    rawPolicy: 'preserve-upstream-key-values'
    providerPolicy: 'actual-deployment-provider-not-data-source'
    dataSource: 'openrouter'
  }
  source: {
    modelsPath: string
    endpointsPath: string
    sitemapPath: string
    pagesPath: string
  }
  stats: {
    apiModels: number
    sitemapModelPages: number
    pageOnlyModels: number
    endpointWrappers: number
    endpointRows: number
    pageRows: number
    nodes: number
    edges: number
  }
  providers: Array<{ id: string; name: string; currency: string; raw: Record<string, unknown> }>
  nodes: OpenRouterRawNode[]
  edges: OpenRouterRawEdge[]
  indices: {
    bySourceId: Record<string, string>
    byRoute: Record<string, string>
    pageOnlyNodeIds: string[]
    apiNodeIds: string[]
  }
}

export type OpenRouterRawNode = {
  id: string
  dataSource: 'openrouter'
  provider: string
  providerName: string
  modelId: string
  route: string
  urlProvider: string
  urlModelId: string
  sourceId: string
  sourceUrl: string
  status: 'api' | 'page_only' | 'api_only'
  namespace: string
  modelIdWithinNamespace: string
  displayName: string
  raw: {
    model?: unknown
    endpointWrapper?: unknown
    page?: unknown
    sitemap?: unknown
  }
  derived: {
    author: string | null
    canonicalSlug: string | null
    pageOnlyType: string | null
    endpointCount: number
    endpointContextLengths: unknown[]
    endpointProviders: string[]
    inputModalities: string[]
    outputModalities: string[]
    pricingKeys: string[]
  }
}

export type OpenRouterRawEdge = {
  id: string
  from: string
  to: string
  type: 'has_endpoint' | 'alias_of' | 'snapshot_of' | 'variant_of' | 'same_as' | 'derived_from' | 'same_author_as' | 'page_observed_as' | 'sourced_from'
  label: string
  raw?: unknown
}

type JsonRecord = Record<string, unknown>

export function buildOpenRouterRawGraphFromFiles(paths: { modelsPath: string; endpointsPath: string; sitemapPath: string; pagesPath: string }): OpenRouterRawGraph {
  const modelsPayload = readJson(paths.modelsPath) as { data?: JsonRecord[] }
  const endpointsPayload = readJson(paths.endpointsPath) as { data?: JsonRecord[] }
  const sitemapPayload = readJson(paths.sitemapPath) as { modelPages?: JsonRecord[]; pageOnly?: JsonRecord[]; apiOnly?: string[]; source?: JsonRecord }
  const pagesPayload = existsSync(paths.pagesPath) ? readJson(paths.pagesPath) as { data?: JsonRecord[] } : { data: [] }

  const apiModels = Array.isArray(modelsPayload.data) ? modelsPayload.data : []
  const endpointRows = Array.isArray(endpointsPayload.data) ? endpointsPayload.data : []
  const sitemapRows = Array.isArray(sitemapPayload.modelPages) ? sitemapPayload.modelPages : []
  const pageOnlyRows = Array.isArray(sitemapPayload.pageOnly) ? sitemapPayload.pageOnly : []
  const apiOnlyIds = Array.isArray(sitemapPayload.apiOnly) ? sitemapPayload.apiOnly : []
  const pageRows = Array.isArray(pagesPayload.data) ? pagesPayload.data : []

  const modelById = new Map(apiModels.map((model) => [String(model.id), model]))
  const endpointByModelId = new Map(endpointRows.map((row) => [String(row.modelId), row]))
  const sitemapById = new Map(sitemapRows.map((row) => [String(row.id), row]))
  const pageById = new Map(pageRows.map((row) => [String(row.id), row]))
  const pageOnlyTypeById = new Map(pageOnlyRows.map((row) => [String(row.id), String(row.inferredType ?? 'unknown_page_only')]))
  const allIds = Array.from(new Set([...apiModels.map((model) => String(model.id)), ...sitemapRows.map((row) => String(row.id))])).sort((a, b) => a.localeCompare(b))

  const nodes = allIds.map((sourceId) => makeNode(sourceId, modelById.get(sourceId), endpointByModelId.get(sourceId), sitemapById.get(sourceId), pageById.get(sourceId), pageOnlyTypeById.get(sourceId), apiOnlyIds.includes(sourceId)))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges: OpenRouterRawEdge[] = []

  for (const node of nodes) {
    edges.push({ id: `edge:${node.id}:sourced_from:openrouter`, from: node.id, to: node.id, type: 'sourced_from', label: 'data source: openrouter', raw: { dataSource: 'openrouter', sourceId: node.sourceId, sourceUrl: node.sourceUrl } })
    for (const endpoint of endpointList(node.raw.endpointWrapper)) {
      edges.push({
        id: `edge:${node.id}:has_endpoint:${edges.length}`,
        from: node.id,
        to: node.id,
        type: 'has_endpoint',
        label: `${String(endpoint.provider_name ?? endpoint.name ?? 'endpoint')} · ${String(endpoint.tag ?? '')}`.trim(),
        raw: endpoint,
      })
    }
    const canonicalSlug = node.derived.canonicalSlug
    if (canonicalSlug && canonicalSlug !== node.sourceId) {
      const target = nodeIdFor(canonicalSlug)
      edges.push({ id: `edge:${node.id}:alias_of:${target}`, from: node.id, to: nodeIds.has(target) ? target : node.id, type: 'alias_of', label: `canonical_slug: ${canonicalSlug}`, raw: { canonical_slug: canonicalSlug } })
    }
    const pagePermaslug = rawPagePermaslug(node.raw.page)
    if (pagePermaslug && pagePermaslug !== node.sourceId) {
      const target = nodeIdFor(pagePermaslug)
      edges.push({ id: `edge:${node.id}:page_observed_as:${target}`, from: node.id, to: nodeIds.has(target) ? target : node.id, type: 'page_observed_as', label: `permaslug: ${pagePermaslug}`, raw: { permaslug: pagePermaslug } })
    }
    const snapshotBase = stripSnapshot(node.sourceId)
    if (snapshotBase && snapshotBase !== node.sourceId) {
      const target = nodeIdFor(snapshotBase)
      edges.push({ id: `edge:${node.id}:snapshot_of:${target}`, from: node.id, to: nodeIds.has(target) ? target : node.id, type: 'snapshot_of', label: `snapshot of ${snapshotBase}` })
    }
    const variantBase = stripVariant(node.sourceId)
    if (variantBase && variantBase !== node.sourceId) {
      const target = nodeIdFor(variantBase)
      edges.push({ id: `edge:${node.id}:variant_of:${target}`, from: node.id, to: nodeIds.has(target) ? target : node.id, type: 'variant_of', label: `variant of ${variantBase}` })
    }
  }

  const byAuthor = new Map<string, OpenRouterRawNode[]>()
  for (const node of nodes) {
    const author = node.derived.author
    if (!author) continue
    const group = byAuthor.get(author) ?? []
    group.push(node)
    byAuthor.set(author, group)
  }
  for (const [author, group] of byAuthor) {
    const sorted = group.sort((a, b) => a.sourceId.localeCompare(b.sourceId))
    const anchor = sorted[0]
    if (!anchor) continue
    for (const node of sorted.slice(1)) {
      edges.push({ id: `edge:${node.id}:same_author_as:${anchor.id}`, from: node.id, to: anchor.id, type: 'same_author_as', label: `author: ${author}` })
    }
  }

  const providerMap = new Map<string, { id: string; name: string; currency: string; raw: Record<string, unknown> }>()
  for (const node of nodes) {
    providerMap.set(node.provider, { id: node.provider, name: node.providerName, currency: 'USD', raw: { inferredFrom: 'OpenRouter author namespace or page provider_slug', dataSource: 'openrouter' } })
  }

  return {
    generatedAt: new Date().toISOString(),
    schema: { urlShape: '/models/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    source: paths,
    stats: {
      apiModels: apiModels.length,
      sitemapModelPages: sitemapRows.length,
      pageOnlyModels: pageOnlyRows.length,
      endpointWrappers: endpointRows.length,
      endpointRows: endpointRows.reduce((sum, row) => sum + endpointList(row).length, 0),
      pageRows: pageRows.length,
      nodes: nodes.length,
      edges: edges.length,
    },
    providers: Array.from(providerMap.values()).sort((a, b) => a.id.localeCompare(b.id)),
    nodes,
    edges,
    indices: {
      bySourceId: Object.fromEntries(nodes.map((node) => [node.sourceId, node.id])),
      byRoute: Object.fromEntries(nodes.map((node) => [node.route, node.id])),
      pageOnlyNodeIds: nodes.filter((node) => node.status === 'page_only').map((node) => node.id),
      apiNodeIds: nodes.filter((node) => node.status === 'api').map((node) => node.id),
    },
  }
}

function makeNode(sourceId: string, model: JsonRecord | undefined, endpointWrapper: JsonRecord | undefined, sitemap: JsonRecord | undefined, page: JsonRecord | undefined, pageOnlyType: string | undefined, apiOnly: boolean): OpenRouterRawNode {
  const [namespace, ...rest] = sourceId.split('/')
  const modelIdWithinNamespace = rest.join('/') || sourceId
  const pageRaw = getPageRaw(page)
  const author = String(model?.id ?? sourceId).split('/')[0] ?? null
  const provider = inferActualProviderSlug(sourceId, pageRaw)
  const providerName = inferActualProviderName(provider, pageRaw)
  const modelId = inferProviderModelId(sourceId, pageRaw)
  const route = `/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`
  const endpointListValue = endpointList(endpointWrapper)
  return {
    id: nodeIdFor(sourceId),
    dataSource: 'openrouter',
    provider,
    providerName,
    modelId,
    route,
    urlProvider: encodeURIComponent(provider),
    urlModelId: encodeURIComponent(modelId),
    sourceId,
    sourceUrl: String(sitemap?.url ?? `https://openrouter.ai/${sourceId}`),
    status: model ? 'api' : pageOnlyType ? 'page_only' : apiOnly ? 'api_only' : 'page_only',
    namespace: namespace ?? '',
    modelIdWithinNamespace,
    displayName: String(model?.name ?? pageRaw?.displayName ?? sourceId),
    raw: { model, endpointWrapper, page, sitemap },
    derived: {
      author,
      canonicalSlug: typeof model?.canonical_slug === 'string' ? model.canonical_slug : null,
      pageOnlyType: pageOnlyType ?? null,
      endpointCount: endpointListValue.length,
      endpointContextLengths: Array.from(new Set(endpointListValue.map((endpoint) => endpoint.context_length).filter((value) => value !== null && value !== undefined))).sort(compareUnknown),
      endpointProviders: Array.from(new Set(endpointListValue.map((endpoint) => String(endpoint.provider_name ?? '')).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
      inputModalities: arrayOfStrings(model?.architecture && isRecord(model.architecture) ? model.architecture.input_modalities : pageRaw?.input_modalities),
      outputModalities: arrayOfStrings(model?.architecture && isRecord(model.architecture) ? model.architecture.output_modalities : pageRaw?.output_modalities),
      pricingKeys: Array.from(new Set([...Object.keys(isRecord(model?.pricing) ? model.pricing : {}), ...Object.keys(isRecord(pageRaw?.pricing) ? pageRaw.pricing : {}), ...Object.keys(isRecord(pageRaw?.pricing_json) ? pageRaw.pricing_json : {})])).sort(),
    },
  }
}

function inferActualProviderSlug(sourceId: string, pageRaw: JsonRecord | null): string {
  if (typeof pageRaw?.provider_slug === 'string' && pageRaw.provider_slug.trim()) return normalizeSlug(pageRaw.provider_slug)
  return normalizeSlug(sourceId.split('/')[0] ?? 'unknown')
}

function inferActualProviderName(provider: string, pageRaw: JsonRecord | null): string {
  if (typeof pageRaw?.provider_display_name === 'string' && pageRaw.provider_display_name.trim()) return pageRaw.provider_display_name
  return provider.split(/[-_]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
}

function inferProviderModelId(sourceId: string, pageRaw: JsonRecord | null): string {
  if (typeof pageRaw?.provider_model_id === 'string' && pageRaw.provider_model_id.trim()) return pageRaw.provider_model_id
  const [, ...rest] = sourceId.split('/')
  return rest.join('/') || sourceId
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-') || 'unknown'
}

function endpointList(wrapper: unknown): JsonRecord[] {
  if (!isRecord(wrapper)) return []
  const response = wrapper.response
  if (!isRecord(response) || !isRecord(response.data) || !Array.isArray(response.data.endpoints)) return []
  return response.data.endpoints.filter(isRecord)
}

function getPageRaw(page: unknown): JsonRecord | null {
  if (!isRecord(page) || !isRecord(page.extracted) || !isRecord(page.extracted.raw)) return null
  return page.extracted.raw
}

function rawPagePermaslug(page: unknown): string | null {
  const raw = getPageRaw(page)
  return typeof raw?.permaslug === 'string' ? raw.permaslug : null
}

function nodeIdFor(sourceId: string): string {
  return `openrouter-source:${sourceId}`
}

function stripSnapshot(sourceId: string): string | null {
  const value = sourceId.replace(/-(?:19|20)\d{2}-\d{2}-\d{2}$/u, '').replace(/-(?:19|20)\d{6}$/u, '')
  return value === sourceId ? null : value
}

function stripVariant(sourceId: string): string | null {
  const value = sourceId.replace(/:(free|beta|preview)$/u, '').replace(/-(fast|online|thinking|turbo|mini|lite)$/u, '')
  return value === sourceId ? null : value
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : []
}

function compareUnknown(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}
