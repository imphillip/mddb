import { describe, expect, it } from 'vitest'
import { buildRegistryGraphFromFiles } from './registry-graph.js'
import { renderOpenRouterProviderDetail, renderOpenRouterRawDetail, renderOpenRouterRawHome } from './openrouter-raw-renderer.js'

describe('registry graph adapter', () => {
  const graph = buildRegistryGraphFromFiles()

  it('adapts data/models.json and data/providers/*.json to the plaza graph contract', () => {
    expect(graph.stats.sourceNodes).toBeGreaterThan(300)
    expect(graph.stats.endpointNodes).toBeGreaterThan(1000)
    expect(graph.stats.pricingObservations).toBeGreaterThan(1000)
    expect(graph.nodes.find((node) => node.route === '/openai/gpt-5.5')).toBeTruthy()
    expect(graph.nodes.find((node) => node.route === '/z-ai/glm-4.5')).toBeTruthy()
    expect(graph.schema.urlShape).toBe('/<provider>/<model-id>')
  })

  it('renders the current plaza, provider, and detail UI from the new registry graph', () => {
    const home = renderOpenRouterRawHome(graph)
    const provider = renderOpenRouterProviderDetail(graph, 'openai')
    const node = graph.nodes.find((candidate) => candidate.route === '/openai/gpt-5.5')
    expect(node).toBeTruthy()
    const detail = renderOpenRouterRawDetail(graph, node!)
    const titledNode = graph.nodes.find((candidate) => candidate.route === '/anthropic/claude-opus-4.6')
    expect(titledNode).toBeTruthy()
    const titledDetail = renderOpenRouterRawDetail(graph, titledNode!)

    expect(home).toContain('模型广场')
    expect(home).toContain('data-model-row')
    expect(home).toContain('GPT-5.5')
    expect(home).not.toContain('/new-models/')
    expect(provider).toContain('OpenAI')
    expect(provider).toContain('class="modelsShell providerShell"')
    expect(provider).toContain('<span>厂牌</span>')
    expect(provider).toContain('class="modelTable"')
    expect(provider).not.toContain('返回模型广场')
    expect(detail).toContain('Model ID')
    expect(detail).toContain('价格')
    expect(detail).toContain('数据来源与源数据')
    expect(titledNode!.displayName).toBe('Claude Opus 4.6')
    expect(titledDetail).toContain('<h1>Anthropic: Claude Opus 4.6</h1>')
    expect(titledDetail).toContain('<title>Anthropic: Claude Opus 4.6 · mddb.dev</title>')
  })
})
