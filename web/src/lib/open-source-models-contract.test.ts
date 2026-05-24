import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type JsonRecord = Record<string, any>

function readModels(): JsonRecord[] {
  const modelsPath = join(process.cwd(), 'data', 'models.json')
  expect(existsSync(modelsPath)).toBe(true)
  const payload = JSON.parse(readFileSync(modelsPath, 'utf8')) as JsonRecord
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

describe('open-source unified models.json contract', () => {
  it('uses unique canonical model ids and aliases', () => {
    const models = readModels()
    const ids = models.map((model) => String(model.id ?? ''))
    expect(duplicates(ids)).toEqual([])

    const aliases = models.flatMap((model) => Array.isArray(model.aliases) ? model.aliases.map(String) : [])
    expect(duplicates(aliases)).toEqual([])
  })

  it('stores author identity and official pricing/endpoints on models', () => {
    const bad = readModels().filter((model) => {
      if (!model.author_id || !model.author) return true
      for (const price of model.prices ?? []) {
        if (!price.currency) return true
        const unitPrices = price.unit_prices
        if (!unitPrices || !Object.values(unitPrices).some((row: any) => typeof row?.amount === 'number' && Number.isFinite(row.amount))) return true
        if (!price.endpoint?.provider_id || !price.endpoint?.provider_name) return true
      }
      return false
    })

    expect(bad.slice(0, 20).map((model) => model.id)).toEqual([])
  })

  it('embeds model price endpoints instead of requiring provider catalogs', () => {
    const pricedModels = readModels().filter((model) => Array.isArray(model.prices) && model.prices.length > 0)
    expect(pricedModels.length).toBeGreaterThan(0)

    const missingEmbeddedEndpoints = pricedModels.filter((model) => model.prices.some((price: JsonRecord) => !price.endpoint?.provider_id || !price.endpoint?.provider_name))
    expect(missingEmbeddedEndpoints.slice(0, 20).map((model) => model.id)).toEqual([])
  })

  it('embeds Bailian CNY prices without adding region/currency schema fields', () => {
    const models = readModels()
    const qwenMax = models.find((model) => model.id === 'qwen3.7-max')
    const bailianPrices = ((qwenMax?.prices ?? []) as JsonRecord[]).filter((price: JsonRecord) => price.source === 'bailian_model_market')

    expect(bailianPrices.length).toBeGreaterThan(0)
    expect(bailianPrices.some((price: JsonRecord) => price.currency === 'CNY' && price.endpoint?.provider_id === 'alibaba-bailian-cn')).toBe(true)
    expect(JSON.stringify(qwenMax)).not.toContain('pricing_currency')
    expect(JSON.stringify(qwenMax)).not.toContain('service_site')
  })

  it('excludes provider/router products from canonical model data', () => {
    const routerIds = ['auto', 'bodybuilder', 'free', 'owl-alpha', 'pareto-code', 'router']
    const offenders = readModels().filter((model) => routerIds.includes(String(model.id ?? '')))

    expect(offenders.map((model) => model.id)).toEqual([])
  })
})
