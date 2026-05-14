import { describe, expect, it } from 'vitest'
import { buildModelGalleryFromOpenRouterCatalog } from './openrouter-gallery.js'
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
      architecture: { modality: 'text+image+file->text', input_modalities: ['text', 'image', 'file'], output_modalities: ['text'], tokenizer: 'Claude' },
      pricing: { prompt: '0.00003', completion: '0.00015', input_cache_read: '0.000003', input_cache_write: '0.0000375' },
      top_provider: { context_length: 1000000, max_completion_tokens: 128000, is_moderated: true },
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
      id: 'openrouter/free',
      canonical_slug: 'openrouter/free',
      name: 'OpenRouter: Free Models Router',
      created: 1700000000,
      description: 'OpenRouter free model router.',
      context_length: 128000,
      architecture: { modality: 'text->text', input_modalities: ['text'], output_modalities: ['text'], tokenizer: null },
      pricing: { prompt: '0', completion: '0' },
      top_provider: { context_length: 128000, max_completion_tokens: 4096, is_moderated: false },
      supported_parameters: ['max_tokens'],
      default_parameters: null,
      supported_voices: null,
      knowledge_cutoff: null,
      expiration_date: null,
      hugging_face_id: null,
      links: { details: '/api/v1/models/openrouter/free/endpoints' },
      per_request_limits: null,
    },
  ],
}

describe('buildModelGalleryFromOpenRouterCatalog', () => {
  it('groups OpenRouter source records into canonical model pages and variants', () => {
    const gallery = buildModelGalleryFromOpenRouterCatalog(importOpenRouterModels(response), { sourcePath: 'fixtures/openrouter.json' })

    expect(gallery.source).toEqual({ source: 'openrouter', path: 'fixtures/openrouter.json', modelRows: 4, floatingAliasRows: 0, skippedRows: 0 })
    expect(gallery.models.map((model) => model.tag)).toEqual(['claude-opus-4-7', 'gpt-4o', 'openrouter-free'])
    expect(gallery.stats).toMatchObject({ modelCount: 3, brandCount: 3, providerCount: 3, variantCount: 4 })

    const claude = gallery.details.find((model) => model.tag === 'claude-opus-4-7')
    expect(claude).toMatchObject({
      name: 'Claude Opus 4.7',
      brand: { slug: 'anthropic', name: 'Anthropic' },
      contextWindow: '1,000,000',
      inputPrice: '$30 / 1M',
      outputPrice: '$150 / 1M',
      providerNames: ['Anthropic'],
      variantCount: 1,
    })
    expect(claude?.variants[0]).toMatchObject({
      id: 'claude-opus-4-7-fast-20260512',
      name: 'Claude Opus 4.7 · fast · 20260512',
      differences: ['variant fast', 'snapshot 20260512', 'OpenRouter id anthropic/claude-opus-4.7-fast'],
      providers: [{ slug: 'anthropic', name: 'Anthropic', region: 'OpenRouter' }],
    })

    const gpt4o = gallery.details.find((model) => model.tag === 'gpt-4o')
    expect(gpt4o?.variants.map((variant) => variant.id)).toEqual(['gpt-4o', 'gpt-4o-2024-08-06'])
    expect(gpt4o?.modalities).toEqual(['文本', '视觉', '工具', '结构化输出'])
    const openRouterRouter = gallery.details.find((model) => model.tag === 'openrouter-free')
    expect(openRouterRouter).toMatchObject({
      name: 'Free Models Router',
      route: '/models/openrouter-free',
      apiIdentifier: 'free',
    })
  })
})
