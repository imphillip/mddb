import { dirname, join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { openSqliteDatabase } from './lib/sqlite.mjs'

const DB_PATH = process.env.MODEL_NEWS_DB ?? join(process.cwd(), '.internal', 'model-news.sqlite')
const VOCAB_PATH = process.env.MODEL_NEWS_VOCAB ?? join(process.cwd(), '.internal', 'model-news-vocabulary.json')
const TARGET_PATH = process.env.MODEL_NEWS_EXPORT ?? join(process.cwd(), 'data', 'model-news-tagged.json')
const SOURCE_URL = process.env.AIHOT_ITEMS_URL ?? 'https://aihot.virxact.com/api/public/items?mode=all&take=100'

const vocabulary = JSON.parse(readFileSync(VOCAB_PATH, 'utf8'))
const modelRouteById = new Map(vocabulary.models.map((model) => [model.modelId, model.route]))
const providerNameById = new Map(vocabulary.providers.map((provider) => [provider.id, provider.name]))
const db = openSqliteDatabase(DB_PATH)

const rows = db.prepare(`
  SELECT i.id, i.title, i.title_en, i.url, i.source, i.published_at, i.summary, i.category,
         group_concat(CASE WHEN t.tag_type = 'provider' THEN t.tag_value END) AS providers,
         group_concat(CASE WHEN t.tag_type = 'model' THEN t.tag_value END) AS models
  FROM aihot_items i
  JOIN item_tag_runs r ON r.item_id = i.id AND r.status = 'tagged'
  LEFT JOIN item_tags t ON t.item_id = i.id
  GROUP BY i.id
  HAVING providers IS NOT NULL OR models IS NOT NULL
  ORDER BY i.published_at DESC
`).all()

const items = rows.map((row) => {
  const providers = splitCsv(row.providers)
  const models = splitCsv(row.models)
  return {
    id: row.id,
    title: row.title,
    title_en: row.title_en,
    url: row.url,
    source: row.source,
    publishedAt: row.published_at,
    summary: row.summary,
    category: row.category,
    tags: {
      providers,
      models,
    },
    tagLabels: {
      providers: providers.map((id) => providerNameById.get(id) ?? id),
      models,
    },
    modelRoutes: Object.fromEntries(models.filter((id) => modelRouteById.has(id)).map((id) => [id, modelRouteById.get(id)])),
  }
})

const exported = {
  generatedAt: new Date().toISOString(),
  source: SOURCE_URL,
  items,
}

mkdirSync(dirname(TARGET_PATH), { recursive: true })
writeFileSync(TARGET_PATH, `${JSON.stringify(exported, null, 2)}\n`)
console.log(JSON.stringify({ items: items.length, targetPath: TARGET_PATH }))
db.close()

function splitCsv(value) {
  if (typeof value !== 'string' || value.length === 0) return []
  return Array.from(new Set(value.split(',').filter(Boolean)))
}
