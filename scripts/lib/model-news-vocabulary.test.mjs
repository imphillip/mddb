import { describe, expect, it } from 'vitest'
import { buildModelNewsVocabulary } from './model-news-vocabulary.mjs'

describe('buildModelNewsVocabulary', () => {
  it('uses visible Model Plaza source rows as model-id tags and keeps resolved aliases matchable', () => {
    const graph = {
      providers: [{ id: 'anthropic', name: 'Anthropic' }],
      nodes: [
        sourceNode({ id: 'node:anthropic/claude-4.7', sourceId: 'anthropic/claude-4.7', modelId: 'claude-4.7' }),
        sourceNode({ id: 'node:anthropic/claude-4.7-fast', sourceId: 'anthropic/claude-4.7-fast', modelId: 'claude-4.7-fast' }),
      ],
      edges: [
        { id: 'edge:fast:alias', from: 'node:anthropic/claude-4.7-fast', to: 'node:anthropic/claude-4.7', type: 'alias_of', label: 'alias of anthropic/claude-4.7' },
      ],
    }

    const vocab = buildModelNewsVocabulary(graph)

    expect(vocab.models).toHaveLength(1)
    expect(vocab.models[0]).toMatchObject({
      modelId: 'claude-4.7',
      sourceId: 'anthropic/claude-4.7',
      route: '/models/anthropic/claude-4.7/',
    })
    expect(vocab.models[0].aliases).toContain('claude-4.7-fast')
    expect(vocab.models[0].aliasSourceIds).toContain('anthropic/claude-4.7-fast')
  })

  it('keeps separate visible source rows for meaningful model versions and series members', () => {
    const graph = {
      providers: [{ id: 'openai', name: 'OpenAI' }],
      nodes: [
        sourceNode({ id: 'node:openai/gpt-4', sourceId: 'openai/gpt-4', modelId: 'gpt-4' }),
        sourceNode({ id: 'node:openai/gpt-4.6', sourceId: 'openai/gpt-4.6', modelId: 'gpt-4.6' }),
        sourceNode({ id: 'node:openai/gpt-4.7', sourceId: 'openai/gpt-4.7', modelId: 'gpt-4.7' }),
      ],
      edges: [
        { id: 'edge:gpt-4.6:variant', from: 'node:openai/gpt-4.6', to: 'node:openai/gpt-4', type: 'variant_of', label: 'variant of gpt-4' },
        { id: 'edge:gpt-4.7:variant', from: 'node:openai/gpt-4.7', to: 'node:openai/gpt-4', type: 'variant_of', label: 'variant of gpt-4' },
      ],
    }

    const vocab = buildModelNewsVocabulary(graph)

    expect(vocab.models.map((model) => model.modelId).sort()).toEqual(['gpt-4', 'gpt-4.6', 'gpt-4.7'])
  })

  it('maps tagged provider names to valid entity routes, including canonical organizations and endpoint-only providers', () => {
    const graph = {
      providers: [
        { id: 'x-ai', name: 'X Ai' },
        { id: 'xai', name: 'xAI' },
        { id: 'together', name: 'Together' },
        { id: 'anthropic', name: 'Anthropic' },
      ],
      nodes: [
        sourceNode({ id: 'node:x-ai/grok', sourceId: 'x-ai/grok', modelId: 'grok', providerName: 'X Ai' }),
        sourceNode({ id: 'node:anthropic/claude', sourceId: 'anthropic/claude', modelId: 'claude' }),
        endpointNode({ id: 'endpoint:xai/grok', sourceId: 'xai/grok', modelId: 'grok', provider: 'xai', providerName: 'xAI', author: 'x-ai' }),
        endpointNode({ id: 'endpoint:together/qwen', sourceId: 'together/qwen', modelId: 'qwen', provider: 'together', providerName: 'Together', author: 'qwen' }),
      ],
      edges: [],
    }

    const vocab = buildModelNewsVocabulary(graph)

    expect(vocab.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'xai', name: 'xAI', route: '/models/x-ai/' }),
      expect.objectContaining({ id: 'together', name: 'Together', route: '/models/?provider=together' }),
      expect.objectContaining({ id: 'anthropic', name: 'Anthropic', route: '/models/anthropic/' }),
    ]))
  })
})

function sourceNode(overrides) {
  const sourceId = overrides.sourceId
  const modelId = overrides.modelId
  const provider = overrides.provider ?? sourceId.split('/')[0]
  return {
    id: overrides.id,
    nodeKind: 'source_model',
    provider,
    providerName: overrides.providerName ?? (provider === 'openai' ? 'OpenAI' : provider === 'x-ai' ? 'X Ai' : 'Anthropic'),
    modelId,
    sourceId,
    displayName: modelId,
    modelIdWithinNamespace: modelId,
    urlProvider: overrides.urlProvider ?? provider,
    urlModelId: modelId,
    derived: { author: overrides.author },
  }
}

function endpointNode(overrides) {
  return {
    ...sourceNode(overrides),
    nodeKind: 'endpoint_deployment',
  }
}
