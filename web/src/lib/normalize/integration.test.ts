import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { openRouterFragment, type OpenRouterModel } from './adapters/openrouter.js'
import { bailianFragment, type BailianModel } from './adapters/bailian.js'
import { mergeFragments } from './merge.js'
import { checkOverrideStaleness, overrideFragment, type OverrideRecord } from './overrides.js'
import type { ModelEntry, SourceFragment } from './schema.js'

const load = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')) as T

const orRaw = load<OpenRouterModel>('openrouter-qwen3.6-max-preview.json')
const bailianRaw = load<BailianModel>('bailian-qwen3.6-max-preview.json')

function baseFragments(): SourceFragment[] {
  const or = openRouterFragment(orRaw, { observedAt: '2026-05-19T22:11:55.841Z' })
  const bailian = bailianFragment(bailianRaw, { observedAt: '2026-05-24T18:19:06Z' })
  if (!bailian) throw new Error('fragment unexpectedly dropped')
  return [or, bailian]
}

const byId = (entries: ModelEntry[]): Map<string, ModelEntry> =>
  new Map(entries.map((e) => [e.id, e]))

describe('full pipeline: OpenRouter + Bailian', () => {
  const auto = mergeFragments(baseFragments(), { now: '2026-05-26T21:03:51.956Z' })
  const entry = auto[0]!

  it('keeps OpenRouter release_timestamp', () => {
    expect(entry.release_timestamp).toBe(1777260242)
  })

  it('does not carry a top-level knowledge_cutoff (now frozen into other_parameters)', () => {
    expect(entry).not.toHaveProperty('knowledge_cutoff')
  })

  it('keeps the published entry clean (no embedded provenance)', () => {
    expect(entry).not.toHaveProperty('provenance')
  })
})

describe('overrides reach the curated target', () => {
  const override: OverrideRecord = {
    id: 'qwen3.6-max-preview',
    set: { model: 'Qwen 3.6 Max' },
    was: { model: 'Qwen3.6 Max Preview' },
    by: 'phillip',
    reason: 'curate canonical display name (strip Preview)',
  }
  const final = mergeFragments([...baseFragments(), overrideFragment(override)], {
    now: '2026-05-26T21:03:51.956Z',
  })
  const entry = final[0]!

  it('applies the human display name and keeps the upstream alias distinct', () => {
    expect(entry.model).toBe('Qwen 3.6 Max')
    expect(entry.alias).toEqual(['Qwen3.6 Max Preview'])
  })

  it('flags an active override as still doing its job', () => {
    const auto = byId(mergeFragments(baseFragments(), { now: 'x' }))
    const audit = checkOverrideStaleness([override], auto)
    expect(audit).toEqual([
      {
        id: 'qwen3.6-max-preview',
        field: 'model',
        status: 'active',
        overrideValue: 'Qwen 3.6 Max',
        autoValue: 'Qwen3.6 Max Preview',
      },
    ])
  })

  it('flags a redundant override (source already agrees) for retirement', () => {
    const auto = byId(mergeFragments(baseFragments(), { now: 'x' }))
    const redundant: OverrideRecord = { id: 'qwen3.6-max-preview', set: { model: 'Qwen3.6 Max Preview' } }
    const audit = checkOverrideStaleness([redundant], auto)
    expect(audit[0]?.status).toBe('redundant')
  })
})
