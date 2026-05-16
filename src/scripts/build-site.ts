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
  modelsDevPath: join(process.cwd(), 'data', 'models-dev-api.json'),
  baseLlmPath: join(process.cwd(), 'data', 'basellm-newapi.json'),
})

rmSync(outputDir, { recursive: true, force: true })

writePage('index.html', renderRootRedirect())
writePage('models/index.html', renderOpenRouterRawHome(graph))
writePage('graph/openrouter.json', JSON.stringify(graph, null, 2))

for (const node of graph.nodes) {
  writePage(`models/${node.urlProvider}/${node.urlModelId}/index.html`, renderOpenRouterRawDetail(graph, node))
}

function renderRootRedirect(): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在跳转到模型列表 · mddb.dev</title><meta http-equiv="refresh" content="0;url=/models/"><link rel="canonical" href="/models/"><script>location.replace('/models/')</script></head><body><p>正在跳转到 <a href="/models/">/models/</a>。</p></body></html>`
}

function writePage(path: string, content: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}
