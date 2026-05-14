import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildModelGalleryWithModelsDevOverlay } from '../lib/model-gallery-overlay.js'
import { renderHomePage, renderModelDetailPage, renderModelsPage } from '../lib/site-renderer.js'

const outputDir = join(process.cwd(), 'public')
const openRouterSourcePath = join(process.cwd(), 'data', 'openrouter-models.json')
const modelsDevSourcePath = join(process.cwd(), 'data', 'models-dev-api.json')
const modelGallery = buildModelGalleryWithModelsDevOverlay(openRouterSourcePath, modelsDevSourcePath)

rmSync(outputDir, { recursive: true, force: true })

function writePage(path: string, html: string): void {
  const fullPath = join(outputDir, path)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, html)
}

writePage('index.html', renderHomePage())
writePage('models/index.html', renderModelsPage(modelGallery))
for (const model of modelGallery.details) {
  writePage(`models/${model.tag}/index.html`, renderModelDetailPage(model.tag, modelGallery.details))
}
