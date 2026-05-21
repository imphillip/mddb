import { describe, expect, it } from 'vitest'
import { summarizeRegistryDiff } from './update-diff-summary.js'

describe('summarizeRegistryDiff', () => {
  it('groups registry changes by review strictness so OpenRouter preview is easier to judge', () => {
    const diff = [
      'diff --git a/data/models.json b/data/models.json',
      '+++ b/data/models.json',
      '+    { "id": "gemini-3.5-flash" }',
      'diff --git a/data/providers/google.json b/data/providers/google.json',
      '+++ b/data/providers/google.json',
      '+    { "model_id": "gemini-3.5-flash" }',
      'diff --git a/data/providers/openrouter.json b/data/providers/openrouter.json',
      '+++ b/data/providers/openrouter.json',
      '+    { "api_model_id": "google/gemini-3.5-flash" }',
      'diff --git a/data/providers/together.json b/data/providers/together.json',
      '+++ b/data/providers/together.json',
      '-    { "status": -5 }',
      '+    { "status": 0 }',
      'diff --git a/.internal/source-data/openrouter.raw.json b/.internal/source-data/openrouter.raw.json',
      '+++ b/.internal/source-data/openrouter.raw.json',
      '+  "fetchedAt": "2026-05-21T00:00:00Z"',
    ].join('\n')

    const summary = summarizeRegistryDiff(diff, [
      'data/models.json',
      'data/providers/google.json',
      'data/providers/openrouter.json',
      'data/providers/together.json',
      '.internal/source-data/openrouter.raw.json',
    ])

    expect(summary.totals.files).toBe(5)
    expect(summary.files.find((file) => file.path === 'data/models.json')).toMatchObject({
      category: 'canonical',
      reviewLevel: 'strict',
      addedLines: 1,
      removedLines: 0,
    })
    expect(summary.files.find((file) => file.path === 'data/providers/google.json')).toMatchObject({
      category: 'author-provider',
      reviewLevel: 'strict',
    })
    expect(summary.files.find((file) => file.path === 'data/providers/openrouter.json')).toMatchObject({
      category: 'endpoint-provider',
      reviewLevel: 'routine',
    })
    expect(summary.files.find((file) => file.path === 'data/providers/together.json')).toMatchObject({
      category: 'endpoint-provider',
      reviewLevel: 'routine',
      addedLines: 1,
      removedLines: 1,
    })
    expect(summary.files.find((file) => file.path === '.internal/source-data/openrouter.raw.json')).toMatchObject({
      category: 'source-snapshot',
      reviewLevel: 'routine',
    })
    expect(summary.groups.map((group) => [group.id, group.label, group.reviewLevel, group.files.length])).toEqual([
      ['canonical', '严格：models.json', 'strict', 1],
      ['author-provider', '严格：自研/作者 Provider', 'strict', 1],
      ['endpoint-provider', '常规：渠道/端点 Provider', 'routine', 2],
      ['source-snapshot', '常规：原始抓取快照', 'routine', 1],
    ])
  })
})
