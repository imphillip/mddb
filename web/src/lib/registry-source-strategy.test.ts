import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// v2 registry invariants. The store is single-entity (offers embedded in the model), so
// these check offer/source responsibilities directly on models.json rather than on the
// legacy data/providers/*.json catalogs.

type JsonRecord = Record<string, any>

function readModels(): JsonRecord[] {
  const modelsPath = join(process.cwd(), 'data', 'models.json')
  expect(existsSync(modelsPath)).toBe(true)
  const payload = JSON.parse(readFileSync(modelsPath, 'utf8')) as JsonRecord
  return payload.models
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const value of values.filter(Boolean)) {
    if (seen.has(value)) dupes.add(value)
    seen.add(value)
  }
  return [...dupes].sort()
}

describe('registry source strategy invariants (v2)', () => {
  const models = readModels()

  it('keeps canonical model ids unique and deterministically sorted', () => {
    const ids = models.map((model) => String(model.id))
    expect(duplicates(ids)).toEqual([])
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)))
  })

  it('attaches offers with a unique source/endpoint key per model', () => {
    const bad: string[] = []
    for (const model of models) {
      const seen = new Set<string>()
      for (const offer of model.offers ?? []) {
        if (!offer.source) bad.push(`${model.id}:missing-source`)
        const key = `${offer.source}|${offer.endpoints ?? ''}`
        if (seen.has(key)) bad.push(`${model.id}:${key}`)
        seen.add(key)
      }
    }
    expect(bad).toEqual([])
  })

  it('never lets models.dev create an offer or price (icons + fact whitelist only)', () => {
    const offenders = models.flatMap((model) =>
      (model.offers ?? []).filter((offer: JsonRecord) => offer.source === 'models-dev').map(() => model.id),
    )
    expect(offenders).toEqual([])
  })

  it('keeps LiteLLM as a non-chat model and complex-pricing supplement', () => {
    const nonChat = models.filter((model) =>
      (model.offers ?? []).some(
        (offer: JsonRecord) => offer.source === 'litellm' && offer.other_params?.mode && offer.other_params.mode !== 'chat',
      ),
    )
    expect(nonChat.length).toBeGreaterThan(0)
  })

  it('preserves tiered/conditional pricing through normalization', () => {
    const tiered = models.filter((model) =>
      (model.offers ?? []).some((offer: JsonRecord) =>
        (offer.prices ?? []).some((price: JsonRecord) => Array.isArray(price.conditions) && price.conditions.length > 0),
      ),
    )
    expect(tiered.length).toBeGreaterThan(0)
  })

  it('supports max_input_tokens as a first-class v2 fact (replaces the old stale-field rule)', () => {
    const qwen = models.find((model) => model.id === 'qwen3.6-max-preview')
    expect(typeof qwen?.max_input_tokens).toBe('number')
  })
})
