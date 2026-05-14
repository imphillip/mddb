import { describe, expect, it } from 'vitest'
import { buildModelGallery, getModelDetail } from './model-catalog.js'

describe('buildModelGallery', () => {
  it('groups canonical models by model brand rather than provider', () => {
    const gallery = buildModelGallery()

    expect(gallery.brands.map((brand) => brand.slug)).toEqual(['anthropic', 'openai', 'google', 'deepseek', 'meta'])
    expect(gallery.brands[0]?.models.map((model) => model.tag)).toContain('claude-sonnet-4')
    expect(gallery.brands[0]?.models[0]?.brand.name).toBe('Anthropic')
  })

  it('compresses providers into model deployment metadata', () => {
    const detail = getModelDetail('claude-sonnet-4')

    expect(detail?.providerNames).toEqual(['Anthropic', 'Amazon Bedrock', 'Google Vertex', 'OpenRouter'])
    expect(detail?.variants.map((variant) => variant.name)).toEqual(['标准版', 'Vertex 长上下文版', 'Bedrock 企业版'])
    expect(detail?.variants[0]?.providers.map((provider) => provider.name)).toEqual(['Anthropic', 'OpenRouter'])
  })

  it('lists a provider-specific deployment as a variant only when model behavior differs', () => {
    const detail = getModelDetail('gpt-4o')

    expect(detail?.providerNames).toEqual(['Azure AI Foundry', 'OpenAI', 'OpenRouter'])
    expect(detail?.variants).toHaveLength(2)
    expect(detail?.variants.find((variant) => variant.id === 'azure-global')?.differences).toContain('Azure 区域合规与企业网络入口')
  })
})
