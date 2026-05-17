import { describe, expect, it } from 'vitest'
import { buildModelNewsVocabulary } from './model-news-vocabulary.mjs'

describe('buildModelNewsVocabulary', () => {
  it('uses the anchor source model as the public model-id tag while keeping alias source ids matchable', () => {
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
      anchorNodeId: 'node:anthropic/claude-4.7',
      route: '/models/anthropic/claude-4.7/',
    })
    expect(vocab.models[0].aliases).toContain('claude-4.7-fast')
    expect(vocab.models[0].aliasSourceIds).toContain('anthropic/claude-4.7-fast')
  })

  it('resolves endpoint deployment/spec aliases to the source model anchor', () => {
    const graph = {
      providers: [{ id: 'openai', name: 'OpenAI' }],
      nodes: [
        sourceNode({ id: 'node:openai/gpt-5', sourceId: 'openai/gpt-5', modelId: 'gpt-5' }),
        endpointNode({ id: 'endpoint:openai/gpt-5:azure', sourceId: 'openai/gpt-5:azure', modelId: 'gpt-5:azure' }),
      ],
      edges: [
        { id: 'edge:endpoint:deployment', from: 'endpoint:openai/gpt-5:azure', to: 'node:openai/gpt-5', type: 'deployment_of', label: 'deployment' },
      ],
    }

    const vocab = buildModelNewsVocabulary(graph)

    expect(vocab.models).toHaveLength(1)
    expect(vocab.models[0].modelId).toBe('gpt-5')
    expect(vocab.models[0].aliases).toContain('gpt-5:azure')
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
