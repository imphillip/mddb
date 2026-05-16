import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildOpenRouterRawGraphFromFiles } from '../lib/openrouter-raw-graph.js'
import { renderOpenRouterRawDetail, renderOpenRouterRawHome } from '../lib/openrouter-raw-renderer.js'

const outputDir = join(process.cwd(), 'public')
const graph = buildOpenRouterRawGraphFromFiles({
  modelsPath: join(process.cwd(), 'data', 'openrouter-models.json'),
  endpointsPath: join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemapPath: join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
  pagesPath: join(process.cwd(), 'data', 'openrouter-model-pages.json'),
})

rmSync(outputDir, { recursive: true, force: true })

writePage('index.html', renderOpenRouterRawHome(graph))
writePage('models/index.html', renderOpenRouterRawHome(graph))
writePage('graph/openrouter.json', JSON.stringify(graph, null, 2))

for (const node of graph.nodes) {
  writePage(`models/${node.urlProvider}/${node.urlModelId}/index.html`, renderOpenRouterRawDetail(graph, node))
}

function writePage(path: string, content: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}
