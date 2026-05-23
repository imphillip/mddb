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
  it('adds missing non-chat LiteLLM models to canonical models.json with normalized ids', () => {
    const root = mkdtempSync(join(tmpdir(), 'mddb-litellm-models-'))
    mkdirSync(root, { recursive: true })
    writeJson(join(root, 'models.json'), {
      schema_version: 1,
      models: [
        { id: 'gpt-4o', model: 'GPT-4o', author: 'openai', alias: ['openai/gpt-4o'], input_modalities: ['text'], output_modalities: ['text'] },
        { id: 'text-embedding-3-small', model: 'Text Embedding 3 Small', author: 'openai', alias: ['openai/text-embedding-3-small'], input_modalities: ['text'], output_modalities: ['embedding'] },
      ],
      last_updated: '2026-01-01T00:00:00.000Z',
    })

    const result = populateLiteLlmModels({
      modelsPath: join(root, 'models.json'),
      observedAt: '2026-02-03T04:05:06.000Z',
      source: {
        'azure/text-embedding-3-small': { litellm_provider: 'azure', mode: 'embedding', max_input_tokens: 8191, input_cost_per_token: 0.00000002 },
        'cohere/rerank-v3.5': { litellm_provider: 'cohere', mode: 'rerank', max_input_tokens: 4096, max_output_tokens: 4096, input_cost_per_query: 0.001 },
        'azure/gpt-4o-transcribe': { litellm_provider: 'azure', mode: 'audio_transcription', max_input_tokens: 16000, max_output_tokens: 2000, input_cost_per_audio_token: 0.000006 },
        'gemini/veo-3.1-generate-preview': { litellm_provider: 'gemini', mode: 'video_generation', max_input_tokens: 1024, output_cost_per_second: 0.4 },
        'vertex_ai/text-embedding-005': { litellm_provider: 'vertex_ai-embedding-models', mode: 'embedding', max_input_tokens: 2048, input_cost_per_token: 0.0000001 },
        'openai/gpt-4o': { litellm_provider: 'openai', mode: 'chat', max_input_tokens: 128000 },
        'some-provider/brand-new-chat': { litellm_provider: 'some_provider', mode: 'chat' },
      },
    })

    expect(result).toEqual({ added: 4, enriched: 1, skipped: 2 })
    const models = readJson(join(root, 'models.json')).models
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

    expect(models.find((model) => model.id === 'rerank-v3.5')).toMatchObject({
      model: 'Rerank v3.5',
      author: 'cohere',
      input_modalities: ['text'],
      output_modalities: ['ranking'],
      context_length: 4096,
      other_parameters: { litellm: expect.objectContaining({ mode: 'rerank', provider: 'cohere', raw_id: 'cohere/rerank-v3.5' }) },
    })
    expect(models.find((model) => model.id === 'gpt-4o-transcribe')).toMatchObject({
      author: 'openai',
      input_modalities: ['audio'],
      output_modalities: ['text'],
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
      output_modalities: ['embedding'],
    })
  })
})
