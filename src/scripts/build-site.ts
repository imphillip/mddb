import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildDataQualityReport } from '../lib/data-quality.js'
import { readNewRegistry, renderNewModelDetail, renderNewModelsHome } from '../lib/new-registry-renderer.js'
import { buildOpenRouterRawGraphFromFiles } from '../lib/openrouter-raw-graph.js'
import { readModelNews, renderModelNewsHome } from '../lib/model-news-renderer.js'
import { renderOpenRouterProviderDetail, renderOpenRouterRawDetail, renderOpenRouterRawHome } from '../lib/openrouter-raw-renderer.js'

const outputDir = join(process.cwd(), 'public')
const graph = buildOpenRouterRawGraphFromFiles({
  modelsPath: join(process.cwd(), 'data', 'openrouter-models.json'),
  endpointsPath: join(process.cwd(), 'data', 'openrouter-endpoints.json'),
  sitemapPath: join(process.cwd(), 'data', 'openrouter-sitemap-models.json'),
  pagesPath: join(process.cwd(), 'data', 'openrouter-model-pages.json'),
  modelsDevPath: join(process.cwd(), 'data', 'models-dev-api.json'),
  baseLlmPath: join(process.cwd(), 'data', 'basellm-newapi.json'),
})
attachCurrency(graph, join(process.cwd(), 'data', 'exchange-rate-usd-cny.json'))

rmSync(outputDir, { recursive: true, force: true })

const feed = readModelNews(join(process.cwd(), 'data', 'model-news-tagged.json'))
writePage('index.html', renderModelNewsHome(graph, feed))
writePage('models/index.html', renderOpenRouterRawHome(graph))
const newRegistry = readNewRegistry()
if (newRegistry) {
  writePage('assets/new-models.css', readFileSync(join(process.cwd(), 'src', 'lib', 'new-models.css'), 'utf8'))
  writePage('new-models/index.html', renderNewModelsHome(newRegistry))
  for (const offer of newRegistry.offers) {
    const route = offer.route.replace(/^\//u, '').replace(/\/$/u, '')
    writePage(`${route}/index.html`, renderNewModelDetail(newRegistry, offer))
  }
}
writePage('graph/openrouter.json', JSON.stringify(graph, null, 2))
const dataQuality = buildDataQualityReport(graph)
writePage('graph/data-quality.json', JSON.stringify(dataQuality, null, 2))
writePage('graph/missing-pricing.json', JSON.stringify(dataQuality.missing.pricing, null, 2))
writePage('graph/missing-release-date.json', JSON.stringify(dataQuality.missing.releaseDate, null, 2))
writePage('graph/missing-context-window.json', JSON.stringify(dataQuality.missing.contextWindow, null, 2))
writePage('graph/missing-provider-observation.json', JSON.stringify(dataQuality.missing.providerObservation, null, 2))
writePage('graph/page-only-candidates.json', JSON.stringify(dataQuality.pageOnly.candidates, null, 2))

for (const node of graph.nodes) {
  writePage(`models/${node.urlProvider}/${node.urlModelId}/index.html`, renderOpenRouterRawDetail(graph, node))
}

for (const providerId of Array.from(new Set(graph.nodes.map((node) => node.provider)))) {
  if (graph.nodes.some((node) => node.provider === providerId && node.nodeKind === 'source_model')) {
    writePage(`models/${providerId}/index.html`, renderOpenRouterProviderDetail(graph, providerId, feed))
  }
}

function attachCurrency(graph: { currency?: unknown }, path: string): void {
  if (!existsSync(path)) return
  const record = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  const rawRate = Number(record.rawRate ?? record.rate)
  const rate = Number(record.rate)
  if (record.base !== 'USD' || record.quote !== 'CNY' || !Number.isFinite(rate) || !Number.isFinite(rawRate)) return
  graph.currency = {
    base: 'USD',
    quote: 'CNY',
    rate: Math.round(rate * 10) / 10,
    rawRate,
    source: String(record.source ?? 'https://open.er-api.com/v6/latest/USD'),
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
  }
}

function writePage(path: string, content: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}
