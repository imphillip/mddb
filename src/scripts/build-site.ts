import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildBaseLlmEnrichmentFromFile } from '../lib/basellm-gallery.js'
import { overlayBaseLlmEnrichment } from '../lib/basellm-overlay.js'
import { buildModelGalleryWithModelsDevEnrichment, buildModelsDevEnrichment } from '../lib/model-gallery-enrichment.js'
import { buildModelGalleryFromModelsDevFile } from '../lib/models-dev-gallery.js'
import { renderHomePage, renderModelDetailPage, renderModelsPage } from '../lib/site-renderer.js'
import { renderWaitingListPage } from '../lib/waiting-list.js'

const outputDir = join(process.cwd(), 'public')
const openRouterSourcePath = join(process.cwd(), 'data', 'openrouter-models.json')
const modelsDevSourcePath = join(process.cwd(), 'data', 'models-dev-api.json')
const baseLlmSourcePath = join(process.cwd(), 'data', 'basellm-newapi.json')
const modelsDevGallery = buildModelGalleryFromModelsDevFile(modelsDevSourcePath)
const baseModelGallery = buildModelGalleryWithModelsDevEnrichment(openRouterSourcePath, modelsDevSourcePath)
const baseLlmEnrichment = buildBaseLlmEnrichmentFromFile(baseLlmSourcePath)
const modelGallery = overlayBaseLlmEnrichment(baseModelGallery, baseLlmEnrichment)
const modelsDevEnrichment = buildModelsDevEnrichment(modelGallery, modelsDevGallery)

rmSync(outputDir, { recursive: true, force: true })

function writePage(path: string, html: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, html)
}

writePage('index.html', renderHomePage())
writePage('models/index.html', renderModelsPage(modelGallery))
writePage('waitinglist/index.html', renderWaitingListPage(modelsDevEnrichment.independentCandidates, { username: 'admin', password: 'mddb-admin-2026' }))
writePage('waitinglist/candidates.json', JSON.stringify(modelsDevEnrichment.independentCandidates, null, 2))
for (const model of modelGallery.details) {
  writePage(`models/${model.tag}/index.html`, renderModelDetailPage(model.tag, modelGallery.details))
}
