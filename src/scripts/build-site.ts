import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildBaseLlmEnrichmentFromFile } from '../lib/basellm-gallery.js'
import type { RawWaitingListCandidate } from '../lib/waiting-list-preprocessor.js'
import { preprocessWaitingListCandidates } from '../lib/waiting-list-preprocessor.js'
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
const openRouterTags = new Set(modelGallery.details.map((detail) => detail.tag))
const baseLlmOnlyCandidates: RawWaitingListCandidate[] = Array.from(baseLlmEnrichment.models.values())
  .filter((model) => !openRouterTags.has(model.tag))
  .map((model) => ({
    source: 'basellm',
    tag: model.tag,
    name: model.sourceModelId,
    brand: 'BaseLLM / NewAPI',
    providers: Array.from(new Set(model.variants.map((variant) => variant.providerName))).sort((a, b) => a.localeCompare(b)),
    sourceIds: Array.from(new Set(model.variants.map((variant) => variant.sourceModelId))).sort((a, b) => a.localeCompare(b)),
    reason: `BaseLLM/NewAPI-only candidate with ${model.variants.length} pricing/provider variants`,
  }))
const waitingListPreprocess = preprocessWaitingListCandidates([
  ...modelsDevEnrichment.independentCandidates.map((candidate) => ({ ...candidate, source: 'models.dev' as const })),
  ...baseLlmOnlyCandidates,
], openRouterTags)
const waitingListCandidates = waitingListPreprocess.reviewReady

rmSync(outputDir, { recursive: true, force: true })

function writePage(path: string, html: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, html)
}

writePage('index.html', renderHomePage())
writePage('models/index.html', renderModelsPage(modelGallery))
writePage('waitinglist/index.html', renderWaitingListPage(waitingListCandidates, { username: 'admin', password: 'mddb-admin-2026' }))
writePage('waitinglist/candidates.json', JSON.stringify(waitingListCandidates, null, 2))
writePage('waitinglist/preprocessed.json', JSON.stringify(waitingListPreprocess, null, 2))
for (const model of modelGallery.details) {
  writePage(`models/${model.tag}/index.html`, renderModelDetailPage(model.tag, modelGallery.details))
}
