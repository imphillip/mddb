import { existsSync, readFileSync } from 'node:fs'

export type OpenRouterRawGraph = {
  generatedAt: string
  schema: {
    urlShape: '/models/<provider>/<model-id>'
    rawPolicy: 'preserve-upstream-key-values'
    providerPolicy: 'actual-deployment-provider-not-data-source'
    dataSource: 'openrouter'
  }
  graphModel: {
    version: 'v2-observation-graph'
    identityBoundary: 'openrouter-source-id'
    pricingPolicy: 'provider-specific-observations-preserve-billing-mode'
    provenancePolicy: 'facts-are-nodes-or-observations-with-source-links'
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
    pricingObservations: number
    providerObservations: number
    sourceNodes: number
    endpointNodes: number
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
  observations?: {
    pricing: PricingObservation[]
    providers: ProviderObservation[]
  }
  currency?: {
    base: 'USD'
    quote: 'CNY'
    rate: number
    rawRate: number
    source: string
    updatedAt: string
  }
  enrichment?: {
    modelsDev?: {
      path: string
      providerRows: number
      brandLogos: Record<string, string>
    }
    baseLlm?: {
      path: string
      source: string
      modelRows: number
      uniqueModelNames: number
      providerRows: number
      tokenPricedRows: number
      unitPricedRows: number
      unknownPricedRows: number
      exactSourceMatches: number
      modelIdOnlyMatches: number
      normalizedNameMatches: number
      pricingBySourceId: Record<string, BaseLlmSupplementalPrice[]>
    }
  }
}

export type PricingObservation = {
  id: string
  source: 'openrouter' | 'basellm'
  sourceId: string
  providerName: string
  billingMode: 'token_input' | 'token_output' | 'cache_read' | 'cache_write' | 'request' | 'image' | 'audio' | 'video' | 'time' | 'custom'
  unit: '1M_tokens' | 'request' | 'image' | 'audio' | 'video' | 'second' | 'custom'
  amountUsd: number
  confidence: 'canonical' | 'provider_observation' | 'supplemental_exact' | 'supplemental_model_id'
  conditions?: Record<string, unknown> | undefined
  provenance: Record<string, unknown>
}

export type ProviderObservation = {
  id: string
  source: 'openrouter' | 'basellm' | 'models.dev'
  providerName: string
  relation: 'deployment_of' | 'priced_by' | 'logo_for'
  targetSourceId?: string | undefined
  confidence: 'canonical' | 'provider_observation' | 'supplemental_exact' | 'supplemental_model_id'
  provenance: Record<string, unknown>
}

export type BaseLlmSupplementalPrice = {
  providerName: string
  sourceModelId: string
  billingKind: 'token' | 'unit' | 'unknown'
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
  contextWindow: string
  tags: string[]
}

export type OpenRouterRawNode = {
  id: string
  nodeKind: 'source_model' | 'endpoint_deployment'
  dataSource: 'openrouter'
  provider: string
  providerName: string
  modelId: string
  route: string
  urlProvider: string
  urlModelId: string
  sourceId: string
  sourceUrl: string
  status: 'api' | 'page_only' | 'api_only' | 'endpoint'
  namespace: string
  modelIdWithinNamespace: string
  displayName: string
  raw: {
    model?: unknown
    endpointWrapper?: unknown
    endpoint?: unknown
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
  type: 'has_endpoint' | 'alias_of' | 'snapshot_of' | 'variant_of' | 'same_as' | 'derived_from' | 'same_author_as' | 'page_observed_as' | 'sourced_from' | 'deployment_of' | 'spec_same_as' | 'routes_to'
  label: string
  raw?: unknown
}

type JsonRecord = Record<string, unknown>

export function buildOpenRouterRawGraphFromFiles(paths: { modelsPath: string; endpointsPath: string; sitemapPath: string; pagesPath: string; modelsDevPath?: string; baseLlmPath?: string }): OpenRouterRawGraph {
  const modelsPayload = readJson(paths.modelsPath) as { data?: JsonRecord[] }
  const endpointsPayload = readJson(paths.endpointsPath) as { data?: JsonRecord[] }
  const sitemapPayload = readJson(paths.sitemapPath) as { modelPages?: JsonRecord[]; pageOnly?: JsonRecord[]; apiOnly?: string[]; source?: JsonRecord }
  const pagesPayload = existsSync(paths.pagesPath) ? readJson(paths.pagesPath) as { data?: JsonRecord[] } : { data: [] }
  const modelsDevPayload = paths.modelsDevPath && existsSync(paths.modelsDevPath) ? readJson(paths.modelsDevPath) as Record<string, JsonRecord> : {}
  const baseLlmPayload = paths.baseLlmPath && existsSync(paths.baseLlmPath) ? readJson(paths.baseLlmPath) as { source?: string; models?: JsonRecord[] } : { models: [] }

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

  const sourceNodes = allIds.map((sourceId) => makeSourceNode(sourceId, modelById.get(sourceId), endpointByModelId.get(sourceId), sitemapById.get(sourceId), pageById.get(sourceId), pageOnlyTypeById.get(sourceId), apiOnlyIds.includes(sourceId)))
  const sourceNodeIds = new Set(sourceNodes.map((node) => node.id))
  const sourceRoutes = new Set(sourceNodes.map((node) => node.route))
  const sourceById = new Map(sourceNodes.map((node) => [node.sourceId, node]))
  const endpointNodes = makeEndpointNodes(sourceNodes, sourceRoutes)
  const nodes = [...sourceNodes, ...endpointNodes]
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges: OpenRouterRawEdge[] = []

  for (const node of sourceNodes) {
    edges.push({ id: `edge:${node.id}:sourced_from:openrouter`, from: node.id, to: node.id, type: 'sourced_from', label: 'data source: openrouter', raw: { dataSource: 'openrouter', sourceId: node.sourceId, sourceUrl: node.sourceUrl } })
    for (const endpoint of endpointList(node.raw.endpointWrapper)) {
      const endpointNode = endpointNodeFor(node, endpoint)
      edges.push({
        id: `edge:${node.id}:has_endpoint:${endpointNode.id}`,
        from: node.id,
        to: nodeIds.has(endpointNode.id) ? endpointNode.id : node.id,
        type: 'has_endpoint',
        label: `${String(endpoint.provider_name ?? endpoint.name ?? 'endpoint')} · ${String(endpoint.tag ?? '')}`.trim(),
        raw: endpoint,
      })
      edges.push({
        id: `edge:${endpointNode.id}:deployment_of:${node.id}`,
        from: endpointNode.id,
        to: preferredSpecTarget(node, sourceById).id,
        type: 'deployment_of',
        label: `endpoint deployment observed via ${node.sourceId}`,
        raw: endpoint,
      })
    }

    for (const [signature, endpoints] of groupEndpointsBySpec(endpointList(node.raw.endpointWrapper))) {
      if (endpoints.length < 2) continue
      const canonicalEndpoint = canonicalEndpointForSpec(node, endpoints)
      const canonicalNode = endpointNodeFor(node, canonicalEndpoint)
      for (const endpoint of endpoints) {
        const endpointNode = endpointNodeFor(node, endpoint)
        if (endpointNode.id === canonicalNode.id) continue
        edges.push({
          id: `edge:${endpointNode.id}:spec_same_as:${canonicalNode.id}`,
          from: endpointNode.id,
          to: canonicalNode.id,
          type: 'spec_same_as',
          label: `same specs/pricing as ${canonicalNode.sourceId}`,
          raw: {
            referenceType: 'identical_endpoint_spec_anchor',
            anchorStatus: 'derived',
            anchorSource: 'openrouter_endpoint_signature',
            signature,
            sourceModel: node.sourceId,
            endpointSourceId: endpointNode.sourceId,
            anchorSourceId: canonicalNode.sourceId,
          },
        })
      }
    }

    const aliasTarget = aliasTargetFor(node, sourceById)
    if (aliasTarget && aliasTarget.id !== node.id) {
      edges.push({ id: `edge:${node.id}:alias_of:${aliasTarget.id}`, from: node.id, to: aliasTarget.id, type: 'alias_of', label: `alias of ${aliasTarget.sourceId}`, raw: aliasEvidenceFor(node, aliasTarget) })
    }

    const canonicalSlug = node.derived.canonicalSlug
    if (canonicalSlug && canonicalSlug !== node.sourceId) {
      const target = nodeIdForSource(canonicalSlug)
      if (sourceNodeIds.has(target)) {
        edges.push({ id: `edge:${node.id}:canonical_alias_of:${target}`, from: node.id, to: target, type: 'alias_of', label: `canonical_slug: ${canonicalSlug}`, raw: { canonical_slug: canonicalSlug } })
      }
    }
    const pagePermaslug = rawPagePermaslug(node.raw.page)
    if (pagePermaslug && pagePermaslug !== node.sourceId) {
      const target = nodeIdForSource(pagePermaslug)
      edges.push({ id: `edge:${node.id}:page_observed_as:${target}`, from: node.id, to: sourceNodeIds.has(target) ? target : node.id, type: 'page_observed_as', label: `permaslug: ${pagePermaslug}`, raw: { permaslug: pagePermaslug } })
    }
    const snapshotTarget = snapshotTargetFor(node, sourceById)
    if (snapshotTarget && snapshotTarget.id !== node.id) {
      edges.push({ id: `edge:${node.id}:snapshot_of:${snapshotTarget.id}`, from: node.id, to: snapshotTarget.id, type: 'snapshot_of', label: `snapshot of ${snapshotTarget.sourceId}` })
    }
    const variantBase = stripVariant(node.sourceId)
    if (variantBase && variantBase !== node.sourceId) {
      const target = nodeIdForSource(variantBase)
      edges.push({ id: `edge:${node.id}:variant_of:${target}`, from: node.id, to: sourceNodeIds.has(target) ? target : node.id, type: 'variant_of', label: `variant of ${variantBase}` })
    }
  }

  const byAuthor = new Map<string, OpenRouterRawNode[]>()
  for (const node of sourceNodes) {
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
    providerMap.set(node.provider, { id: node.provider, name: node.providerName, currency: 'USD', raw: { inferredFrom: node.nodeKind === 'endpoint_deployment' ? 'OpenRouter endpoint tag' : 'OpenRouter author namespace', dataSource: 'openrouter' } })
  }

  const enrichment = buildGraphEnrichment(modelsDevPayload, paths.modelsDevPath, baseLlmPayload, paths.baseLlmPath, sourceNodes)
  const observations = buildObservations(sourceNodes, enrichment)
  const graph: OpenRouterRawGraph = {
    generatedAt: new Date().toISOString(),
    schema: { urlShape: '/models/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    graphModel: { version: 'v2-observation-graph', identityBoundary: 'openrouter-source-id', pricingPolicy: 'provider-specific-observations-preserve-billing-mode', provenancePolicy: 'facts-are-nodes-or-observations-with-source-links' },
    source: {
      modelsPath: paths.modelsPath,
      endpointsPath: paths.endpointsPath,
      sitemapPath: paths.sitemapPath,
      pagesPath: paths.pagesPath,
    },
    stats: {
      apiModels: apiModels.length,
      sitemapModelPages: sitemapRows.length,
      pageOnlyModels: pageOnlyRows.length,
      endpointWrappers: endpointRows.length,
      endpointRows: endpointRows.reduce((sum, row) => sum + endpointList(row).length, 0),
      pricingObservations: observations.pricing.length,
      providerObservations: observations.providers.length,
      sourceNodes: sourceNodes.length,
      endpointNodes: endpointNodes.length,
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
      pageOnlyNodeIds: sourceNodes.filter((node) => node.status === 'page_only').map((node) => node.id),
      apiNodeIds: sourceNodes.filter((node) => node.status === 'api').map((node) => node.id),
    },
  }
  if (observations.pricing.length || observations.providers.length) graph.observations = observations
  if (enrichment) graph.enrichment = enrichment
  return graph
}

function buildObservations(sourceNodes: OpenRouterRawNode[], enrichment: OpenRouterRawGraph['enrichment']): NonNullable<OpenRouterRawGraph['observations']> {
  const pricing: PricingObservation[] = []
  const providers: ProviderObservation[] = []
  for (const node of sourceNodes) {
    for (const obs of pricingObservationsFromRawPricing('openrouter', node.sourceId, node.providerName, node.raw.model, 'canonical')) pricing.push(obs)
    for (const endpoint of endpointList(node.raw.endpointWrapper)) {
      const providerName = String(endpoint.provider_name ?? endpoint.name ?? endpoint.tag ?? 'unknown')
      providers.push({ id: `provider:openrouter:${node.sourceId}:${normalizeSlug(providerName)}`, source: 'openrouter', providerName, relation: 'deployment_of', targetSourceId: node.sourceId, confidence: 'provider_observation', provenance: { endpointTag: endpoint.tag, sourceId: node.sourceId } })
      for (const obs of pricingObservationsFromRawPricing('openrouter', node.sourceId, providerName, endpoint, 'provider_observation')) pricing.push(obs)
    }
  }
  for (const [sourceId, prices] of Object.entries(enrichment?.baseLlm?.pricingBySourceId ?? {})) {
    for (const price of prices) {
      providers.push({ id: `provider:basellm:${sourceId}:${normalizeSlug(price.providerName)}`, source: 'basellm', providerName: price.providerName, relation: 'priced_by', targetSourceId: sourceId, confidence: price.sourceModelId.toLowerCase() === sourceId.toLowerCase() ? 'supplemental_exact' : 'supplemental_model_id', provenance: { sourceModelId: price.sourceModelId, tags: price.tags } })
      const confidence = price.sourceModelId.toLowerCase() === sourceId.toLowerCase() ? 'supplemental_exact' : 'supplemental_model_id'
      if (typeof price.pricePerMillionInput === 'number') pricing.push({ id: `pricing:basellm:${sourceId}:${normalizeSlug(price.providerName)}:input`, source: 'basellm', sourceId, providerName: price.providerName, billingMode: 'token_input', unit: '1M_tokens', amountUsd: price.pricePerMillionInput, confidence, conditions: baseLlmConditions(price), provenance: { sourceModelId: price.sourceModelId, ratioModel: price.ratioModel, tags: price.tags } })
      if (typeof price.pricePerMillionOutput === 'number') pricing.push({ id: `pricing:basellm:${sourceId}:${normalizeSlug(price.providerName)}:output`, source: 'basellm', sourceId, providerName: price.providerName, billingMode: 'token_output', unit: '1M_tokens', amountUsd: price.pricePerMillionOutput, confidence, conditions: baseLlmConditions(price), provenance: { sourceModelId: price.sourceModelId, ratioCompletion: price.ratioCompletion, tags: price.tags } })
      if (typeof price.unitPrice === 'number') pricing.push({ id: `pricing:basellm:${sourceId}:${normalizeSlug(price.providerName)}:request`, source: 'basellm', sourceId, providerName: price.providerName, billingMode: 'request', unit: 'request', amountUsd: price.unitPrice, confidence, conditions: baseLlmConditions(price), provenance: { sourceModelId: price.sourceModelId, tags: price.tags } })
    }
  }
  return { pricing: dedupeObservations(pricing), providers: dedupeObservations(providers) }
}

function pricingObservationsFromRawPricing(source: 'openrouter', sourceId: string, providerName: string, raw: unknown, confidence: PricingObservation['confidence']): PricingObservation[] {
  const record = isRecord(raw) ? raw : {}
  const pricing = isRecord(record.pricing) ? record.pricing : {}
  const rows: PricingObservation[] = []
  for (const [key, value] of Object.entries(pricing)) {
    const amount = priceNumber(value)
    if (amount === null) continue
    const shape = pricingShape(key)
    rows.push({ id: `pricing:${source}:${sourceId}:${normalizeSlug(providerName)}:${key}`, source, sourceId, providerName, billingMode: shape.billingMode, unit: shape.unit, amountUsd: amount, confidence, conditions: openRouterConditions(record), provenance: { rawPricingKey: key } })
  }
  return rows
}

function pricingShape(key: string): Pick<PricingObservation, 'billingMode' | 'unit'> {
  if (key === 'prompt') return { billingMode: 'token_input', unit: '1M_tokens' }
  if (key === 'completion') return { billingMode: 'token_output', unit: '1M_tokens' }
  if (key === 'cache_read') return { billingMode: 'cache_read', unit: '1M_tokens' }
  if (key === 'cache_write') return { billingMode: 'cache_write', unit: '1M_tokens' }
  if (key.includes('image')) return { billingMode: 'image', unit: 'image' }
  if (key.includes('request')) return { billingMode: 'request', unit: 'request' }
  if (key.includes('audio')) return { billingMode: 'audio', unit: 'audio' }
  if (key.includes('video')) return { billingMode: 'video', unit: 'video' }
  return { billingMode: 'custom', unit: 'custom' }
}

function openRouterConditions(record: JsonRecord): Record<string, unknown> | undefined {
  const conditions: Record<string, unknown> = {}
  if (record.context_length !== undefined) conditions.contextLength = record.context_length
  if (record.max_completion_tokens !== undefined) conditions.maxOutputTokens = record.max_completion_tokens
  return Object.keys(conditions).length ? conditions : undefined
}

function baseLlmConditions(price: BaseLlmSupplementalPrice): Record<string, unknown> | undefined {
  return price.contextWindow && price.contextWindow !== '—' ? { contextWindow: price.contextWindow } : undefined
}

function priceNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(num) ? num : null
}

function dedupeObservations<T extends { id: string }>(rows: T[]): T[] {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
}

function buildGraphEnrichment(modelsDevPayload: Record<string, JsonRecord>, modelsDevPath: string | undefined, baseLlmPayload: { source?: string; models?: JsonRecord[] }, baseLlmPath: string | undefined, sourceNodes: OpenRouterRawNode[]): OpenRouterRawGraph['enrichment'] {
  const enrichment: NonNullable<OpenRouterRawGraph['enrichment']> = {}
  const modelsDev = buildModelsDevGraphEnrichment(modelsDevPayload, modelsDevPath)
  const baseLlm = buildBaseLlmGraphEnrichment(baseLlmPayload, baseLlmPath, sourceNodes)
  if (modelsDev) enrichment.modelsDev = modelsDev
  if (baseLlm) enrichment.baseLlm = baseLlm
  return enrichment
}

function buildModelsDevGraphEnrichment(modelsDevPayload: Record<string, JsonRecord>, path: string | undefined): NonNullable<OpenRouterRawGraph['enrichment']>['modelsDev'] {
  const brandLogos = Object.fromEntries(Object.values(modelsDevPayload).flatMap((provider) => {
    const id = typeof provider.id === 'string' ? provider.id : null
    const logo = modelsDevLogoUrl(provider)
    return id && logo ? [[normalizeLogoSlug(id), logo] as const] : []
  }).sort((left, right) => left[0].localeCompare(right[0])))
  return {
    path: path ?? '',
    providerRows: Object.keys(modelsDevPayload).length,
    brandLogos,
  }
}

function buildBaseLlmGraphEnrichment(baseLlmPayload: { source?: string; models?: JsonRecord[] }, path: string | undefined, sourceNodes: OpenRouterRawNode[]): NonNullable<OpenRouterRawGraph['enrichment']>['baseLlm'] {
  const rows = Array.isArray(baseLlmPayload.models) ? baseLlmPayload.models : []
  const pricingBySourceId = new Map<string, BaseLlmSupplementalPrice[]>()
  const sourceIds = new Set(sourceNodes.map((node) => node.sourceId.toLowerCase()))
  const modelIds = new Set(sourceNodes.map((node) => node.modelId.toLowerCase()))
  const normalizedModelIds = new Set(sourceNodes.map((node) => normalizedModelKey(node.modelId)))
  const uniqueModelNames = new Set<string>()
  const providers = new Set<string>()
  let tokenPricedRows = 0
  let unitPricedRows = 0
  let exactSourceMatches = 0
  let modelIdOnlyMatches = 0
  let normalizedNameMatches = 0
  for (const row of rows) {
    const modelName = String(row.model_name ?? '')
    const modelNameLower = modelName.toLowerCase()
    uniqueModelNames.add(modelNameLower)
    providers.add(String(row.vendor_name ?? 'unknown'))
    if (row.ratio_model !== null && row.ratio_model !== undefined || row.price_per_m_input !== null && row.price_per_m_input !== undefined) tokenPricedRows += 1
    if (row.model_price !== null && row.model_price !== undefined) unitPricedRows += 1
    if (sourceIds.has(modelNameLower)) exactSourceMatches += 1
    else if (modelIds.has(modelNameLower)) modelIdOnlyMatches += 1
    else if (normalizedModelIds.has(normalizedModelKey(modelName))) normalizedNameMatches += 1
    const matchedSourceId = matchedBaseLlmSourceId(row, sourceNodes)
    const supplementalPrice = matchedSourceId ? baseLlmSupplementalPrice(row) : null
    if (matchedSourceId && supplementalPrice) {
      const current = pricingBySourceId.get(matchedSourceId) ?? []
      current.push(supplementalPrice)
      pricingBySourceId.set(matchedSourceId, current)
    }
  }
  return {
    path: path ?? '',
    source: baseLlmPayload.source ?? '',
    modelRows: rows.length,
    uniqueModelNames: uniqueModelNames.size,
    providerRows: providers.size,
    tokenPricedRows,
    unitPricedRows,
    unknownPricedRows: rows.length - tokenPricedRows - unitPricedRows,
    exactSourceMatches,
    modelIdOnlyMatches,
    normalizedNameMatches,
    pricingBySourceId: Object.fromEntries(Array.from(pricingBySourceId.entries()).map(([sourceId, prices]) => [sourceId, prices.sort(compareBaseLlmPrices).slice(0, 12)])),
  }
}

function matchedBaseLlmSourceId(row: JsonRecord, sourceNodes: OpenRouterRawNode[]): string | null {
  const modelName = String(row.model_name ?? '')
  if (!modelName || isFreeRoute(modelName)) return null
  const lower = modelName.toLowerCase()
  const exact = sourceNodes.find((node) => node.sourceId.toLowerCase() === lower)
  if (exact) return exact.sourceId
  const modelIdOnly = sourceNodes.find((node) => node.modelId.toLowerCase() === lower)
  if (modelIdOnly) return modelIdOnly.sourceId
  return null
}

function baseLlmSupplementalPrice(row: JsonRecord): BaseLlmSupplementalPrice | null {
  const tags = parseTags(String(row.tags ?? ''))
  const pricePerMillionInput = numberOrUndefined(row.price_per_m_input)
  const pricePerMillionOutput = numberOrUndefined(row.price_per_m_output)
  const ratioModel = numberOrUndefined(row.ratio_model)
  const ratioCompletion = numberOrUndefined(row.ratio_completion)
  const unitPrice = numberOrUndefined(row.model_price)
  const billingKind: BaseLlmSupplementalPrice['billingKind'] = unitPrice !== undefined ? 'unit' : pricePerMillionInput !== undefined || ratioModel !== undefined ? 'token' : 'unknown'
  const derivedInputPriceFromRatio = ratioModel === undefined ? undefined : ratioToUsdPerMillion(ratioModel)
  const derivedOutputPriceFromRatio = ratioModel === undefined || ratioCompletion === undefined ? undefined : roundMoney(ratioToUsdPerMillion(ratioModel) * ratioCompletion)
  const effectiveInput = pricePerMillionInput ?? derivedInputPriceFromRatio
  const effectiveOutput = pricePerMillionOutput ?? derivedOutputPriceFromRatio
  if (billingKind === 'unknown') return null
  if (billingKind === 'token' && !positiveNumber(effectiveInput) && !positiveNumber(effectiveOutput)) return null
  if (billingKind === 'unit' && !positiveNumber(unitPrice)) return null
  return {
    providerName: String(row.vendor_name ?? 'unknown'),
    sourceModelId: String(row.model_name ?? ''),
    billingKind,
    pricePerMillionInput,
    pricePerMillionOutput,
    pricePerMillionCacheRead: numberOrUndefined(row.price_per_m_cache_read),
    pricePerMillionCacheWrite: numberOrUndefined(row.price_per_m_cache_write),
    ratioModel,
    ratioCompletion,
    ratioCache: numberOrUndefined(row.ratio_cache),
    derivedInputPriceFromRatio,
    derivedOutputPriceFromRatio,
    unitPrice,
    contextWindow: contextWindowFromTags(tags),
    tags,
  }
}

function compareBaseLlmPrices(a: BaseLlmSupplementalPrice, b: BaseLlmSupplementalPrice): number {
  return priceRank(a) - priceRank(b) || a.providerName.localeCompare(b.providerName) || a.contextWindow.localeCompare(b.contextWindow)
}

function priceRank(price: BaseLlmSupplementalPrice): number {
  return price.pricePerMillionInput ?? price.derivedInputPriceFromRatio ?? price.unitPrice ?? Number.POSITIVE_INFINITY
}

function ratioToUsdPerMillion(ratio: number): number {
  return roundMoney(ratio * 2)
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6))
}

