import type { ModelDetail, ModelGallery } from './model-catalog.js'

export type EmptyModelGallery = ModelGallery & {
  details: ModelDetail[]
  source: {
    source: string
  }
}

export function buildEmptyModelGallery(source: EmptyModelGallery['source'] = { source: 'openrouter-pending' }): EmptyModelGallery {
  return {
    brands: [],
    models: [],
    details: [],
    source,
    stats: {
      modelCount: 0,
      brandCount: 0,
      providerCount: 0,
      variantCount: 0,
    },
  }
}
