import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// v2 contract: data/models.json is a single-entity store — model facts + per-source
// offers + other_parameters. Commercial data lives in offers[] (not embedded model-level
// prices), and source tracking lives in a separate sidecar (not in the entry).

type JsonRecord = Record<string, any>

const PRICE_UNITS = new Set([
  'per_1m_tokens',
  'per_image',
  'per_video',
  'per_request',
  'per_second',
  'per_audio_minute',
  'per_character',
])

function readModels(): JsonRecord[] {
  const modelsPath = join(process.cwd(), 'data', 'models.json')
  expect(existsSync(modelsPath)).toBe(true)
  const payload = JSON.parse(readFileSync(modelsPath, 'utf8')) as JsonRecord
  expect(payload.schema_version).toBe(2)
  expect(Array.isArray(payload.models)).toBe(true)
  return payload.models
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated].sort()
}

describe('open-source unified models.json contract (v2)', () => {
  const models = readModels()

  it('uses unique canonical model ids', () => {
    expect(duplicates(models.map((model) => String(model.id ?? '')))).toEqual([])
  })

  it('excludes router/product and moving service routes from canonical models', () => {
    const slugs = new Set(['auto', 'bodybuilder', 'free', 'model_router', 'owl-alpha', 'pareto-code', 'router'])
    const patterns = [/^group-/u, /-latest$/u, /(?:^|-)realtime(?:$|-)/u, /(?:^|-)filetrans(?:$|-)/u, /(?:^|-)livetranslate(?:$|-)/u]
    const offenders = models
      .map((model) => String(model.id ?? ''))
      .filter((id) => slugs.has(id) || patterns.some((pattern) => pattern.test(id)))
    expect(offenders).toEqual([])
  })

  it('carries commercial data in per-source offers, not embedded model-level prices', () => {
    expect(models.filter((model) => Array.isArray(model.prices)).map((model) => model.id)).toEqual([])
    const badOffers = models.flatMap((model) =>
      (model.offers ?? []).filter((offer: JsonRecord) => !offer.source || !Array.isArray(offer.prices)).map(() => model.id),
    )
    expect(badOffers).toEqual([])
  })

  it('uses known price units on every offer price component', () => {
    const bad: string[] = []
    for (const model of models) {
      for (const offer of model.offers ?? []) {
        for (const price of offer.prices ?? []) {
          for (const key of ['input', 'output', 'cache_write', 'cache_read']) {
            const component = price[key]
            if (component && !PRICE_UNITS.has(component.unit)) bad.push(`${model.id}/${offer.source}.${key}:${component.unit}`)
          }
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([])
  })

  it('embeds the Bailian CNY tiered offer on qwen3.6-max-preview', () => {
    const qwen = models.find((model) => model.id === 'qwen3.6-max-preview')
    const bailian = (qwen?.offers ?? []).find((offer: JsonRecord) => offer.source === 'bailian')
    expect(bailian?.currency).toBe('CNY')
    expect((bailian?.prices ?? []).some((price: JsonRecord) => Array.isArray(price.conditions) && price.conditions.length > 0)).toBe(true)
  })

  it('keeps models.json clean of raw upstream fields (kept in the provenance sidecar instead)', () => {
    const blob = JSON.stringify(models)
    for (const field of ['pricing_currency', 'service_site', 'tiered_pricing', 'qpm_info', 'provenance']) {
      expect(blob).not.toContain(field)
    }
  })
})
