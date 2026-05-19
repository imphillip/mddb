import { dirname } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildRegistryGraphFromFiles } from '../dist/lib/registry-graph.js'
import { buildModelNewsVocabulary } from './lib/model-news-vocabulary.mjs'

const targetPath = process.env.MODEL_NEWS_VOCAB ?? `${process.cwd()}/.internal/model-news-vocabulary.json`

const graph = buildRegistryGraphFromFiles()

const vocabulary = buildModelNewsVocabulary(graph)

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(targetPath, `${JSON.stringify(vocabulary, null, 2)}\n`)
console.log(JSON.stringify({ providers: vocabulary.providers.length, models: vocabulary.models.length, targetPath }))
