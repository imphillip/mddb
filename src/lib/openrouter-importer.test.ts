import { describe, expect, it } from 'vitest'
import { importOpenRouterModels, type OpenRouterModelsResponse } from './openrouter-importer.js'

const response: OpenRouterModelsResponse = {
  data: [
    {
      id: 'anthropic/claude-opus-4.7-fast',
      canonical_slug: 'anthropic/claude-4.7-opus-fast-20260512',
      name: 'Anthropic: Claude Opus 4.7 (Fast)',
      created: 1778613011,
      description: 'Fast Claude Opus release.',
      context_length: 1000000,
      architecture: {
        modality: 'text+image+file->text',
        input_modalities: ['text', 'image', 'file'],
        output_modalities: ['text'],
        tokenizer: 'Claude',
      },
      pricing: {
        prompt: '0.00003',
        completion: '0.00015',
        web_search: '0.01',
        input_cache_read: '0.000003',
        input_cache_write: '0.0000375',
      },
      top_provider: {
        context_length: 1000000,
        max_completion_tokens: 128000,
        is_moderated: true,
      },
      supported_parameters: ['max_tokens', 'temperature', 'tools'],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: '2025-10',
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/anthropic/claude-4.7-opus-fast-20260512/endpoints' },
      per_request_limits: null,
    },
    {
      id: 'openai/gpt-4o',
      canonical_slug: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      created: 1715558400,
      context_length: 128000,
      architecture: { modality: 'text+image->text', input_modalities: ['text', 'image'], output_modalities: ['text'], tokenizer: 'GPT' },
      pricing: { prompt: '0.0000025', completion: '0.00001' },
      top_provider: { context_length: 128000, max_completion_tokens: 16384, is_moderated: true },
      supported_parameters: ['tools', 'response_format'],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/openai/gpt-4o/endpoints' },
      per_request_limits: null,
    },
    {
      id: 'openai/gpt-4o-2024-08-06',
      canonical_slug: 'openai/gpt-4o-2024-08-06',
      name: 'OpenAI: GPT-4o 2024-08-06',
      created: 1722902400,
      context_length: 128000,
      architecture: { modality: 'text+image->text', input_modalities: ['text', 'image'], output_modalities: ['text'], tokenizer: 'GPT' },
      pricing: { prompt: '0.0000025', completion: '0.00001' },
      top_provider: { context_length: 128000, max_completion_tokens: 16384, is_moderated: true },
      supported_parameters: ['tools', 'response_format'],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/openai/gpt-4o-2024-08-06/endpoints' },
      per_request_limits: null,
    },
    {
      id: 'inclusionai/ring-2.6-1t:free',
      canonical_slug: 'inclusionai/ring-2.6-1t-free',
      name: 'InclusionAI: Ring 2.6 1T (free)',
      created: 1767225600,
      context_length: 262144,
      architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
      pricing: { prompt: '0', completion: '0' },
      top_provider: { context_length: 262144, max_completion_tokens: null, is_moderated: false },
      supported_parameters: [],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/inclusionai/ring-2.6-1t-free/endpoints' },
      per_request_limits: null,
    },
    {
      id: '~moonshotai/kimi-latest',
      canonical_slug: 'moonshotai/kimi-latest',
      name: 'MoonshotAI Kimi Latest',
      created: 1767225600,
      context_length: 131072,
      architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
      pricing: { prompt: '0.000001', completion: '0.000003' },
      top_provider: { context_length: 131072, max_completion_tokens: null, is_moderated: false },
      supported_parameters: [],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/moonshotai/kimi-latest/endpoints' },
      per_request_limits: null,
    },
    {
      id: 'qwen/qwen3-235b-a22b',
      canonical_slug: 'qwen/qwen3-235b-a22b',
      name: 'Qwen: Qwen3 235B A22B',
      created: 1745884800,
      context_length: 131072,
      architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'], tokenizer: 'Qwen' },
      pricing: { prompt: '0.0000002', completion: '0.0000006' },
      top_provider: { context_length: 131072, max_completion_tokens: 32768, is_moderated: false },
      supported_parameters: ['reasoning'],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: 'Qwen/Qwen3-235B-A22B',
      links: { details: '/api/v1/models/qwen/qwen3-235b-a22b/endpoints' },
      per_request_limits: null,
    },
  ],
}

