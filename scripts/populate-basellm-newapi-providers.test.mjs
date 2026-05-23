import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { populateBaseLlmNewapiProviders } from './lib/populate-basellm-newapi-providers.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

describe('populateBaseLlmNewapiProviders', () => {
  it('adds BaseLLM prices only for canonical matches without touching models.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-basellm-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    const models = {
      schema_version: 1,
      models: [
        { id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'] },
        { id: 'kimi-k2.5', model: 'Kimi K2.5', author: 'moonshot-ai', alias: ['moonshotai/kimi-k2.5'] },
      ],
      last_updated: '2026-01-01T00:00:00.000Z',
    }
    writeJson(join(root, 'models.json'), models)
    writeJson(join(providersDir, 'openai.json'), {
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      currency: 'USD',
      offers: [{
        model_id: 'gpt-4o',
        model: 'GPT-4o',
        api_model_id: 'openai/gpt-4o',
        prices: [{ conditions: {}, prices: { input: { amount: 5, unit: 'per_1m_tokens' } }, currency: 'USD', source: 'openrouter-endpoint' }],
        sources: [{ source: 'openrouter:endpoints', source_id: 'openai/gpt-4o#OpenAI' }],
      }],
      sources: [{ source: 'openrouter', source_id: 'openai' }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })

    const result = populateBaseLlmNewapiProviders({
      dataDir: providersDir,
      modelsPath: join(root, 'models.json'),
      observedAt: '2026-02-03T04:05:06.000Z',
      source: {
        models: [
          { vendor_name: 'OpenAI', model_name: 'openai/gpt-4o', price_per_m_input: 2.5, price_per_m_output: 10, ratio_model: 1.25, ratio_completion: 4, tags: 'Vision,128K' },
          { vendor_name: '302.AI', model_name: 'kimi-k2.5', price_per_m_input: 0.15, price_per_m_output: 2.5, ratio_model: 0.075, ratio_completion: 16.6667, tags: '128K' },
          { vendor_name: '302.AI', model_name: 'unknown-model', price_per_m_input: 1, price_per_m_output: 2 },
          { vendor_name: 'Free Vendor', model_name: 'openai/gpt-4o:free', price_per_m_input: 0, price_per_m_output: 0 },
        ],
      },
    })

    expect(result).toMatchObject({ enriched: 1, created: 1, matched: 2, skipped: 1, freeFiltered: 1 })
    expect(readJson(join(root, 'models.json'))).toEqual(models)

    const openai = readJson(join(providersDir, 'openai.json'))
    expect(openai.offers).toHaveLength(1)
    expect(openai.offers[0].prices).toEqual([expect.objectContaining({ source: 'openrouter-endpoint' })])
    expect(openai.offers[0].sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'openrouter:endpoints' }),
      expect.objectContaining({ source: 'basellm-newapi', source_id: 'OpenAI/openai/gpt-4o' }),
    ]))
    expect(openai.offers[0].other_parameters.basellm_newapi).toMatchObject({ vendor_name: 'OpenAI', match: 'exact_source_id' })

    const vendor302 = readJson(join(providersDir, '302-ai.json'))
    expect(vendor302).toMatchObject({ id: '302-ai', provider: '302.AI' })
    expect(vendor302.offers).toEqual([expect.objectContaining({ model_id: 'kimi-k2.5', api_model_id: 'kimi-k2.5' })])
    expect(vendor302.offers[0].prices).toEqual([expect.objectContaining({
      source: 'basellm-newapi',
      prices: {
        input: { amount: 0.15, unit: 'per_1m_tokens' },
        output: { amount: 2.5, unit: 'per_1m_tokens' },
      },
      raw_pricing: expect.objectContaining({ ratio_model: 0.075 }),
    })])
  })
})
