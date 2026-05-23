import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildDataQualityReport } from '../lib/data-quality.js'
import { buildRegistryGraphFromFiles } from '../lib/registry-graph.js'
import { renderOpenRouterProviderDetail, renderOpenRouterProviderIndex, renderOpenRouterRawDetail, renderOpenRouterRawHome } from '../lib/openrouter-raw-renderer.js'
import { renderUpdateAdminPage } from '../lib/update-admin-renderer.js'

const outputDir = join(process.cwd(), 'public')
const graph = buildRegistryGraphFromFiles()
attachCurrency(graph, join(process.cwd(), '.internal', 'source-data', 'exchange-rate-usd-cny.raw.json'))

rmSync(outputDir, { recursive: true, force: true })
copyProviderIcons(join(process.cwd(), 'data', 'provider-icons'), join(outputDir, 'assets', 'provider-icons'))

writePage('index.html', renderOpenRouterRawHome(graph))
writePage('providers/index.html', renderOpenRouterProviderIndex(graph))
writePage('update/index.html', renderUpdateAdminPage())
writePage('graph/openrouter.json', JSON.stringify(graph, null, 2))
const dataQuality = buildDataQualityReport(graph)
writePage('graph/data-quality.json', JSON.stringify(dataQuality, null, 2))
writePage('graph/missing-pricing.json', JSON.stringify(dataQuality.missing.pricing, null, 2))
writePage('graph/missing-release-date.json', JSON.stringify(dataQuality.missing.releaseDate, null, 2))
writePage('graph/missing-context-window.json', JSON.stringify(dataQuality.missing.contextWindow, null, 2))
writePage('graph/missing-provider-observation.json', JSON.stringify(dataQuality.missing.providerObservation, null, 2))
writePage('graph/page-only-candidates.json', JSON.stringify(dataQuality.pageOnly.candidates, null, 2))

for (const node of graph.nodes) {
  const routePath = node.route.replace(/^\//u, '')
  writePage(`${routePath}/index.html`, renderOpenRouterRawDetail(graph, node))
}

for (const providerId of Array.from(new Set(graph.nodes.map((node) => node.provider)))) {
  writePage(`${providerId}/index.html`, renderOpenRouterProviderDetail(graph, providerId))
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

function copyProviderIcons(sourceDir: string, targetDir: string): void {
  if (!existsSync(sourceDir)) return
  mkdirSync(targetDir, { recursive: true })
  for (const name of readdirSync(sourceDir)) {
    if (!name.endsWith('.svg')) continue
    writeFileSync(join(targetDir, name), readFileSync(join(sourceDir, name)))
  }
}

function writePage(path: string, content: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
}
