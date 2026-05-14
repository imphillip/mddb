import { describe, expect, it } from 'vitest'
import {
  normalizeModelName,
  normalizeModelTagCandidate,
  stripSnapshotSuffix,
  type ModelAliasRecord,
} from './model-normalization.js'

describe('normalizeModelTagCandidate', () => {
  it('lowercases and converts common separators to URL-safe hyphen separators', () => {
    expect(normalizeModelTagCandidate(' Claude_Sonnet 4.0 / Latest ')).toBe('claude-sonnet-4-0-latest')
  })

  it('keeps meaningful compact version markers such as 4o and r1', () => {
    expect(normalizeModelTagCandidate('GPT-4o')).toBe('gpt-4o')
    expect(normalizeModelTagCandidate('DeepSeek R1')).toBe('deepseek-r1')
  })

  it('normalizes decimal version notation to hyphenated URL-safe tags', () => {
    expect(normalizeModelTagCandidate('gemini-2.5-pro')).toBe('gemini-2-5-pro')
  })
})

describe('stripSnapshotSuffix', () => {
  it('strips compact Anthropic-style date suffixes from normalized names', () => {
    expect(stripSnapshotSuffix('claude-sonnet-4-20250514')).toEqual({
      tagCandidate: 'claude-sonnet-4',
      snapshot: '20250514',
    })
  })

  it('strips dashed OpenAI-style date suffixes from normalized names', () => {
    expect(stripSnapshotSuffix('gpt-4o-2024-08-06')).toEqual({
      tagCandidate: 'gpt-4o',
      snapshot: '2024-08-06',
    })
  })

  it('strips semantic v-style snapshot suffixes without discarding the snapshot value', () => {
    expect(stripSnapshotSuffix('claude-opus-4-6-v1')).toEqual({
      tagCandidate: 'claude-opus-4-6',
      snapshot: 'v1',
    })
  })

  it('does not strip meaningful model version numbers', () => {
    expect(stripSnapshotSuffix('gemini-2-5-pro')).toEqual({
      tagCandidate: 'gemini-2-5-pro',
      snapshot: null,
    })
  })
})

describe('normalizeModelName', () => {
  const aliases: ModelAliasRecord[] = [
    {
      alias: 'claude-sonnet-4-20250514',
      modelTag: 'claude-sonnet-4',
      aliasType: 'snapshot',
      source: 'official',
      confidence: 1,
    },
    {
      alias: 'anthropic/claude-sonnet-4',
      modelTag: 'claude-sonnet-4',
      aliasType: 'provider_route',
      source: 'openrouter',
      confidence: 0.98,
    },
  ]

  const tags = ['claude-sonnet-4', 'gpt-4o', 'gemini-2-5-pro']

  it('matches exact canonical tags first', () => {
    expect(normalizeModelName('Claude Sonnet 4', { tags, aliases })).toMatchObject({
      matchedTag: 'claude-sonnet-4',
      confidence: 1,
      matchType: 'exact_tag',
    })
  })

  it('matches provider route aliases', () => {
    expect(normalizeModelName('anthropic/claude-sonnet-4', { tags, aliases })).toMatchObject({
      matchedTag: 'claude-sonnet-4',
      matchType: 'exact_alias',
      confidence: 0.98,
    })
  })

  it('matches snapshot aliases and reports snapshot match type', () => {
    expect(normalizeModelName('claude-sonnet-4-20250514', { tags, aliases })).toMatchObject({
      matchedTag: 'claude-sonnet-4',
      matchType: 'snapshot_alias',
      confidence: 1,
    })
  })

  it('falls back to deterministic date stripping heuristic', () => {
    expect(normalizeModelName('gpt-4o-2024-08-06', { tags, aliases })).toMatchObject({
      matchedTag: 'gpt-4o',
      matchType: 'heuristic',
      confidence: 0.85,
    })
  })

  it('returns no match for unknown models', () => {
    expect(normalizeModelName('unknown-model-x', { tags, aliases })).toMatchObject({
      matchedTag: null,
      matchType: 'none',
      confidence: 0,
    })
  })
})
