import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildOpenRouterRawGraphFromFiles } from '../dist/lib/openrouter-raw-graph.js'
import { buildModelNewsVocabulary } from './lib/model-news-vocabulary.mjs'

const targetPath = process.env.MODEL_NEWS_VOCAB ?? join(process.cwd(), '.internal', 'model-news-vocabulary.json')

const graph = buildOpenRouterRawGraphFromFiles({
  modelsPath: join(process.cwd(), 'data', 'openrouter-models.json'),
  endpointsPath: join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemapPath: join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
  pagesPath: join(process.cwd(), 'data', 'openrouter-model-pages.json'),
  modelsDevPath: join(process.cwd(), 'data', 'models-dev-api.json'),
  baseLlmPath: join(process.cwd(), 'data', 'basellm-newapi-models.json'),
})

const vocabulary = buildModelNewsVocabulary(graph)

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(targetPath, `${JSON.stringify(vocabulary, null, 2)}\n`)
console.log(JSON.stringify({ providers: vocabulary.providers.length, models: vocabulary.models.length, targetPath }))
