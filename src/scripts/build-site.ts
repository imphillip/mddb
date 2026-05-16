import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildDataQualityReport } from '../lib/data-quality.js'
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
attachCurrency(graph, join(process.cwd(), 'data', 'exchange-rate-usd-cny.json'))

rmSync(outputDir, { recursive: true, force: true })

writePage('index.html', renderRootRedirect())
writePage('models/index.html', renderOpenRouterRawHome(graph))
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

function renderRootRedirect(): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>正在跳转到模型列表 · mddb.dev</title><meta http-equiv="refresh" content="0;url=/models/"><link rel="canonical" href="/models/"><script>location.replace('/models/')</script></head><body><p>正在跳转到 <a href="/models/">/models/</a>。</p></body></html>`
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
