import { describe, expect, it } from 'vitest'
import { buildEmptyModelGallery } from './empty-model-gallery.js'
import { renderModelsPage } from './site-renderer.js'

describe('buildEmptyModelGallery', () => {
  it('clears generated models.dev model rows while OpenRouter import is being built', () => {
    const gallery = buildEmptyModelGallery({ source: 'openrouter-pending' })

    expect(gallery.models).toEqual([])
    expect(gallery.brands).toEqual([])
    expect(gallery.details).toEqual([])
    expect(gallery.stats).toEqual({
      modelCount: 0,
      brandCount: 0,
      providerCount: 0,
      variantCount: 0,
    })
    expect(gallery.source).toEqual({ source: 'openrouter-pending' })
  })

  it('renders an empty model plaza without leaking old models.dev rows', () => {
    const html = renderModelsPage(buildEmptyModelGallery({ source: 'openrouter-pending' }))

    expect(html).toContain('模型广场')
    expect(html).not.toContain('<tr data-model-row')
    expect(html).not.toContain('models.dev 本地索引')
  })
})
