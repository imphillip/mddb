import { loadModelsDevSource, populateModelsDevProviders } from './lib/populate-models-dev-providers.mjs'

const source = loadModelsDevSource(process.env.MODELS_DEV_SOURCE)
const result = populateModelsDevProviders({ dataDir: process.env.MODELS_DEV_DATA_DIR, source })
console.log(`models-dev providers: enriched=${result.enriched} created=${result.created} skipped=${result.skipped}`)
