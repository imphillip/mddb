import { describe, expect, it } from 'vitest'
import { preprocessWaitingListCandidates, type RawWaitingListCandidate } from './waiting-list-preprocessor.js'

const canonicalTags = new Set(['gpt-4o', 'kimi-k2', 'deepseek-v3', 'qwen3-coder', 'gpt-oss-120b'])

function candidate(tag: string, source: RawWaitingListCandidate['source'] = 'basellm'): RawWaitingListCandidate {
  return {
    source,
    tag,
    name: tag,
    brand: 'Test',
    providers: ['Provider'],
    sourceIds: [tag],
    reason: 'fixture',
  }
}

describe('preprocessWaitingListCandidates', () => {
  it('separates obvious aliases, variants, wrappers, and review-ready candidates before waitinglist review', () => {
    const result = preprocessWaitingListCandidates([
      candidate('chatgpt-4o-latest', 'models.dev'),
      candidate('kimi-k2-thinking'),
      candidate('accounts-fireworks-models-deepseek-v3'),
      candidate('qwen3-coder-480b-a35b-instruct-turbo'),
      candidate('new-independent-model-1'),
    ], canonicalTags)

    expect(result.reviewReady.map((item) => item.tag)).toEqual(['new-independent-model-1'])
    expect(result.aliases).toEqual([
      expect.objectContaining({ tag: 'chatgpt-4o-latest', targetTag: 'gpt-4o', action: 'alias', reason: expect.stringContaining('latest') }),
    ])
    expect(result.variants).toEqual([
      expect.objectContaining({ tag: 'kimi-k2-thinking', targetTag: 'kimi-k2', action: 'variant', reason: expect.stringContaining('variant marker') }),
      expect.objectContaining({ tag: 'qwen3-coder-480b-a35b-instruct-turbo', targetTag: 'qwen3-coder', action: 'variant' }),
    ])
    expect(result.rejected).toEqual([
      expect.objectContaining({ tag: 'accounts-fireworks-models-deepseek-v3', targetTag: 'deepseek-v3', action: 'reject', reason: expect.stringContaining('provider route') }),
    ])
    expect(result.stats).toEqual({ total: 5, reviewReady: 1, aliases: 1, variants: 2, rejected: 1 })
  })
})
