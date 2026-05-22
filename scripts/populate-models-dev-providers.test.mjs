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
  it('enriches provider metadata and safe offers against existing canonical providers only', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-providers-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [
        { id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'] },
        { id: 'kimi-k2.5', model: 'Kimi K2.5', author: 'moonshot-ai', alias: ['moonshotai/kimi-k2.5'] },
      ],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'openai.json'), {
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      currency: 'USD',
      icon: 'https://old.example/openai.svg',
      other_parameters: { existing: true },
      offers: [{ model_id: 'gpt-4o', model: 'GPT-4o', api_model_id: 'openai/gpt-4o' }],
      sources: [{ source: 'openrouter', source_id: 'openai' }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'moonshot-ai.json'), {
      schema_version: 1,
      id: 'moonshot-ai',
      provider: 'Moonshot AI',
      currency: 'USD',
      offers: [],
      sources: [{ source: 'openrouter', source_id: 'moonshot-ai' }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'tencent.json'), {
      schema_version: 1,
      id: 'tencent',
      provider: 'Tencent',
      currency: 'USD',
      offers: [],
      sources: [{ source: 'openrouter', source_id: 'tencent' }],
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
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o', cost: { input: 2.5, output: 10 } },
          'models-dev-only-model': { id: 'models-dev-only-model', name: 'Do Not Import' },
        },
      },
      moonshotai: {
        id: 'moonshotai',
        name: 'Moonshot AI',
        iconURL: 'https://models.dev/logos/moonshotai.svg',
        models: {
          'kimi-k2.5': { id: 'kimi-k2.5', name: 'Kimi K2.5' },
        },
      },
      'tencent-coding-plan': {
        id: 'tencent-coding-plan',
        name: 'Tencent Coding Plan (China)',
        models: {
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' },
        },
      },
      github: {
        id: 'github',
        name: 'GitHub Models',
        iconURL: 'https://models.dev/logos/github.svg',
        models: {
          'gpt-4o': { id: 'gpt-4o', name: 'GPT-4o' },
        },
      },
      empty: {
        id: 'empty',
        name: 'Empty Provider',
        iconURL: 'https://models.dev/logos/empty.svg',
        models: {
          'unknown-model': { id: 'unknown-model', name: 'Unknown Model' },
        },
      },
    }

    const result = populateModelsDevProviders({ dataDir: providersDir, modelsPath: join(root, 'models.json'), source, observedAt: '2026-02-03T04:05:06.000Z' })

    expect(result).toEqual({ enriched: 3, created: 1, skipped: 1 })
    expect(readJson(join(root, 'models.json')).models).toHaveLength(2)

    const openai = readJson(join(providersDir, 'openai.json'))
    expect(openai.icon).toBe('https://models.dev/logos/openai.svg')
    expect(openai.base_url).toBe('https://api.openai.com/v1')
    expect(openai.domain).toBe('platform.openai.com')
    expect(openai.other_parameters).toMatchObject({ existing: true, models_dev: { model_count: 2, npm: '@ai-sdk/openai' } })
    expect(openai.offers).toEqual(expect.arrayContaining([
      expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'openai/gpt-4o' }),
      expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'gpt-4o', prices: [expect.objectContaining({ source: 'models.dev' })] }),
    ]))

    const moonshot = readJson(join(providersDir, 'moonshot-ai.json'))
    expect(moonshot.provider).toBe('Moonshot AI')
    expect(moonshot.icon).toBe('https://models.dev/logos/moonshotai.svg')
    expect(moonshot.offers).toEqual([expect.objectContaining({ model_id: 'kimi-k2.5', api_model_id: 'kimi-k2.5' })])
    expect(() => readJson(join(providersDir, 'moonshotai.json'))).toThrow()

    writeJson(join(providersDir, 'moonshotai.json'), { id: 'moonshotai', provider: 'Moonshot AI', offers: [], sources: [{ source: 'models.dev', source_id: 'moonshotai' }] })
    populateModelsDevProviders({ dataDir: providersDir, modelsPath: join(root, 'models.json'), source: { moonshotai: source.moonshotai }, observedAt: '2026-02-03T04:05:06.000Z' })
    expect(() => readJson(join(providersDir, 'moonshotai.json'))).toThrow()

    const tencent = readJson(join(providersDir, 'tencent.json'))
    expect(tencent.provider).toBe('Tencent')
    expect(tencent.icon).toBe('https://models.dev/logos/tencent.svg')
    expect(tencent.offers).toEqual([expect.objectContaining({ model_id: 'gpt-4o', api_model_id: 'gpt-4o' })])
    expect(() => readJson(join(providersDir, 'tencent-coding-plan.json'))).toThrow()

    const github = readJson(join(providersDir, 'github.json'))
    expect(github).toMatchObject({ id: 'github', provider: 'GitHub Models', offers: [expect.objectContaining({ model_id: 'gpt-4o' })] })
    expect(() => readJson(join(providersDir, 'empty.json'))).toThrow()
  })

  it('does not add a duplicate zero-cost models.dev offer when an unpriced OpenRouter offer for the same API id already exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-zero-cost-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [{ id: 'cobuddy', model: 'CoBuddy', author: 'baidu', alias: ['baidu/cobuddy:free', 'baidu/cobuddy-20260430'] }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    writeJson(join(providersDir, 'openrouter.json'), {
      schema_version: 1,
      id: 'openrouter',
      provider: 'OpenRouter',
      currency: 'USD',
      offers: [
        {
          model_id: 'cobuddy',
          model: 'CoBuddy',
          endpoint_path: '/chat/completions',
          api_model_id: 'baidu/cobuddy:free',
          mode: 'chat',
          prices: [],
          sources: [{ source: 'openrouter', source_id: 'baidu/cobuddy:free' }],
        },
        {
          model_id: 'cobuddy',
          model: 'CoBuddy',
          endpoint_path: 'baidu/cobuddy:free',
          api_model_id: 'baidu/cobuddy:free',
          mode: 'api',
          prices: [{ conditions: {}, prices: { input: { amount: 0, unit: 'per_1m_tokens' }, output: { amount: 0, unit: 'per_1m_tokens' } }, currency: 'USD', source: 'models.dev' }],
          sources: [{ source: 'models.dev', source_id: 'openrouter/baidu/cobuddy:free', url: 'https://models.dev/api.json' }],
        },
      ],
      sources: [{ source: 'openrouter', source_id: 'openrouter' }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })

    populateModelsDevProviders({
      dataDir: providersDir,
      modelsPath: join(root, 'models.json'),
      source: {
        openrouter: {
          id: 'openrouter',
          name: 'OpenRouter',
          models: {
            'baidu/cobuddy:free': { id: 'baidu/cobuddy:free', name: 'CoBuddy (free)', cost: { input: 0, output: 0 } },
          },
        },
      },
      observedAt: '2026-02-03T04:05:06.000Z',
    })

    const openrouter = readJson(join(providersDir, 'openrouter.json'))
    expect(openrouter.offers).toHaveLength(1)
    expect(openrouter.offers[0]).toMatchObject({ model_id: 'cobuddy', api_model_id: 'baidu/cobuddy:free', endpoint_path: '/chat/completions' })
    expect(openrouter.offers[0].prices).toEqual([])
    expect(openrouter.offers[0].sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'openrouter', source_id: 'baidu/cobuddy:free' }),
      expect.objectContaining({ source: 'models.dev', source_id: 'openrouter/baidu/cobuddy:free' }),
    ]))
  })

  it('does not rewrite providers when models.dev enrichment is already semantically present', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-models-dev-idempotent-'))
    const providersDir = join(root, 'providers')
    mkdirSync(providersDir)
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [{ id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'] }],
      last_updated: '2026-01-01T00:00:00.000Z',
    })
    const providerPath = join(providersDir, 'openai.json')
    const alreadyEnrichedProvider = {
      schema_version: 1,
      id: 'openai',
      provider: 'OpenAI',
      icon: 'https://models.dev/logos/openai.svg',
      domain: 'platform.openai.com',
      base_url: 'https://api.openai.com/v1',
      currency: 'USD',
      offers: [
        { model_id: 'gpt-4o', model: 'GPT-4o', api_model_id: 'openai/gpt-4o', sources: [{ source: 'openrouter', source_id: 'openai/gpt-4o' }] },
        {
          model_id: 'gpt-4o',
          model: 'GPT-4o',
          api_model_id: 'gpt-4o',
          endpoint_path: 'gpt-4o',
          mode: 'api',
          prices: [{ conditions: {}, prices: { input: { amount: 2.5, unit: 'per_1m_tokens' }, output: { amount: 10, unit: 'per_1m_tokens' } }, currency: 'USD', source: 'models.dev' }],
          other_parameters: { source: 'models.dev', match: 'exact' },
          sources: [{ source: 'models.dev', source_id: 'openai/gpt-4o', url: 'https://models.dev/api.json' }],
        },
      ],
      other_parameters: { existing: true, models_dev: { model_count: 1, doc: 'https://platform.openai.com/docs/models', npm: '@ai-sdk/openai', env: ['OPENAI_API_KEY'] } },
      last_updated: '2026-01-01T00:00:00.000Z',
      sources: [
        { source: 'openrouter', source_id: 'openai' },
        { source: 'models.dev', source_id: 'openai', url: 'https://models.dev/api.json', observed_at: '2026-02-03T04:05:06.000Z' },
      ],
    }
    writeJson(providerPath, alreadyEnrichedProvider)
    const before = readFileSync(providerPath, 'utf8')

    populateModelsDevProviders({
      dataDir: providersDir,
      modelsPath: join(root, 'models.json'),
      source: {
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
      },
      observedAt: '2026-02-03T04:05:06.000Z',
    })

    expect(readFileSync(providerPath, 'utf8')).toBe(before)
  })
})
