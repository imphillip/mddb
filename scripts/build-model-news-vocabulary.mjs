import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildOpenRouterRawGraphFromFiles } from '../dist/lib/openrouter-raw-graph.js'

const targetPath = process.env.MODEL_NEWS_VOCAB ?? join(process.cwd(), '.internal', 'model-news-vocabulary.json')

const graph = buildOpenRouterRawGraphFromFiles({
  modelsPath: join(process.cwd(), 'data', 'openrouter-models.json'),
  endpointsPath: join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemapPath: join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
  pagesPath: join(process.cwd(), 'data', 'openrouter-model-pages.json'),
  modelsDevPath: join(process.cwd(), 'data', 'models-dev-api.json'),
  baseLlmPath: join(process.cwd(), 'data', 'basellm-newapi-models.json'),
})

const providerById = new Map()
for (const provider of graph.providers) {
  providerById.set(provider.id, {
    id: provider.id,
    name: provider.name,
    aliases: unique([provider.id, provider.name, provider.id.replace(/-/g, ' '), provider.name.replace(/-/g, ' ')]),
  })
}
for (const node of graph.nodes) {
  if (!providerById.has(node.provider)) {
    providerById.set(node.provider, {
      id: node.provider,
      name: node.providerName,
      aliases: unique([node.provider, node.providerName, node.provider.replace(/-/g, ' '), node.providerName.replace(/-/g, ' ')]),
    })
  }
}

const modelByKey = new Map()
for (const node of graph.nodes) {
  if (node.nodeKind !== 'source_model') continue
  const key = `${node.provider}/${node.modelId}`
  modelByKey.set(key, {
    modelId: node.modelId,
    route: `/models/${node.urlProvider}/${node.urlModelId}/`,
    provider: node.provider,
    sourceId: node.sourceId,
    displayName: node.displayName,
    aliases: unique([
      node.modelId,
      node.sourceId,
      node.displayName,
      node.modelIdWithinNamespace,
      node.urlModelId,
      node.derived.canonicalSlug,
    ].filter(Boolean)),
  })
}

const vocabulary = {
  generatedAt: new Date().toISOString(),
  providers: Array.from(providerById.values()).sort((a, b) => a.id.localeCompare(b.id)),
  models: Array.from(modelByKey.values()).sort((a, b) => `${a.provider}/${a.modelId}`.localeCompare(`${b.provider}/${b.modelId}`)),
}

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(targetPath, `${JSON.stringify(vocabulary, null, 2)}\n`)
console.log(JSON.stringify({ providers: vocabulary.providers.length, models: vocabulary.models.length, targetPath }))

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)))
}
