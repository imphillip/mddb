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

  it('keeps endpoint-only providers out of provider news tags because provider overview pages are generated only for visible source providers', () => {
    const graph = {
      providers: [
        { id: 'xai', name: 'xAI' },
        { id: 'anthropic', name: 'Anthropic' },
      ],
      nodes: [
        sourceNode({ id: 'node:anthropic/claude', sourceId: 'anthropic/claude', modelId: 'claude' }),
        endpointNode({ id: 'endpoint:xai/grok', sourceId: 'openrouter/grok:endpoint', modelId: 'grok', provider: 'xai', providerName: 'xAI' }),
      ],
      edges: [],
    }

    const vocab = buildModelNewsVocabulary(graph)

    expect(vocab.providers.map((provider) => provider.id)).toContain('anthropic')
    expect(vocab.providers.map((provider) => provider.id)).not.toContain('xai')
  })
})

function sourceNode(overrides) {
  const sourceId = overrides.sourceId
  const modelId = overrides.modelId
  return {
    id: overrides.id,
    nodeKind: 'source_model',
    provider: sourceId.split('/')[0],
    providerName: sourceId.split('/')[0] === 'openai' ? 'OpenAI' : 'Anthropic',
    modelId,
    sourceId,
    displayName: modelId,
    modelIdWithinNamespace: modelId,
    urlProvider: sourceId.split('/')[0],
    urlModelId: modelId,
    derived: {},
  }
}

function endpointNode(overrides) {
  return {
    ...sourceNode(overrides),
    nodeKind: 'endpoint_deployment',
  }
}
