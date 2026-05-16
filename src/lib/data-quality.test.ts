import { describe, expect, it } from 'vitest'
import type { OpenRouterRawGraph } from './openrouter-raw-graph.js'
import { buildDataQualityReport, evaluateRefreshGate } from './data-quality.js'

function graphFixture(): OpenRouterRawGraph {
  return {
    generatedAt: '2026-01-01T00:00:00.000Z',
    schema: { urlShape: '/models/<provider>/<model-id>', rawPolicy: 'preserve-upstream-key-values', providerPolicy: 'actual-deployment-provider-not-data-source', dataSource: 'openrouter' },
    graphModel: { version: 'v2-observation-graph', identityBoundary: 'openrouter-source-id', pricingPolicy: 'provider-specific-observations-preserve-billing-mode', provenancePolicy: 'facts-are-nodes-or-observations-with-source-links' },
    source: { modelsPath: 'models.json', endpointsPath: 'endpoints.json', sitemapPath: 'sitemap.json', pagesPath: 'pages.json' },
    stats: { apiModels: 2, sitemapModelPages: 3, pageOnlyModels: 1, endpointWrappers: 1, endpointRows: 1, pricingObservations: 3, providerObservations: 2, sourceNodes: 3, endpointNodes: 1, pageRows: 0, nodes: 4, edges: 0 },
    providers: [],
    nodes: [
      sourceNode('openai/gpt-4o-2024-08-06', 'api', { model: { id: 'openai/gpt-4o-2024-08-06', created: 1722902400, context_length: 128000, pricing: { prompt: '0.0000025', completion: '0.00001' } } }),
      sourceNode('openai/text-embedding-3-small', 'api', { model: { id: 'openai/text-embedding-3-small', context_length: 8192 } }),
      sourceNode('minimax/hailuo-02', 'page_only', { sitemap: { id: 'minimax/hailuo-02' } }, 'video'),
      endpointNode('openai/gpt-4o-2024-08-06', { provider_name: 'OpenAI', pricing: { prompt: '0.0000025' } }),
    ],
    edges: [],
    indices: { bySourceId: {}, byRoute: {}, pageOnlyNodeIds: ['node:source:minimax%2Fhailuo-02'], apiNodeIds: ['node:source:openai%2Fgpt-4o-2024-08-06', 'node:source:openai%2Ftext-embedding-3-small'] },
    observations: {
      pricing: [
        { id: 'p1', source: 'openrouter', sourceId: 'openai/gpt-4o-2024-08-06', providerName: 'OpenAI', billingMode: 'token_input', unit: '1M_tokens', amountUsd: 2.5, confidence: 'canonical', provenance: {} },
        { id: 'p2', source: 'openrouter', sourceId: 'openai/gpt-4o-2024-08-06', providerName: 'OpenAI', billingMode: 'token_output', unit: '1M_tokens', amountUsd: 10, confidence: 'canonical', provenance: {} },
        { id: 'p3', source: 'basellm', sourceId: 'openai/text-embedding-3-small', providerName: 'Azure', billingMode: 'token_input', unit: '1M_tokens', amountUsd: 0.02, confidence: 'supplemental_exact', provenance: {} },
      ],
      providers: [
        { id: 'v1', source: 'openrouter', providerName: 'OpenAI', relation: 'deployment_of', targetSourceId: 'openai/gpt-4o-2024-08-06', confidence: 'provider_observation', provenance: {} },
        { id: 'v2', source: 'basellm', providerName: 'Azure', relation: 'priced_by', targetSourceId: 'openai/text-embedding-3-small', confidence: 'supplemental_exact', provenance: {} },
      ],
    },
  }
}

describe('data quality report', () => {
  it('summarizes coverage, missing queues, page-only classification, and secondary-source observations', () => {
    const report = buildDataQualityReport(graphFixture())

    expect(report.coverage.totalSourceModels).toBe(3)
    expect(report.coverage.withCanonicalPricing).toBe(1)
    expect(report.coverage.withSupplementalPricing).toBe(1)
    expect(report.coverage.withAnyPricing).toBe(2)
    expect(report.coverage.withReleaseDate).toBe(1)
    expect(report.coverage.withContextWindow).toBe(2)
    expect(report.secondarySources.baseLlm.pricingSourceIds).toBe(1)
    expect(report.missing.pricing.map((row) => row.sourceId)).toEqual(['minimax/hailuo-02'])
    expect(report.missing.releaseDate.map((row) => row.sourceId)).toEqual(['openai/text-embedding-3-small', 'minimax/hailuo-02'])
    expect(report.pageOnly.byType.video).toBe(1)
    expect(report.pageOnly.candidates).toEqual([expect.objectContaining({ sourceId: 'minimax/hailuo-02', type: 'video', action: 'review' })])
  })
})

describe('refresh diff gate', () => {
  it('blocks deploy when source model count drops sharply or pricing coverage regresses', () => {
    const previous = { coverage: { totalSourceModels: 100, withAnyPricing: 90 }, observations: { pricing: 1000, providers: 500 } }
    const current = { coverage: { totalSourceModels: 70, withAnyPricing: 40 }, observations: { pricing: 500, providers: 490 } }

    const gate = evaluateRefreshGate(previous, current)

    expect(gate.status).toBe('block_deploy')
    expect(gate.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('totalSourceModels dropped'),
      expect.stringContaining('withAnyPricing dropped'),
      expect.stringContaining('pricing observations dropped'),
    ]))
  })
})

function sourceNode(sourceId: string, status: 'api' | 'page_only', raw: Record<string, unknown>, pageOnlyType: string | null = null): OpenRouterRawGraph['nodes'][number] {
  const parts = sourceId.split('/')
  const provider = parts[0] ?? 'unknown'
  const modelId = parts.slice(1).join('/') || sourceId
  return {
    id: `node:source:${encodeURIComponent(sourceId)}`,
    nodeKind: 'source_model',
    dataSource: 'openrouter',
    provider,
    providerName: provider,
    modelId,
    route: `/models/${provider}/${modelId}`,
    urlProvider: provider,
    urlModelId: modelId,
    sourceId,
    sourceUrl: `https://openrouter.ai/${sourceId}`,
    status,
    namespace: provider,
    modelIdWithinNamespace: modelId,
    displayName: modelId,
    raw,
    derived: { author: provider, canonicalSlug: null, pageOnlyType, endpointCount: 0, endpointContextLengths: [], endpointProviders: [], inputModalities: [], outputModalities: [], pricingKeys: [] },
  }
}

function endpointNode(sourceId: string, endpoint: Record<string, unknown>): OpenRouterRawGraph['nodes'][number] {
  const node = sourceNode(`${sourceId}:endpoint`, 'api', { endpoint })
  node.nodeKind = 'endpoint_deployment'
  node.status = 'endpoint'
  node.sourceId = sourceId
  return node
}
