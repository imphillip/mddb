import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { populateModelsDevProviders } from './lib/populate-models-dev-providers.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

describe('populateModelsDevProviders', () => {
  it('enriches models with author icons only and does not create provider offers or prices', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-icons-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [
        {
          id: 'gpt-4o',
          model: 'GPT-4o',
          name: 'GPT-4o',
          author: 'openai',
          author_id: 'openai',
          alias: ['openai/gpt-4o'],
          aliases: ['openai/gpt-4o'],
          prices: [{ source: 'openrouter', currency: 'USD', unit_prices: { input: { amount: 2.5, unit: 'per_1m_tokens' } }, endpoint: { provider_id: 'openai', provider_name: 'OpenAI' } }],
          sources: [{ source: 'openrouter', source_id: 'openai/gpt-4o' }],
        },
        {
          id: 'kimi-k2.5',
          model: 'Kimi K2.5',
          name: 'Kimi K2.5',
          author: 'moonshot-ai',
          author_id: 'moonshot-ai',
          alias: ['moonshotai/kimi-k2.5'],
          aliases: ['moonshotai/kimi-k2.5'],
          sources: [{ source: 'openrouter', source_id: 'moonshotai/kimi-k2.5' }],
        },
      ],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'openai.json'), {
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      offers: [{ model_id: 'gpt-4o', api_model_id: 'openai/gpt-4o' }],
      sources: [{ source: 'openrouter', source_id: 'openai' }],
    })
    const source = {
      openai: {
        id: 'openai',
        name: 'OpenAI',
        doc: 'https://platform.openai.com/docs/models',
        api: 'https://api.openai.com/v1',
        npm: '@ai-sdk/openai',
        env: ['OPENAI_API_KEY'],
        iconURL: 'https://models.dev/logos/openai.svg',
        models: { 'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', cost: { input: 2.5, output: 10 } } },
      },
      moonshotai: {
        id: 'moonshotai',
        name: 'Moonshot AI',
        iconURL: 'https://models.dev/logos/moonshotai.svg',
        models: { 'kimi-k2.5': { id: 'kimi-k2.5', name: 'Kimi K2.5' } },
      },
      github: {
        id: 'github',
        name: 'GitHub Models',
        iconURL: 'https://models.dev/logos/github.svg',
        models: { 'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' } },
      },
    }

    const result = populateModelsDevProviders({ modelsPath: join(root, 'models.json'), source, observedAt: '2026-02-03T04:05:06.000Z' })

    expect(result).toEqual({ enriched: 2, created: 0, skipped: 0 })
    const models = readJson(join(root, 'models.json')).models
    expect(models).toHaveLength(2)
    expect(models[0].icon).toBe('/assets/provider-icons/openai.svg')
    expect(models[0].other_parameters.models_dev.remote_icon).toBe('https://models.dev/logos/openai.svg')
    expect(models[0].prices).toEqual([{ source: 'openrouter', currency: 'USD', unit_prices: { input: { amount: 2.5, unit: 'per_1m_tokens' } }, endpoint: { provider_id: 'openai', provider_name: 'OpenAI' } }])
    expect(models[0].sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'openrouter', source_id: 'openai/gpt-4o' }),
      expect.objectContaining({ source: 'models.dev', source_id: 'openai' }),
    ]))
    expect(models[1].icon).toBe('/assets/provider-icons/moonshot-ai.svg')
    expect(models[1].other_parameters.models_dev.remote_icon).toBe('https://models.dev/logos/moonshotai.svg')

    const openaiProvider = readJson(join(providersDir, 'openai.json'))
    expect(openaiProvider).toEqual({
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      offers: [{ model_id: 'gpt-4o', api_model_id: 'openai/gpt-4o' }],
      sources: [{ source: 'openrouter', source_id: 'openai' }],
    })
  })

  it('is idempotent when icon enrichment is already present', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-icons-idempotent-'))
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [{
        id: 'gpt-4o',
        model: 'GPT-4o',
        name: 'GPT-4o',
        author: 'openai',
        author_id: 'openai',
        icon: '/assets/provider-icons/openai.svg',
        other_parameters: { models_dev: { remote_icon: 'https://models.dev/logos/openai.svg' } },
        sources: [{ source: 'models.dev', source_id: 'openai', url: 'https://models.dev/api.json', observed_at: '2026-02-03T04:05:06.000Z' }],
      }],
    })

    const result = populateModelsDevProviders({
      modelsPath: join(root, 'models.json'),
      source: { openai: { id: 'openai', name: 'OpenAI', iconURL: 'https://models.dev/logos/openai.svg' } },
      observedAt: '2026-02-03T04:05:06.000Z',
    })

    expect(result).toEqual({ enriched: 0, created: 0, skipped: 0 })
  })
})
