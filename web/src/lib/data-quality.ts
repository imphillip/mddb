import type { OpenRouterRawGraph, OpenRouterRawNode, PricingObservation } from './openrouter-raw-graph.js'

export type DataQualityReport = {
  generatedAt: string
  coverage: {
    totalSourceModels: number
    apiModels: number
    pageOnlyModels: number
    withCanonicalPricing: number
    withSupplementalPricing: number
    withAnyPricing: number
    withReleaseDate: number
    withContextWindow: number
    withProviderObservations: number
  }
  observations: {
    pricing: number
    providers: number
  }
  secondarySources: {
    baseLlm: {
      pricingSourceIds: number
      pricingObservations: number
      providerObservations: number
    }
    modelsDev: {
      brandLogos: number
    }
  }
  missing: {
    pricing: MissingFact[]
    releaseDate: MissingFact[]
    contextWindow: MissingFact[]
    providerObservation: MissingFact[]
  }
  pageOnly: {
    total: number
    byType: Record<string, number>
    candidates: PageOnlyCandidate[]
  }
}

export type MissingFact = {
  sourceId: string
  route: string
  status: OpenRouterRawNode['status']
  reason: string
}

export type PageOnlyCandidate = {
  sourceId: string
  route: string
  type: string
  action: 'review' | 'alias' | 'variant' | 'reject'
  reason: string
}

export type RefreshGateInput = {
  coverage: Pick<DataQualityReport['coverage'], 'totalSourceModels' | 'withAnyPricing'>
  observations: Pick<DataQualityReport['observations'], 'pricing' | 'providers'>
}

export type RefreshGateResult = {
  status: 'ok' | 'block_deploy'
  reasons: string[]
}

export function buildDataQualityReport(graph: OpenRouterRawGraph): DataQualityReport {
  const sourceNodes = graph.nodes.filter((node) => node.nodeKind === 'source_model')
  const pricing = graph.observations?.pricing ?? []
  const providers = graph.observations?.providers ?? []
  const pricingBySource = groupPricing(pricing)
  const providerTargets = new Set(providers.map((provider) => provider.targetSourceId).filter((value): value is string => typeof value === 'string' && value.length > 0))

  const withCanonicalPricing = sourceNodes.filter((node) => pricingBySource.get(node.sourceId)?.some((obs) => obs.source === 'openrouter') ?? false)
  const withSupplementalPricing = sourceNodes.filter((node) => pricingBySource.get(node.sourceId)?.some((obs) => obs.source !== 'openrouter') ?? false)
  const withAnyPricing = sourceNodes.filter((node) => (pricingBySource.get(node.sourceId)?.length ?? 0) > 0)
  const withReleaseDate = sourceNodes.filter(hasReleaseDate)
  const withContextWindow = sourceNodes.filter(hasContextWindow)
  const withProviderObservations = sourceNodes.filter((node) => providerTargets.has(node.sourceId))
  const missingPricing = sourceNodes.filter((node) => (pricingBySource.get(node.sourceId)?.length ?? 0) === 0).map((node) => missing(node, 'no pricing observation'))
  const missingReleaseDate = sourceNodes.filter((node) => !hasReleaseDate(node)).map((node) => missing(node, 'no explicit or inferred release date'))
  const missingContextWindow = sourceNodes.filter((node) => !hasContextWindow(node)).map((node) => missing(node, 'no context window'))
  const missingProvider = sourceNodes.filter((node) => !providerTargets.has(node.sourceId)).map((node) => missing(node, 'no provider observation'))
  const pageOnlyNodes = sourceNodes.filter((node) => node.status === 'page_only')
  const byType: Record<string, number> = {}
  const candidates = pageOnlyNodes.map((node) => classifyPageOnly(node))
  for (const candidate of candidates) byType[candidate.type] = (byType[candidate.type] ?? 0) + 1

  return {
    generatedAt: new Date().toISOString(),
    coverage: {
      totalSourceModels: sourceNodes.length,
      apiModels: sourceNodes.filter((node) => node.status === 'api').length,
      pageOnlyModels: pageOnlyNodes.length,
      withCanonicalPricing: withCanonicalPricing.length,
      withSupplementalPricing: withSupplementalPricing.length,
      withAnyPricing: withAnyPricing.length,
      withReleaseDate: withReleaseDate.length,
      withContextWindow: withContextWindow.length,
      withProviderObservations: withProviderObservations.length,
    },
    observations: { pricing: pricing.length, providers: providers.length },
    secondarySources: {
      baseLlm: {
        pricingSourceIds: new Set(pricing.filter((obs) => obs.source === 'basellm').map((obs) => obs.sourceId)).size,
        pricingObservations: pricing.filter((obs) => obs.source === 'basellm').length,
        providerObservations: providers.filter((provider) => provider.source === 'basellm').length,
      },
      modelsDev: { brandLogos: Object.keys(graph.enrichment?.modelsDev?.brandLogos ?? {}).length },
    },
    missing: {
      pricing: missingPricing,
      releaseDate: missingReleaseDate,
      contextWindow: missingContextWindow,
      providerObservation: missingProvider,
    },
    pageOnly: { total: pageOnlyNodes.length, byType, candidates },
  }
}

