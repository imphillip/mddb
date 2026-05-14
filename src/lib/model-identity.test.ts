import { describe, expect, it } from 'vitest'
import { resolveModelsDevIdentity } from './model-identity.js'

const base = { providerId: 'models-dev', name: '', flags: { attachment: false, reasoning: false, tool_call: false } }

function resolve(id: string, name = id, providerId = 'models-dev') {
  return resolveModelsDevIdentity({ ...base, id, name, providerId })
}

describe('resolveModelsDevIdentity', () => {
  it('normalizes route, provider, region, spelling, and deployment wrappers into canonical tags', () => {
    const cases = [
      ['anthropic/claude-opus-4.6', 'claude-opus-4-6'],
      ['eu-anthropic-claude-opus-4-6', 'claude-opus-4-6'],
      ['databricks-claude-opus-4-6', 'claude-opus-4-6'],
      ['claude-4-6-opus', 'claude-opus-4-6'],
      ['claude-opus4-6', 'claude-opus-4-6'],
      ['claude-haiku-4-5-20251001', 'claude-haiku-4-5'],
      ['claude-4-5-haiku', 'claude-haiku-4-5'],
      ['claude-haiku4-5', 'claude-haiku-4-5'],
      ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-5'],
      ['claude-4-5-sonnet', 'claude-sonnet-4-5'],
      ['claude-sonnet4-5', 'claude-sonnet-4-5'],
      ['openai/gpt-4o', 'gpt-4o'],
      ['azure-gpt-4o', 'gpt-4o'],
      ['google/gemini-2.5-pro', 'gemini-2-5-pro'],
      ['databricks-gemini-2-5-pro', 'gemini-2-5-pro'],
      ['us-deepseek-r1', 'deepseek-r1'],
      ['qwen/qwen3-235b-a22b', 'qwen3-235b-a22b'],
    ] as const

    for (const [id, canonicalTag] of cases) {
      expect(resolve(id).canonicalTag, id).toBe(canonicalTag)
    }
  })

  it('preserves date and semantic snapshots without leaking them into canonical tags', () => {
    expect(resolve('gpt-4o-2024-08-06')).toMatchObject({
      canonicalTag: 'gpt-4o',
      snapshot: { marker: '2024-08-06', snapshotId: 'gpt-4o-2024-08-06' },
      versionId: 'gpt-4o-2024-08-06',
    })

    expect(resolve('claude-opus-4-6-v1')).toMatchObject({
      canonicalTag: 'claude-opus-4-6',
      snapshot: { marker: 'v1', snapshotId: 'claude-opus-4-6-v1' },
      versionId: 'claude-opus-4-6-v1',
    })
  })

  it('uses variant IDs for user-visible behavior suffixes but not for plain deployments', () => {
    expect(resolve('claude-opus-4-6-thinking')).toMatchObject({
      canonicalTag: 'claude-opus-4-6',
      versionId: 'claude-opus-4-6-thinking',
      variant: { kind: 'thinking', marker: 'thinking' },
    })

    expect(resolve('databricks-claude-opus-4-6')).toMatchObject({
      canonicalTag: 'claude-opus-4-6',
      versionId: 'claude-opus-4-6',
      variant: null,
      deploymentHints: expect.arrayContaining([{ kind: 'wrapper', value: 'databricks' }]),
    })
  })

  it('keeps meaningful model family versions as canonical identity', () => {
    expect(resolve('deepseek-r1').canonicalTag).toBe('deepseek-r1')
    expect(resolve('gemini-2.5-pro').canonicalTag).toBe('gemini-2-5-pro')
    expect(resolve('qwen3-235b-a22b').canonicalTag).toBe('qwen3-235b-a22b')
    expect(resolve('llama-4-maverick-17b-128e-instruct').canonicalTag).toBe('llama-4-maverick-17b-128e-instruct')
  })
})
