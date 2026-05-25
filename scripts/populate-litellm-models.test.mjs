import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { populateLiteLlmModels } from './lib/populate-litellm-models.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

describe('populateLiteLlmModels', () => {
  it('maps LiteLLM non-chat modes to plaza filter output categories and does not invent release dates from import time', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-litellm-models-'))
    const modelsPath = join(root, 'models.json')
    mkdirSync(root, { recursive: true })
    writeJson(modelsPath, { schema_version: 1, models: [] })

    populateLiteLlmModels({
      modelsPath,
      observedAt: '2026-05-23T00:00:00.000Z',
      source: {
        'text-embedding-3-small': { mode: 'embedding', litellm_provider: 'openai' },
        'cohere-rerank-v3.5': { mode: 'rerank', litellm_provider: 'cohere' },
        'gpt-4o-mini-transcribe': { mode: 'audio_transcription', litellm_provider: 'openai' },
        'gpt-4o-mini-tts': { mode: 'audio_speech', litellm_provider: 'openai', supported_modalities: ['text'], supported_output_modalities: ['audio'] },
      },
    })

    const payload = readJson(modelsPath)
    const byId = new Map(payload.models.map((model) => [model.id, model]))

    expect(byId.get('text-embedding-3-small')?.output_modalities).toEqual(['embeddings'])
    expect(byId.get('cohere-rerank-v3.5')?.output_modalities).toEqual(['rerank'])
    expect(byId.get('gpt-4o-mini-transcribe')?.output_modalities).toEqual(['transcription'])
    expect(byId.get('gpt-4o-mini-tts')?.output_modalities).toEqual(['speech'])
    for (const model of payload.models) {
      expect(model.release_timestamp).toBeUndefined()
      expect(model.release_date).toBeUndefined()
      expect(model.created).toBeUndefined()
      expect(model.last_updated).toBeUndefined()
      expect(model.sources[0].observed_at).toBe('2026-05-23T00:00:00.000Z')
    }
  })

  it('adds missing non-chat LiteLLM models to canonical models.json with normalized ids', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-litellm-models-'))
    mkdirSync(root, { recursive: true })
    const modelsPath = join(root, 'models.json')
    writeJson(modelsPath, {
      schema_version: 1,
      models: [
        { id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'], input_modalities: ['text'], output_modalities: ['text'] },
        { id: 'text-embedding-3-small', model: 'Text Embedding 3 Small', author: 'openai', alias: ['openai/text-embedding-3-small'], input_modalities: ['text'], output_modalities: ['embedding'] },
      ],
      last_updated: '2026-01-01T00:00:00.000Z',
    })

    const result = populateLiteLlmModels({
      modelsPath,
      observedAt: '2026-02-03T04:05:06.000Z',
      source: {
        'azure/text-embedding-3-small': { litellm_provider: 'azure', mode: 'embedding', max_input_tokens: 8191, input_cost_per_token: 0.00000002, input_cost_per_token_above_272k_tokens_priority: 0.00001 },
        'cohere/rerank-v3.5': { litellm_provider: 'cohere', mode: 'rerank', max_input_tokens: 4096, max_output_tokens: 4096, input_cost_per_query: 0.001 },
        'azure/gpt-4o-transcribe': { litellm_provider: 'azure', mode: 'audio_transcription', max_input_tokens: 16000, max_output_tokens: 2000, input_cost_per_audio_token: 0.000006 },
        'gemini/veo-3.1-generate-preview': { litellm_provider: 'gemini', mode: 'video_generation', max_input_tokens: 1024, output_cost_per_second: 0.4 },
        'vertex_ai/text-embedding-005': { litellm_provider: 'vertex_ai-embedding-models', mode: 'embedding', max_input_tokens: 2048, input_cost_per_token: 0.0000001 },
        'openai/gpt-4o': { litellm_provider: 'openai', mode: 'chat', max_input_tokens: 128000 },
        'some-provider/brand-new-chat': { litellm_provider: 'some_provider', mode: 'chat' },
        'bedrock/amazon.titan-embed-text-v2:0': { litellm_provider: 'bedrock', mode: 'embedding', input_cost_per_token: 0.00000002 },
        'azure/azure-tts': { litellm_provider: 'azure', mode: 'audio_speech', input_cost_per_token: 0.00000002 },
      },
    })

    expect(result).toEqual({ added: 4, enriched: 1, skipped: 4 })
    const models = readJson(modelsPath).models
    expect(models.map((model) => model.id)).toEqual([
      'gpt-4o',
      'text-embedding-3-small',
      'rerank-v3.5',
      'gpt-4o-transcribe',
      'veo-3.1-generate-preview',
      'text-embedding-005',
    ])

    const existing = models.find((model) => model.id === 'text-embedding-3-small')
    expect(existing.alias).toEqual(expect.arrayContaining(['openai/text-embedding-3-small', 'azure/text-embedding-3-small']))
    expect(existing.sources).toEqual([expect.objectContaining({ source: 'litellm', source_id: 'azure/text-embedding-3-small' })])
    expect(existing.other_parameters?.litellm?.prices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'input',
        amount: 10,
        unit: 'per_1m_tokens',
        source_key: 'input_cost_per_token_above_272k_tokens_priority',
        condition: 'above 272k tokens priority',
      }),
    ]))

    expect(models.find((model) => model.id === 'rerank-v3.5')).toMatchObject({
      model: 'Rerank v3.5',
      author: 'cohere',
      input_modalities: ['text'],
      output_modalities: ['rerank'],
      context_length: 4096,
      other_parameters: { litellm: expect.objectContaining({ mode: 'rerank', provider: 'cohere', raw_id: 'cohere/rerank-v3.5' }) },
    })
    expect(models.find((model) => model.id === 'gpt-4o-transcribe')).toMatchObject({
      author: 'openai',
      input_modalities: ['audio'],
      output_modalities: ['transcription'],
      context_length: 16000,
      max_output_tokens: 2000,
    })
    expect(models.find((model) => model.id === 'veo-3.1-generate-preview')).toMatchObject({
      author: 'google',
      input_modalities: ['text'],
      output_modalities: ['video'],
    })
    expect(models.find((model) => model.id === 'text-embedding-005')).toMatchObject({
      author: 'google',
      input_modalities: ['text'],
      output_modalities: ['embeddings'],
    })
    expect(models.find((model) => model.id === 'text-embedding-005')).not.toHaveProperty('deprecation_date')

    populateLiteLlmModels({
      modelsPath,
      observedAt: '2026-05-23T00:00:00.000Z',
      source: {
        'text-embedding-005': { mode: 'embedding', litellm_provider: 'vertex_ai-embedding-models', deprecation_date: '2026-01-14' },
      },
    })

    expect(readJson(modelsPath).models.find((model) => model.id === 'text-embedding-005')).toMatchObject({
      deprecation_date: '2026-01-14',
      other_parameters: { litellm: expect.objectContaining({
        deprecation_date: '2026-01-14',
        observations: expect.arrayContaining([
          expect.objectContaining({ raw_id: 'vertex_ai/text-embedding-005', prices: expect.arrayContaining([{ kind: 'input', amount: 0.1, unit: 'per_1m_tokens', source_key: 'input_cost_per_token' }]) }),
          expect.objectContaining({ raw_id: 'text-embedding-005', deprecation_date: '2026-01-14' }),
        ]),
      }) },
    })
  })
})
