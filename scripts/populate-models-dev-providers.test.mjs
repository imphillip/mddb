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
  it('enriches provider logo and official metadata without touching canonical models', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-providers-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [{ id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'] }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'openai.json'), {
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      currency: 'USD',
      icon_url: 'https://old.example/openai.svg',
      other_parameters: { existing: true },
      offers: [{ model_id: 'gpt-4o', model: 'GPT-4o', api_model_id: 'openai/gpt-4o' }],
      sources: [{ source: 'openrouter', source_id: 'openai' }],
      last_updated: '2026-01-01T00:00:00.000Z',
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
        models: {
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' },
          'models-dev-only-model': { id: 'models-dev-only-model', name: 'Do Not Import' },
        },
      },
      github: {
        id: 'github',
        name: 'GitHub Models',
        doc: 'https://docs.github.com/models',
        api: 'https://models.inference.ai.azure.com',
        npm: '@ai-sdk/openai-compatible',
        env: ['GITHUB_TOKEN'],
        iconURL: 'https://models.dev/logos/github.svg',
        models: {
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' },
        },
      },
      empty: {
        id: 'empty',
        name: 'Empty Provider',
        iconURL: 'https://models.dev/logos/empty.svg',
        models: {},
      },
    }

    const result = populateModelsDevProviders({ dataDir: providersDir, modelsPath: join(root, 'models.json'), source, observedAt: '2026-02-03T04:05:06.000Z' })

    expect(result).toEqual({ enriched: 1, created: 1, skipped: 1 })
    expect(readJson(join(root, 'models.json')).models).toHaveLength(1)

    const openai = readJson(join(providersDir, 'openai.json'))
    expect(openai.icon_url).toBe('https://models.dev/logos/openai.svg')
    expect(openai.base_url).toBe('https://api.openai.com/v1')
    expect(openai.domain).toBe('platform.openai.com')
    expect(openai.other_parameters).toMatchObject({
      existing: true,
      models_dev: {
        doc: 'https://platform.openai.com/docs/models',
        npm: '@ai-sdk/openai',
        env: ['OPENAI_API_KEY'],
        model_count: 2,
      },
    })
    expect(openai.offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'openai/gpt-4o' }),
      expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'gpt-4o' }),
    ]))
    expect(openai.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'models.dev', source_id: 'openai', url: 'https://models.dev/api.json' }),
    ]))

    const github = readJson(join(providersDir, 'github.json'))
    expect(github).toMatchObject({
      schema_version: 1,
      id: 'github',
      provider: 'GitHub Models',
      currency: 'USD',
      icon_url: 'https://models.dev/logos/github.svg',
      base_url: 'https://models.inference.ai.azure.com',
      domain: 'docs.github.com',
      offers: [expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'gpt-4o' })],
    })
  })
})
