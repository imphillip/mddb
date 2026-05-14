import { describe, expect, it } from 'vitest'
import {
  importBaseLLMRatioConfig,
  importModelsDevCatalog,
} from './source-importers.js'

describe('importModelsDevCatalog', () => {
  it('attaches lossy source facts to canonical tags while converting pricing facts', () => {
    const observedAt = '2026-05-13T00:00:00.000Z'
    const catalog = {
      anthropic: {
        models: {
          'claude-sonnet-4-20250514': {
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4 Snapshot',
            attachment: true,
            reasoning: true,
            cost: {
              input: 3,
              output: 15,
              cache_read: 0.3,
            },
            limit: {
              context: 200000,
              output: 64000,
            },
          },
        },
      },
      gateway: {
        models: {
          'claude-sonnet-4-20250514': {
            id: 'gateway/claude-sonnet-4-20250514',
            cost: {
              input: 2,
              output: 10,
              cache_read: 0.2,
              cache_write: 3.75,
            },
          },
        },
      },
      broken: {
        models: {
          'output-only-model': {
            id: 'output-only-model',
            cost: {
              input: 0,
              output: 8,
            },
          },
        },
      },
    }

    const result = importModelsDevCatalog(catalog, {
      sourceUrl: 'https://models.dev/api.json',
      observedAt,
      knownTags: ['claude-sonnet-4', 'output-only-model'],
    })

    expect(result.prices).toContainEqual({
      modelTag: 'claude-sonnet-4',
      source: 'models.dev',
      sourceModelKey: 'claude-sonnet-4-20250514',
      sourceProvider: 'gateway',
      currency: 'USD',
      unit: '1m_tokens',
      inputPrice: 2,
      outputPrice: 10,
      cacheReadPrice: 0.2,
      cacheWritePrice: 3.75,
      rawSourceUrl: 'https://models.dev/api.json',
      observedAt,
    })

    const canonicalRecord = result.sourceRecords.find(
      (record) => record.modelTag === 'claude-sonnet-4' && record.sourceProvider === 'gateway',
    )
    expect(canonicalRecord).toMatchObject({
      modelTag: 'claude-sonnet-4',
      source: 'models.dev',
      sourceModelKey: 'claude-sonnet-4-20250514',
      sourceProvider: 'gateway',
      sourceUrl: 'https://models.dev/api.json',
      observedAt,
      normalized: {
        matchedTag: 'claude-sonnet-4',
        matchType: 'heuristic',
        pricing: {
          inputPrice: 2,
          outputPrice: 10,
          cacheReadPrice: 0.2,
          cacheWritePrice: 3.75,
        },
      },
      lossyFields: {
        providerNamespace: 'gateway',
        normalizedAwaySnapshot: '20250514',
      },
    })
    expect(canonicalRecord?.rawRecord).toEqual(catalog.gateway.models['claude-sonnet-4-20250514'])

    const losingRecord = result.sourceRecords.find(
      (record) => record.modelTag === 'claude-sonnet-4' && record.sourceProvider === 'anthropic',
    )
    expect(losingRecord?.lossyFields).toMatchObject({
      conflict: {
        reason: 'lower_priority_pricing_candidate',
        selectedProvider: 'gateway',
      },
      unmodeledFields: {
        attachment: true,
        reasoning: true,
        limit: {
          context: 200000,
          output: 64000,
        },
      },
    })

    const unconvertedRecord = result.sourceRecords.find((record) => record.modelTag === 'output-only-model')
    expect(unconvertedRecord?.lossyFields).toMatchObject({
      pricingConversion: {
        reason: 'input_price_zero_with_nonzero_output',
      },
    })
    expect(result.prices.some((price) => price.modelTag === 'output-only-model')).toBe(false)
  })
})

describe('importBaseLLMRatioConfig', () => {
  it('converts New API ratio config into display prices and preserves ratio facts', () => {
    const observedAt = '2026-05-13T00:00:00.000Z'
    const ratioConfig = {
      model_ratio: {
        'gpt-4o-2024-08-06': 1.25,
      },
      completion_ratio: {
        'gpt-4o-2024-08-06': 4,
      },
      cache_ratio: {
        'gpt-4o-2024-08-06': 0.5,
      },
      create_cache_ratio: {
        'gpt-4o-2024-08-06': 1.5,
      },
    }

    const result = importBaseLLMRatioConfig(ratioConfig, {
      sourceUrl: 'https://basellm.github.io/llm-metadata/api/newapi/ratio_config-v1-base.json',
      observedAt,
      knownTags: ['gpt-4o'],
    })

    expect(result.prices).toEqual([
      {
        modelTag: 'gpt-4o',
        source: 'basellm',
        sourceModelKey: 'gpt-4o-2024-08-06',
        sourceProvider: null,
        currency: 'USD',
        unit: '1m_tokens',
        inputPrice: 2.5,
        outputPrice: 10,
        cacheReadPrice: 1.25,
        cacheWritePrice: 3.75,
        rawSourceUrl: 'https://basellm.github.io/llm-metadata/api/newapi/ratio_config-v1-base.json',
        observedAt,
      },
    ])

    expect(result.sourceRecords[0]).toMatchObject({
      modelTag: 'gpt-4o',
      source: 'basellm',
      sourceModelKey: 'gpt-4o-2024-08-06',
      sourceProvider: null,
      normalized: {
        matchedTag: 'gpt-4o',
        matchType: 'heuristic',
        pricing: {
          inputPrice: 2.5,
          outputPrice: 10,
          cacheReadPrice: 1.25,
          cacheWritePrice: 3.75,
        },
      },
      lossyFields: {
        normalizedAwaySnapshot: '2024-08-06',
        ratioConfig: {
          model_ratio: 1.25,
          completion_ratio: 4,
          cache_ratio: 0.5,
          create_cache_ratio: 1.5,
        },
      },
    })
  })
})