describe('importOpenRouterModels', () => {
  it('normalizes source ids into logical canonical tags while preserving snapshots and variants', () => {
    const catalog = importOpenRouterModels(response)

    expect(catalog.records.map((record) => record.canonicalTag)).toEqual(['claude-opus-4-7', 'gpt-4o', 'gpt-4o', 'ring-2-6-1t', 'qwen3-235b-a22b'])
    expect(catalog.records[0]).toMatchObject({
      sourceNamespace: 'anthropic',
      sourceModelId: 'claude-opus-4.7-fast',
      canonicalTag: 'claude-opus-4-7',
      displayName: 'Claude Opus 4.7',
      brand: { slug: 'anthropic', name: 'Anthropic' },
      snapshot: { marker: '20260512', sourceCanonicalSlug: 'anthropic/claude-4.7-opus-fast-20260512' },
      variant: { marker: 'fast', kind: 'fast' },
      aliases: ['anthropic/claude-opus-4.7-fast', 'anthropic/claude-4.7-opus-fast-20260512'],
    })
    expect(catalog.records[2]).toMatchObject({
      canonicalTag: 'gpt-4o',
      snapshot: { marker: '2024-08-06', sourceCanonicalSlug: 'openai/gpt-4o-2024-08-06' },
    })
    expect(catalog.records[3]).toMatchObject({
      canonicalTag: 'ring-2-6-1t',
      variant: { marker: 'free', kind: 'free' },
    })
    expect(catalog.floatingAliases).toHaveLength(1)
    expect(catalog.floatingAliases[0]).toMatchObject({
      sourceNamespace: '~moonshotai',
      canonicalTag: 'kimi-latest',
      brand: { slug: 'moonshotai', name: 'MoonshotAI' },
      sourceAlias: { kind: 'latest', alias: '~moonshotai/kimi-latest', stable: false, targetCanonicalTag: null },
    })
    expect(catalog.records[4]).toMatchObject({
      canonicalTag: 'qwen3-235b-a22b',
      variant: null,
      snapshot: null,
    })
  })

  it('merges known OpenRouter brand aliases into stable brand filters', () => {
    const base = response.data[1]!
    const catalog = importOpenRouterModels({
      data: [
        { ...base, id: 'baidu/qianfan-ocr-fast', canonical_slug: 'baidu/qianfan-ocr-fast', name: 'Baidu Qianfan: OCR Fast' },
        { ...base, id: 'bytedance-seed/seed-1.6', canonical_slug: 'bytedance-seed/seed-1.6', name: 'ByteDance Seed: Seed 1.6' },
        { ...base, id: 'meta-llama/llama-3.3-70b', canonical_slug: 'meta-llama/llama-3.3-70b', name: 'Llama: Llama 3.3 70B' },
        { ...base, id: 'meta-llama/llama-4-maverick', canonical_slug: 'meta-llama/llama-4-maverick', name: 'Meta Llama: Llama 4 Maverick' },
        { ...base, id: 'mistralai/mistral-large', canonical_slug: 'mistralai/mistral-large', name: 'Mistralai: Mistral Large' },
        { ...base, id: 'nousresearch/hermes-4-70b', canonical_slug: 'nousresearch/hermes-4-70b', name: 'Nous: Hermes 4 70B' },
      ],
    })

    expect(catalog.records.map((record) => record.brand)).toEqual([
      { slug: 'baidu', name: 'Baidu' },
      { slug: 'bytedance', name: 'ByteDance' },
      { slug: 'meta', name: 'Meta' },
      { slug: 'meta', name: 'Meta' },
      { slug: 'mistral', name: 'Mistral' },
      { slug: 'nousresearch', name: 'NousResearch' },
    ])
  })

  it('maps OpenRouter metadata and derives USD per million plus new-api-compatible ratios', () => {
    const [claude, gpt4o, , ring] = importOpenRouterModels(response).records

    expect(claude?.metadata).toMatchObject({
      description: 'Fast Claude Opus release.',
      contextLength: 1000000,
      maxCompletionTokens: 128000,
      inputModalities: ['text', 'image', 'file'],
      outputModalities: ['text'],
      tokenizer: 'Claude',
      supportedParameters: ['max_tokens', 'temperature', 'tools'],
      knowledgeCutoff: '2025-10',
      endpointDetailsPath: '/api/v1/models/anthropic/claude-4.7-opus-fast-20260512/endpoints',
    })
    expect(claude?.pricing).toMatchObject({
      promptPer1mUsd: 30,
      completionPer1mUsd: 150,
      cacheReadPer1mUsd: 3,
      cacheWritePer1mUsd: 37.5,
      modelRatio: 15,
      completionRatio: 5,
      cacheRatio: 0.1,
      createCacheRatio: 1.25,
    })
    expect(gpt4o?.pricing).toMatchObject({ promptPer1mUsd: 2.5, completionPer1mUsd: 10, modelRatio: 1.25, completionRatio: 4 })
    expect(ring?.pricing).toMatchObject({ promptPer1mUsd: 0, completionPer1mUsd: 0, modelRatio: 0 })
  })

  it('retains the raw source record and flags invalid ratio cases without discarding source facts', () => {
    const invalidPrompt: OpenRouterModelsResponse = {
      data: [
        {
          id: 'example/output-only',
          canonical_slug: 'example/output-only',
          name: 'Example: Output Only',
          created: 1,
          context_length: 1,
          architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
          pricing: { prompt: '0', completion: '0.000001' },
          top_provider: { context_length: 1, max_completion_tokens: 1, is_moderated: false },
          supported_parameters: [],
          default_parameters: null,
          supported_voices: null,
          knowledge_cutoff: null,
          expiration_date: null,
          hugging_face_id: null,
          links: { details: '/api/v1/models/example/output-only/endpoints' },
          per_request_limits: null,
        },
      ],
    }

    const [record] = importOpenRouterModels(invalidPrompt).records

    expect(record?.sourceRecord.rawRecord).toEqual(invalidPrompt.data[0])
    expect(record?.pricing).toMatchObject({ promptPer1mUsd: 0, completionPer1mUsd: 1, ratioStatus: 'missing-prompt-baseline' })
    expect(record?.pricing.modelRatio).toBeUndefined()
    expect(record?.pricing.completionRatio).toBeUndefined()
  })

  it('skips negative prompt/completion sentinel prices', () => {
    const catalog = importOpenRouterModels({
      data: [
        {
          id: 'example/dynamic',
          canonical_slug: 'example/dynamic',
          name: 'Example: Dynamic',
          created: 1,
          context_length: 1,
          architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'] },
          pricing: { prompt: '-1', completion: '0.000001' },
          top_provider: { context_length: 1, max_completion_tokens: 1, is_moderated: false },
          supported_parameters: [],
          default_parameters: null,
          supported_voices: null,
          knowledge_cutoff: null,
          expiration_date: null,
          hugging_face_id: null,
          links: { details: '/api/v1/models/example/dynamic/endpoints' },
          per_request_limits: null,
        },
      ],
    })

    expect(catalog.records).toEqual([])
    expect(catalog.skipped).toEqual([{ id: 'example/dynamic', reason: 'negative-token-pricing' }])
  })
})
