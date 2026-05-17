import { join } from 'node:path'
import { openSqliteDatabase } from './lib/sqlite.mjs'

const AIHOT_ITEMS_URL = process.env.AIHOT_ITEMS_URL ?? 'https://aihot.virxact.com/api/public/items?mode=all&take=100'
const AIHOT_USER_AGENT = process.env.AIHOT_USER_AGENT ?? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const DB_PATH = process.env.MODEL_NEWS_DB ?? join(process.cwd(), '.internal', 'model-news.sqlite')

const db = openSqliteDatabase(DB_PATH)
ensureSchema(db)

const payload = await fetchItems(AIHOT_ITEMS_URL)
const fetchedAt = new Date().toISOString()
const items = Array.isArray(payload?.items) ? payload.items : []

const upsert = db.prepare(`
  INSERT INTO aihot_items (id, title, title_en, url, source, published_at, summary, category, fetched_at, raw_json)
  VALUES (@id, @title, @title_en, @url, @source, @published_at, @summary, @category, @fetched_at, @raw_json)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    title_en = excluded.title_en,
    url = excluded.url,
    source = excluded.source,
    published_at = excluded.published_at,
    summary = excluded.summary,
    category = excluded.category,
    fetched_at = excluded.fetched_at,
    raw_json = excluded.raw_json
`)

const tx = db.transaction((rows) => {
  for (const item of rows) {
    if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.url !== 'string' || typeof item.source !== 'string') {
      continue
    }
    upsert.run({
      id: item.id,
      title: item.title,
      title_en: nullableString(item.title_en),
      url: item.url,
      source: item.source,
      published_at: nullableString(item.publishedAt),
      summary: nullableString(item.summary),
      category: nullableString(item.category),
      fetched_at: fetchedAt,
      raw_json: JSON.stringify(item),
    })
  }
})

tx(items)
const total = db.prepare('SELECT count(*) AS count FROM aihot_items').get().count
console.log(JSON.stringify({ fetched: items.length, total, source: AIHOT_ITEMS_URL, dbPath: DB_PATH }))
db.close()

async function fetchItems(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': AIHOT_USER_AGENT,
    },
  })
  if (!response.ok) {
    throw new Error(`AIHOT fetch failed: ${response.status} ${response.statusText} ${await response.text()}`)
  }
  return response.json()
}

function ensureSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS aihot_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_en TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      published_at TEXT,
      summary TEXT,
      category TEXT,
      fetched_at TEXT NOT NULL,
      raw_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES aihot_items(id) ON DELETE CASCADE,
      tag_type TEXT NOT NULL CHECK(tag_type IN ('provider', 'model')),
      tag_value TEXT NOT NULL,
      confidence REAL NOT NULL,
      evidence TEXT NOT NULL,
      tagged_by TEXT NOT NULL,
      tagged_at TEXT NOT NULL,
      PRIMARY KEY (item_id, tag_type, tag_value)
    );

    CREATE TABLE IF NOT EXISTS item_tag_runs (
      item_id TEXT PRIMARY KEY REFERENCES aihot_items(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('tagged', 'discarded', 'failed')),
      model TEXT,
      prompt_hash TEXT,
      reason TEXT,
      tagged_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_aihot_items_published_at ON aihot_items(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_item_tags_value ON item_tags(tag_type, tag_value);
  `)
}

function nullableString(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}
