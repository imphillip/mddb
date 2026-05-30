import { describe, expect, it } from 'vitest'
import { applyFrozenFacts } from './frozen-facts.js'
import type { ModelEntry } from './schema.js'

const m = (id: string, extra: Partial<ModelEntry> = {}): ModelEntry => ({ id, model: id, offers: [], ...extra })

describe('applyFrozenFacts', () => {
  it('puts a frozen knowledge_cutoff into other_parameters, not a top-level field', () => {
    const entries = [m('a')]
    const n = applyFrozenFacts(entries, { a: { knowledge_cutoff: '2024-07' } })
    expect(entries[0]).not.toHaveProperty('knowledge_cutoff')
    expect(entries[0]!.other_parameters).toEqual({ knowledge_cutoff: '2024-07' })
    expect(n).toBe(1)
  })

  it('fills release_timestamp only when the live merge left it null', () => {
    const entries = [m('live', { release_timestamp: 100 }), m('orphan', { release_timestamp: null })]
    applyFrozenFacts(entries, { live: { release_timestamp: 999 }, orphan: { release_timestamp: 999 } })
    expect(entries[0]!.release_timestamp).toBe(100) // live value wins, not overwritten
    expect(entries[1]!.release_timestamp).toBe(999) // orphan filled
  })

  it('does not overwrite an existing other_parameters.knowledge_cutoff and preserves siblings', () => {
    const entries = [m('a', { other_parameters: { knowledge_cutoff: '2023-01', tokenizer: 'x' } })]
    applyFrozenFacts(entries, { a: { knowledge_cutoff: '2024-07' } })
    expect(entries[0]!.other_parameters).toEqual({ knowledge_cutoff: '2023-01', tokenizer: 'x' })
  })

  it('ignores models with no frozen entry', () => {
    const entries = [m('a')]
    const n = applyFrozenFacts(entries, { b: { knowledge_cutoff: '2024-07' } })
    expect(entries[0]!.other_parameters).toBeUndefined()
    expect(n).toBe(0)
  })
})
