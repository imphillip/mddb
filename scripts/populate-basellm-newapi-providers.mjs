import { loadBaseLlmNewapiSource, populateBaseLlmNewapiProviders } from './lib/populate-basellm-newapi-providers.mjs'

const sourcePath = process.env.BASELLM_NEWAPI_SOURCE
const dataDir = process.env.BASELLM_NEWAPI_DATA_DIR
const source = loadBaseLlmNewapiSource(sourcePath)
const result = populateBaseLlmNewapiProviders({ dataDir, source })
console.log(`basellm-newapi providers: enriched=${result.enriched} created=${result.created} matched=${result.matched} skipped=${result.skipped} freeFiltered=${result.freeFiltered} unpriced=${result.unpriced}`)
