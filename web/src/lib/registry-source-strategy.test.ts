import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

type JsonRecord = Record<string, any>

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function providers(root = process.cwd()): JsonRecord[] {
  const dir = join(root, 'data', 'providers')
  return readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => readJson(join(dir, file)))
}

function modelPayload(root = process.cwd()): { models: JsonRecord[] } {
  return readJson(join(root, 'data', 'models.json'))
}

describe('registry source strategy invariants', () => {
  it('keeps canonical model identities unique and backed by OpenRouter or LiteLLM', () => {
    const models = modelPayload().models
    const duplicateModelIds = duplicates(models.map((model) => model.id))
    expect(duplicateModelIds).toEqual([])

    const duplicateAliases = duplicates(models.flatMap((model) => Array.isArray(model.alias) ? model.alias : []))
    expect(duplicateAliases).toEqual([])

    const invalidModelSources = models
      .filter((model) => !hasSource(model, 'openrouter') && !hasSource(model, 'litellm'))
      .map((model) => model.id)
    expect(invalidModelSources).toEqual([])

    const basellmAuthoredModels = models
      .filter((model) => hasSource(model, 'basellm-newapi') || hasSource(model, 'basellm'))
      .map((model) => model.id)
    expect(basellmAuthoredModels).toEqual([])
  })

  it('keeps provider files unique and provider offers attached to canonical models', () => {
    const models = modelPayload().models
    const modelIds = new Set(models.map((model) => model.id))
    const rows = providers()
    expect(duplicates(rows.map((provider) => provider.id))).toEqual([])

    const badOffers: string[] = []
    const duplicateOffers: string[] = []
    for (const provider of rows) {
      const seen = new Set<string>()
      for (const offer of provider.offers ?? []) {
        if (!modelIds.has(offer.model_id)) badOffers.push(`${provider.id}:${offer.model_id}`)
        const key = `${offer.model_id}|${offer.api_model_id ?? ''}|${offer.endpoint_path ?? ''}`
        if (seen.has(key)) duplicateOffers.push(`${provider.id}:${key}`)
        seen.add(key)
      }
    }

    expect(badOffers).toEqual([])
    expect(duplicateOffers).toEqual([])
  })

  it('keeps source responsibilities separated after backfills', () => {
    const rows = providers()
    const modelsDevProviders = rows.filter((provider) => hasSource(provider, 'models.dev'))
    expect(modelsDevProviders.some((provider) => typeof provider.icon === 'string' && provider.icon.startsWith('/assets/provider-icons/'))).toBe(true)

    const modelsDevOnlyProvidersWithoutOffers = modelsDevProviders
      .filter((provider) => !hasNonModelsDevSource(provider) && (!Array.isArray(provider.offers) || provider.offers.length === 0))
      .map((provider) => provider.id)
    expect(modelsDevOnlyProvidersWithoutOffers).toEqual([])

    const basellmOffers = rows.flatMap((provider) => (provider.offers ?? []).filter((offer: JsonRecord) =>
      Array.isArray(offer.sources) && offer.sources.some((source: JsonRecord) => source.source === 'basellm-newapi'),
    ))
    expect(basellmOffers.length).toBeGreaterThan(0)
    const basellmWithoutDistinctPrice = basellmOffers
      .filter((offer) => !Array.isArray(offer.prices) || !offer.prices.some((price: JsonRecord) => price.source === 'basellm-newapi'))
      .filter((offer) => !samePriceAsSource(offer, 'basellm-newapi'))
      .map((offer) => `${offer.model_id}:${offer.api_model_id ?? ''}`)
    expect(basellmWithoutDistinctPrice).toEqual([])
  })

  it('keeps LiteLLM as a non-chat model and complex pricing supplement', () => {
    const models = modelPayload().models
    const litellmModels = models.filter((model) => hasSource(model, 'litellm'))
    expect(litellmModels.length).toBeGreaterThan(0)

    const litellmManagedChatModels = litellmModels
      .filter((model) => !hasSource(model, 'openrouter'))
      .filter((model) => model.output_modalities?.includes('text'))
      .map((model) => model.id)
    expect(litellmManagedChatModels).toEqual([])

    const deprecationModels = litellmModels.filter((model) => typeof model.deprecation_date === 'string')
    expect(deprecationModels.length).toBeGreaterThan(0)

    const complexPricingRows = litellmModels.flatMap((model) => litellmPriceRows(model))
      .filter((price) => price.condition || !['per_1m_tokens'].includes(price.unit))
    expect(complexPricingRows.length).toBeGreaterThan(0)
  })

  it('does not expose stale schema draft fields in current model data', () => {
    const models = modelPayload().models
    const staleFields = ['released', 'deprecation', 'max_input_tokens']
    const offenders = models.flatMap((model) => staleFields.filter((field) => model[field] !== undefined).map((field) => `${model.id}.${field}`))
    expect(offenders).toEqual([])
  })
})

function hasSource(record: JsonRecord, source: string): boolean {
  return Array.isArray(record.sources) && record.sources.some((entry) => entry?.source === source)
}

function hasNonModelsDevSource(record: JsonRecord): boolean {
  return Array.isArray(record.sources) && record.sources.some((entry) => entry?.source !== 'models.dev')
}

function litellmPriceRows(model: JsonRecord): JsonRecord[] {
  const params = model.other_parameters?.litellm
  const observations = [params, ...(Array.isArray(params?.observations) ? params.observations : [])].filter(Boolean)
  return observations.flatMap((entry) => Array.isArray(entry.prices) ? entry.prices : [])
}

function samePriceAsSource(offer: JsonRecord, source: string): boolean {
  const sourceMeta = offer.other_parameters?.basellm_newapi
  if (source !== 'basellm-newapi' || !sourceMeta) return false
  const prices = Array.isArray(offer.prices) ? offer.prices : []
  return prices.some((price) => price.source !== source && JSON.stringify(price.prices ?? {}) !== '{}')
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
