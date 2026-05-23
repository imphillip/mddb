import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildDataQualityReport } from '../lib/data-quality.js'
import { buildRegistryGraphFromFiles } from '../lib/registry-graph.js'
import { renderOpenRouterRawDetail, renderOpenRouterRawHome } from '../lib/openrouter-raw-renderer.js'
import { renderUpdateAdminPage } from '../lib/update-admin-renderer.js'

const outputDir = join(process.cwd(), 'public')
const graph = buildRegistryGraphFromFiles()

rmSync(outputDir, { recursive: true, force: true })
copyProviderIcons(join(process.cwd(), 'data', 'provider-icons'), join(outputDir, 'assets', 'provider-icons'))

writePage('index.html', renderOpenRouterRawHome(graph))
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
