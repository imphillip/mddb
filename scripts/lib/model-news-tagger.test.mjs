import { describe, expect, it } from 'vitest'
import { deterministicTags } from './model-news-tagger.mjs'

describe('deterministicTags', () => {
  it('emits the anchor model-id when a news item matches a variant alias', () => {
    const vocab = {
      providers: [{ id: 'anthropic', name: 'Anthropic', aliases: ['Anthropic'] }],
      models: [
        {
          modelId: 'claude-4.7',
          provider: 'anthropic',
          displayName: 'Claude 4.7',
          aliases: ['claude-4.7', 'claude-4.7-fast'],
          aliasSourceIds: ['anthropic/claude-4.7', 'anthropic/claude-4.7-fast'],
        },
      ],
    }

    const tags = deterministicTags({ title: 'Claude 4.7 Fast 用户反馈不错', summary: '', source: '', url: '' }, vocab)

    expect(tags.models).toEqual([expect.objectContaining({ value: 'claude-4.7' })])
    expect(tags.providers).toEqual([expect.objectContaining({ value: 'anthropic' })])
  })

  it('keeps multiple matching provider and model tags', () => {
    const vocab = {
      providers: [
        { id: 'openai', name: 'OpenAI', aliases: ['OpenAI'] },
        { id: 'anthropic', name: 'Anthropic', aliases: ['Anthropic'] },
      ],
      models: [
        { modelId: 'gpt-5', provider: 'openai', displayName: 'GPT-5', aliases: ['gpt-5'] },
        { modelId: 'claude-4.7', provider: 'anthropic', displayName: 'Claude 4.7', aliases: ['claude-4.7'] },
      ],
    }

    const tags = deterministicTags({ title: 'GPT-5 和 Claude 4.7 在代码场景中的对比', summary: '', source: '', url: '' }, vocab)

    expect(tags.models.map((tag) => tag.value)).toEqual(['claude-4.7', 'gpt-5'])
    expect(tags.providers.map((tag) => tag.value).sort()).toEqual(['anthropic', 'openai'])
  })
})