export function evaluateRefreshGate(previous: RefreshGateInput, current: RefreshGateInput): RefreshGateResult {
  const reasons: string[] = []
  checkDrop(reasons, 'totalSourceModels', previous.coverage.totalSourceModels, current.coverage.totalSourceModels, 0.2)
  checkDrop(reasons, 'withAnyPricing', previous.coverage.withAnyPricing, current.coverage.withAnyPricing, 0.2)
  checkDrop(reasons, 'pricing observations', previous.observations.pricing, current.observations.pricing, 0.25)
  checkDrop(reasons, 'provider observations', previous.observations.providers, current.observations.providers, 0.35)
  return { status: reasons.length > 0 ? 'block_deploy' : 'ok', reasons }
}

function groupPricing(pricing: PricingObservation[]): Map<string, PricingObservation[]> {
  const grouped = new Map<string, PricingObservation[]>()
  for (const observation of pricing) {
    const rows = grouped.get(observation.sourceId) ?? []
    rows.push(observation)
    grouped.set(observation.sourceId, rows)
  }
  return grouped
}

function missing(node: OpenRouterRawNode, reason: string): MissingFact {
  return { sourceId: node.sourceId, route: node.route, status: node.status, reason }
}

function hasReleaseDate(node: OpenRouterRawNode): boolean {
  const model = recordOrNull(node.raw.model)
  const created = model?.created
  if (created !== undefined && created !== null && String(created) !== '') return true
  return dateFromModelId(node.sourceId) !== null || dateFromModelId(node.modelId) !== null
}

function hasContextWindow(node: OpenRouterRawNode): boolean {
  const model = recordOrNull(node.raw.model)
  const endpoint = recordOrNull(node.raw.endpoint)
  return firstNumber(model?.context_length, model?.contextLength, model?.context, endpoint?.context_length, endpoint?.contextLength, ...node.derived.endpointContextLengths) !== null
}

function classifyPageOnly(node: OpenRouterRawNode): PageOnlyCandidate {
  const type = node.derived.pageOnlyType ?? inferPageOnlyType(node.sourceId)
  if (/spawn|app|agent|router/u.test(node.sourceId)) return { sourceId: node.sourceId, route: node.route, type, action: 'reject', reason: 'app/agent/router page-only route' }
  if (/latest|preview/u.test(node.sourceId)) return { sourceId: node.sourceId, route: node.route, type, action: 'alias', reason: 'floating alias marker' }
  return { sourceId: node.sourceId, route: node.route, type, action: 'review', reason: 'page-only model candidate' }
}

function inferPageOnlyType(sourceId: string): string {
  const value = sourceId.toLowerCase()
  if (/embed|embedding|bge|e5/u.test(value)) return 'embedding'
  if (/rerank/u.test(value)) return 'rerank'
  if (/image|gpt-image|dall-e|flux|banana/u.test(value)) return 'image'
  if (/video|hailuo|sora|veo/u.test(value)) return 'video'
  if (/audio|whisper|tts|speech/u.test(value)) return 'audio'
  if (/spawn|agent|app/u.test(value)) return 'app'
  return 'unknown_page_only'
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function dateFromModelId(value: string): string | null {
  const dashed = value.match(/(?:^|[^0-9])(20\d{2})-(\d{2})-(\d{2})(?:[^0-9]|$)/u)
  if (dashed) return validDate(`${dashed[1]}-${dashed[2]}-${dashed[3]}`)
  const compact = value.match(/(?:^|[^0-9])(20\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/u)
  if (compact) return validDate(`${compact[1]}-${compact[2]}-${compact[3]}`)
  return null
}

function validDate(value: string): string | null {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10) === value ? value : null
}

function checkDrop(reasons: string[], label: string, previous: number, current: number, threshold: number): void {
  if (previous <= 0) return
  const drop = (previous - current) / previous
  if (drop > threshold) reasons.push(`${label} dropped ${(drop * 100).toFixed(1)}% (${previous} -> ${current})`)
}
