import { loadLiteLlmSource, populateLiteLlmModels } from './lib/populate-litellm-models.mjs'

const source = loadLiteLlmSource(process.env.LITELLM_SOURCE)
const result = populateLiteLlmModels({ modelsPath: process.env.LITELLM_MODELS_PATH, source })
console.log(`litellm models: added=${result.added} enriched=${result.enriched} skipped=${result.skipped}`)
