import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildOpenRouterRawGraphFromFiles } from './openrouter-raw-graph.js'

function writeJson(dir: string, name: string, value: unknown): string {
  const path = join(dir, name)
  writeFileSync(path, JSON.stringify(value, null, 2))
  return path
}

describe('OpenRouter raw graph v2 observations', () => {
  it('exposes citation-style graph metadata and provider-specific pricing observations without collapsing billing modes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mddb-graph-v2-'))
    const modelsPath = writeJson(dir, 'models.json', {
      data: [{
        id: 'openai/gpt-image-1',
        name: 'OpenAI: GPT Image 1',
        created: 1715558400,
        pricing: { image: '0.04' },
        architecture: { input_modalities: ['text', 'image'], output_modalities: ['image'] },
      }],
    })
    const endpointsPath = writeJson(dir, 'endpoints.json', {
      data: [{
        modelId: 'openai/gpt-image-1',
        response: { data: { endpoints: [{ tag: 'small-provider', name: 'Small Provider | openai/gpt-image-1', provider_name: 'Small Provider', pricing: { request: '0.03' }, context_length: 4096 }] } },
      }],
    })
    const sitemapPath = writeJson(dir, 'sitemap.json', { modelPages: [{ id: 'openai/gpt-image-1' }], pageOnly: [], apiOnly: [] })
    const pagesPath = writeJson(dir, 'pages.json', { data: [] })
    const baseLlmPath = writeJson(dir, 'basellm.json', {
      source: 'https://basellm.github.io/llm-metadata/api/newapi/models.json',
      models: [{ model_name: 'openai/gpt-image-1', vendor_name: '302.AI', model_price: 0.02, tags: ['Image'] }],
    })

    const graph = buildOpenRouterRawGraphFromFiles({ modelsPath, endpointsPath, sitemapPath, pagesPath, baseLlmPath })

    expect(graph.graphModel).toMatchObject({
      version: 'v2-observation-graph',
      identityBoundary: 'openrouter-source-id',
      pricingPolicy: 'provider-specific-observations-preserve-billing-mode',
    })
    expect(graph.observations?.pricing).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'openrouter',
        sourceId: 'openai/gpt-image-1',
        providerName: 'Openai',
        billingMode: 'image',
        unit: 'image',
        amountUsd: 0.04,
        confidence: 'canonical',
      }),
      expect.objectContaining({
        source: 'openrouter',
        sourceId: 'openai/gpt-image-1',
        providerName: 'Small Provider',
        billingMode: 'request',
        unit: 'request',
        amountUsd: 0.03,
        confidence: 'provider_observation',
      }),
      expect.objectContaining({
        source: 'basellm',
        sourceId: 'openai/gpt-image-1',
        providerName: '302.AI',
        billingMode: 'request',
        unit: 'request',
        amountUsd: 0.02,
        confidence: 'supplemental_exact',
      }),
    ]))
    expect(graph.observations?.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerName: 'Small Provider', source: 'openrouter', relation: 'deployment_of', targetSourceId: 'openai/gpt-image-1' }),
      expect.objectContaining({ providerName: '302.AI', source: 'basellm', relation: 'priced_by', targetSourceId: 'openai/gpt-image-1' }),
    ]))
    expect(graph.stats.pricingObservations).toBe(3)
    expect(graph.stats.providerObservations).toBe(2)
  })
})
