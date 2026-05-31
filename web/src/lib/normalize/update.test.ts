import { describe, expect, it } from 'vitest'
import { mergeWithDeprecations } from './update.js'
import type { ModelEntry } from './schema.js'

// Real models carry an author; a no-author entry is excluded by the inclusion rule (dropped, not delisted).
const m = (id: string, extra: Partial<ModelEntry> = {}): ModelEntry => ({ id, model: id, author: 'acme', offers: [], ...extra })

describe('mergeWithDeprecations', () => {
  it('keeps disappeared models and marks them delisted with today as since', () => {
    const current = [m('a'), m('gone')]
    const candidate = [m('a')]
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.models.map((x) => x.id)).toEqual(['a', 'gone'])
    expect(r.newlyDeprecated).toEqual(['gone'])
    expect(r.models.find((x) => x.id === 'gone')?.deprecation).toEqual({ status: 'delisted', since: '2026-05-29' })
    expect(r.models.find((x) => x.id === 'a')?.deprecation).toBeUndefined()
  })

  it('drops a disappeared no-author model (excluded by the rule, not delisted)', () => {
    const current = [m('a'), { id: 'search_api', model: 'search_api', offers: [] } as ModelEntry] // no author
    const candidate = [m('a')]
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.models.map((x) => x.id)).toEqual(['a']) // search_api dropped, not carried as delisted
    expect(r.newlyDeprecated).toEqual([])
  })

  it('preserves the original since date for a model that stays delisted', () => {
    const current = [m('gone', { deprecation: { status: 'delisted', since: '2026-01-01' } })]
    const candidate: ModelEntry[] = []
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.stillDeprecated).toEqual(['gone'])
    expect(r.models[0]?.deprecation?.since).toBe('2026-01-01')
  })

  it('clears the mark when a delisted model reappears in the candidate', () => {
    const current = [m('back', { deprecation: { status: 'delisted', since: '2026-01-01' } })]
    const candidate = [m('back')]
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.reactivated).toEqual(['back'])
    expect(r.models[0]?.deprecation).toBeUndefined()
  })

  it('re-normalizes carried-forward (frozen) entries: drops alias==model, lifts legacy offer endpoints to model level', () => {
    // Simulate an old-format published entry: offer-level `endpoints`, legacy string.
    const current = [
      m('legacy', {
        model: 'Legacy Model',
        alias: ['Legacy Model', 'Old Name'],
        offers: [{ source: 'litellm', currency: 'USD', prices: [], endpoints: 'openai/chat.completions' } as unknown as ModelEntry['offers'][number]],
      }),
    ]
    const r = mergeWithDeprecations(current, [], { today: '2026-05-29' })
    const carried = r.models[0]!
    expect(carried.deprecation).toEqual({ status: 'delisted', since: '2026-05-29' })
    expect(carried.alias).toEqual(['Old Name']) // 'Legacy Model' == model dropped
    expect(carried.endpoints).toEqual(['chat']) // legacy offer endpoint migrated to model level
    expect((carried.offers[0] as unknown as Record<string, unknown>)['endpoints']).toBeUndefined() // stripped from offer
  })

  it('treats a folded snapshot (now a candidate alias_id) as folded, not delisted', () => {
    const current = [m('gpt-4o-2024-08-06')] // old dated canonical id
    const candidate = [m('gpt-4o', { alias_id: ['gpt-4o-2024-08-06'] })] // folded to base
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.models.map((x) => x.id)).toEqual(['gpt-4o']) // old id dropped, not carried as delisted
    expect(r.newlyDeprecated).toEqual([])
  })

  it('adds brand-new candidate models and sorts output by id', () => {
    const current = [m('b')]
    const candidate = [m('b'), m('a'), m('c')]
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.models.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(r.newlyDeprecated).toEqual([])
  })
})
