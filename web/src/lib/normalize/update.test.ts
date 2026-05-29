import { describe, expect, it } from 'vitest'
import { mergeWithDeprecations } from './update.js'
import type { ModelEntry } from './schema.js'

const m = (id: string, extra: Partial<ModelEntry> = {}): ModelEntry => ({ id, model: id, offers: [], ...extra })

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

  it('re-normalizes carried-forward (frozen) entries: drops alias==model and migrates legacy endpoints', () => {
    const current = [
      m('legacy', {
        model: 'Legacy Model',
        alias: ['Legacy Model', 'Old Name'],
        offers: [{ source: 'litellm', currency: 'USD', prices: [], endpoints: 'openai/chat.completions' }],
      }),
    ]
    const r = mergeWithDeprecations(current, [], { today: '2026-05-29' })
    const carried = r.models[0]!
    expect(carried.deprecation).toEqual({ status: 'delisted', since: '2026-05-29' })
    expect(carried.alias).toEqual(['Old Name']) // 'Legacy Model' == model dropped
    expect(carried.offers[0]?.endpoints).toBe('chat') // legacy endpoint migrated
  })

  it('adds brand-new candidate models and sorts output by id', () => {
    const current = [m('b')]
    const candidate = [m('b'), m('a'), m('c')]
    const r = mergeWithDeprecations(current, candidate, { today: '2026-05-29' })
    expect(r.models.map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(r.newlyDeprecated).toEqual([])
  })
})