function positiveNumber(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function parseTags(value: string): string[] {
  return value.trim() === '' ? [] : value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function contextWindowFromTags(tags: string[]): string {
  const tag = tags.find((item) => /^\d+(?:\.\d+)?[KkMm]$/u.test(item))
  if (!tag) return '—'
  const match = tag.match(/^(\d+(?:\.\d+)?)([KkMm])$/u)
  if (!match) return '—'
  const amount = Number(match[1])
  const scale = match[2]!.toLowerCase() === 'm' ? 1_000_000 : 1_000
  return Math.round(amount * scale).toLocaleString('en-US')
}

function isFreeRoute(value: string): boolean {
  return /(^|:)free$/iu.test(value)
}

function normalizedModelKey(value: string): string {
  return cleanLeadingMarker(value).toLowerCase()
    .replace(/^(openai|anthropic|google|qwen|alibaba|deepseek|x-ai|xai|moonshotai|mistralai|meta-llama|cohere|z-ai|bytedance-seed|bytedance)\//u, '')
    .replace(/:(free|beta|preview)$/u, '')
    .trim()
}

function modelsDevLogoUrl(provider: JsonRecord): string | null {
  const direct = provider.logoUrl ?? provider.logoURL ?? provider.iconUrl ?? provider.iconURL ?? provider.logo ?? provider.icon
  if (typeof direct === 'string' && /^https?:\/\//u.test(direct)) return direct
  const id = typeof provider.id === 'string' ? normalizeLogoSlug(provider.id) : ''
  return id ? `https://models.dev/logos/${encodeURIComponent(id)}.svg` : null
}

function normalizeLogoSlug(value: string): string {
  const slug = normalizeSlug(value)
  if (slug === 'xai') return 'x-ai'
  if (slug === 'alibaba') return 'qwen'
  return slug
}

function makeSourceNode(sourceId: string, model: JsonRecord | undefined, endpointWrapper: JsonRecord | undefined, sitemap: JsonRecord | undefined, page: JsonRecord | undefined, pageOnlyType: string | undefined, apiOnly: boolean): OpenRouterRawNode {
  const [namespace, ...rest] = sourceId.split('/')
  const modelIdWithinNamespace = rest.join('/') || sourceId
  const pageRaw = getPageRaw(page)
  const author = cleanLeadingMarker(String(model?.id ?? sourceId).split('/')[0] ?? '') || null
  const provider = normalizeSlug(cleanLeadingMarker(namespace ?? 'unknown'))
  const providerName = titleize(provider)
  const modelId = modelIdWithinNamespace
  const route = `/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`
  const endpointListValue = endpointList(endpointWrapper)
  return {
    id: nodeIdForSource(sourceId),
    nodeKind: 'source_model',
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

function makeEndpointNodes(sourceNodes: OpenRouterRawNode[], sourceRoutes: Set<string>): OpenRouterRawNode[] {
  const byId = new Map<string, OpenRouterRawNode>()
  for (const sourceNode of sourceNodes) {
    for (const endpoint of endpointList(sourceNode.raw.endpointWrapper)) {
      const node = endpointNodeFor(sourceNode, endpoint, sourceRoutes)
      if (!byId.has(node.id)) byId.set(node.id, node)
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.sourceId.localeCompare(b.sourceId))
}

function endpointNodeFor(sourceNode: OpenRouterRawNode, endpoint: JsonRecord, sourceRoutes: Set<string> = new Set()): OpenRouterRawNode {
  const provider = endpointProviderSlug(endpoint)
  const providerName = String(endpoint.provider_name ?? titleize(provider))
  const modelId = endpointModelId(sourceNode, endpoint)
  const sourceId = `${provider}/${modelId}`
  const context = endpoint.context_length
  const baseRoute = `/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}`
  const route = sourceRoutes.has(baseRoute) ? `${baseRoute}/endpoint` : baseRoute
  return {
    id: nodeIdForEndpoint(sourceId),
    nodeKind: 'endpoint_deployment',
    dataSource: 'openrouter',
    provider,
    providerName,
    modelId,
    route,
    urlProvider: encodeURIComponent(provider),
    urlModelId: encodeURIComponent(modelId),
    sourceId,
    sourceUrl: sourceNode.sourceUrl,
    status: 'endpoint',
    namespace: provider,
    modelIdWithinNamespace: modelId,
    displayName: `${providerName}: ${modelId}`,
    raw: { endpoint, endpointWrapper: sourceNode.raw.endpointWrapper },
    derived: {
      author: sourceNode.derived.author,
      canonicalSlug: null,
      pageOnlyType: null,
      endpointCount: 1,
      endpointContextLengths: context === null || context === undefined ? [] : [context],
      endpointProviders: [providerName],
      inputModalities: sourceNode.derived.inputModalities,
      outputModalities: sourceNode.derived.outputModalities,
      pricingKeys: Object.keys(isRecord(endpoint.pricing) ? endpoint.pricing : {}).sort(),
    },
  }
}

function endpointProviderSlug(endpoint: JsonRecord): string {
  const tag = typeof endpoint.tag === 'string' && endpoint.tag.trim() ? endpoint.tag : String(endpoint.provider_name ?? 'unknown')
  return normalizeSlug(tag.replace(/\//gu, '-'))
}

function endpointModelId(sourceNode: OpenRouterRawNode, endpoint: JsonRecord): string {
  const name = typeof endpoint.name === 'string' ? endpoint.name : ''
  const afterPipe = name.includes('|') ? name.split('|').pop()?.trim() : ''
  const raw = afterPipe || sourceNode.sourceId
  const [, ...rest] = raw.split('/')
  return rest.join('/') || raw
}

function preferredSpecTarget(node: OpenRouterRawNode, sourceById: Map<string, OpenRouterRawNode>): OpenRouterRawNode {
  return aliasTargetFor(node, sourceById) ?? snapshotTargetFor(node, sourceById) ?? node
}

function aliasTargetFor(node: OpenRouterRawNode, sourceById: Map<string, OpenRouterRawNode>): OpenRouterRawNode | null {
  const explicitLatestAnchors: Record<string, string> = {
    '~anthropic/claude-haiku-latest': 'anthropic/claude-haiku-4.5',
    '~anthropic/claude-opus-latest': 'anthropic/claude-opus-4.7',
    '~anthropic/claude-sonnet-latest': 'anthropic/claude-sonnet-4.6',
    '~google/gemini-flash-latest': 'google/gemini-3.1-flash-lite',
    '~google/gemini-pro-latest': 'google/gemini-3.1-pro-preview',
    '~moonshotai/kimi-latest': 'moonshotai/kimi-k2.6',
    '~openai/gpt-latest': 'openai/gpt-5.5',
    '~openai/gpt-mini-latest': 'openai/gpt-5.4-mini',
  }
  const explicitTarget = explicitLatestAnchors[node.sourceId]
  if (explicitTarget) return sourceById.get(explicitTarget) ?? null
  if (node.sourceId === 'google/gemini-2.5-pro') return sourceById.get('google/gemini-2.5-pro-preview') ?? null
  return null
}

function aliasEvidenceFor(node: OpenRouterRawNode, target: OpenRouterRawNode): JsonRecord {
  if (node.sourceId.startsWith('~') && node.sourceId.endsWith('-latest')) {
    return {
      referenceType: 'latest_alias_anchor',
      anchorStatus: 'accepted',
      anchorSource: 'human_reviewed_openrouter_latest_mapping',
      aliasSourceId: node.sourceId,
      anchorSourceId: target.sourceId,
      note: 'OpenRouter latest alias source path folded into the selected source-model anchor for default plaza display; remains searchable by route/source id.',
    }
  }
  return { referenceType: 'source_alias_anchor', aliasSourceId: node.sourceId, anchorSourceId: target.sourceId }
}

function snapshotTargetFor(node: OpenRouterRawNode, sourceById: Map<string, OpenRouterRawNode>): OpenRouterRawNode | null {
  if (node.sourceId === 'google/gemini-2.5-pro-preview-05-06') return sourceById.get('google/gemini-2.5-pro-preview') ?? null
  const snapshotBase = stripSnapshot(node.sourceId)
  return snapshotBase && snapshotBase !== node.sourceId ? sourceById.get(snapshotBase) ?? null : null
}

function endpointList(wrapper: unknown): JsonRecord[] {
  if (!isRecord(wrapper)) return []
  const response = wrapper.response
  if (!isRecord(response) || !isRecord(response.data) || !Array.isArray(response.data.endpoints)) return []
  return response.data.endpoints.filter(isRecord)
}

function groupEndpointsBySpec(endpoints: JsonRecord[]): Map<string, JsonRecord[]> {
  const groups = new Map<string, JsonRecord[]>()
  for (const endpoint of endpoints) {
    const signature = stableJson({
      context_length: endpoint.context_length ?? null,
      max_completion_tokens: endpoint.max_completion_tokens ?? null,
      pricing: endpoint.pricing ?? null,
      supported_parameters: normalizedStringArray(endpoint.supported_parameters),
      quantization: endpoint.quantization ?? null,
    })
    const group = groups.get(signature) ?? []
    group.push(endpoint)
    groups.set(signature, group)
  }
  return groups
}

function canonicalEndpointForSpec(sourceNode: OpenRouterRawNode, endpoints: JsonRecord[]): JsonRecord {
  const sourceProvider = normalizeSlug(sourceNode.provider)
  const sameProvider = endpoints.find((endpoint) => endpointProviderSlug(endpoint) === sourceProvider)
  const sortedFirst = endpoints.slice().sort((a, b) => endpointProviderSlug(a).localeCompare(endpointProviderSlug(b)))[0]
  return sameProvider ?? sortedFirst ?? {}
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (!isRecord(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function normalizedStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map(String).sort((a, b) => a.localeCompare(b))
}

function getPageRaw(page: unknown): JsonRecord | null {
  if (!isRecord(page) || !isRecord(page.extracted) || !isRecord(page.extracted.raw)) return null
  return page.extracted.raw
}

function rawPagePermaslug(page: unknown): string | null {
  const raw = getPageRaw(page)
  return typeof raw?.permaslug === 'string' ? raw.permaslug : null
}

function nodeIdForSource(sourceId: string): string {
  return `openrouter-source:${sourceId}`
}

function nodeIdForEndpoint(sourceId: string): string {
  return `openrouter-endpoint:${sourceId}`
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

function normalizeSlug(value: string): string {
  return cleanLeadingMarker(value).trim().toLowerCase().replace(/[^a-z0-9._-]+/gu, '-') || 'unknown'
}

function cleanLeadingMarker(value: string): string {
  return value.trim().replace(/^[~-]+/u, '')
}

function titleize(value: string): string {
  return value.split(/[-_]/u).map((part) => part ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}` : part).join(' ')
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}
