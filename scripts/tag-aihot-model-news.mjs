import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openSqliteDatabase } from './lib/sqlite.mjs'
import { deterministicTags } from './lib/model-news-tagger.mjs'

const DB_PATH = process.env.MODEL_NEWS_DB ?? join(process.cwd(), '.internal', 'model-news.sqlite')
const VOCAB_PATH = process.env.MODEL_NEWS_VOCAB ?? join(process.cwd(), '.internal', 'model-news-vocabulary.json')
const DETERMINISTIC_ONLY = process.argv.includes('--deterministic-only') || !process.env.MODEL_NEWS_AI_COMMAND
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : Number(process.env.MODEL_NEWS_TAG_LIMIT ?? 200)

const vocabulary = JSON.parse(readFileSync(VOCAB_PATH, 'utf8'))
const db = openSqliteDatabase(DB_PATH)
ensureSchema(db)

const items = db.prepare(`
  SELECT * FROM aihot_items
  WHERE id NOT IN (SELECT item_id FROM item_tag_runs WHERE status IN ('tagged', 'discarded'))
  ORDER BY published_at DESC
  LIMIT ?
`).all(Number.isFinite(LIMIT) && LIMIT > 0 ? LIMIT : 200)

const insertTag = db.prepare(`
  INSERT OR REPLACE INTO item_tags (item_id, tag_type, tag_value, confidence, evidence, tagged_by, tagged_at)
  VALUES (@item_id, @tag_type, @tag_value, @confidence, @evidence, @tagged_by, @tagged_at)
`)
const upsertRun = db.prepare(`
  INSERT INTO item_tag_runs (item_id, status, model, prompt_hash, reason, tagged_at)
  VALUES (@item_id, @status, @model, @prompt_hash, @reason, @tagged_at)
  ON CONFLICT(item_id) DO UPDATE SET
    status = excluded.status,
    model = excluded.model,
    prompt_hash = excluded.prompt_hash,
    reason = excluded.reason,
    tagged_at = excluded.tagged_at
`)

let tagged = 0
let discarded = 0
let failed = 0

for (const item of items) {
  try {
    const taggedAt = new Date().toISOString()
    const deterministic = deterministicTags(item, vocabulary)
    const tags = deterministic

    if (tags.providers.length === 0 && tags.models.length === 0 && !DETERMINISTIC_ONLY) {
      // Placeholder for future AI command integration. Current first pass is deterministic and safe.
      // MODEL_NEWS_AI_COMMAND can be wired later without changing the DB/export contract.
    }

    if (tags.providers.length === 0 && tags.models.length === 0) {
      upsertRun.run({
        item_id: item.id,
        status: 'discarded',
        model: DETERMINISTIC_ONLY ? 'deterministic' : process.env.MODEL_NEWS_AI_COMMAND,
        prompt_hash: promptHash(item, vocabulary),
        reason: 'No provider or model tag matched the current Model Plaza vocabulary',
        tagged_at: taggedAt,
      })
      discarded += 1
      continue
    }

    const tx = db.transaction(() => {
      for (const provider of tags.providers) {
        insertTag.run({ item_id: item.id, tag_type: 'provider', tag_value: provider.value, confidence: provider.confidence, evidence: provider.evidence, tagged_by: 'deterministic', tagged_at: taggedAt })
      }
      for (const model of tags.models) {
        insertTag.run({ item_id: item.id, tag_type: 'model', tag_value: model.value, confidence: model.confidence, evidence: model.evidence, tagged_by: 'deterministic', tagged_at: taggedAt })
      }
      upsertRun.run({
        item_id: item.id,
        status: 'tagged',
        model: 'deterministic',
        prompt_hash: promptHash(item, vocabulary),
        reason: `Matched ${tags.providers.length} provider tags and ${tags.models.length} model tags`,
        tagged_at: taggedAt,
      })
    })
    tx()
    tagged += 1
  } catch (error) {
    failed += 1
    upsertRun.run({ item_id: item.id, status: 'failed', model: 'deterministic', prompt_hash: promptHash(item, vocabulary), reason: error instanceof Error ? error.message : String(error), tagged_at: new Date().toISOString() })
  }
}

console.log(JSON.stringify({ processed: items.length, tagged, discarded, failed, deterministicOnly: DETERMINISTIC_ONLY }))
db.close()

function promptHash(item, vocab) {
  return createHash('sha1').update(JSON.stringify({ id: item.id, title: item.title, vocabGeneratedAt: vocab.generatedAt })).digest('hex').slice(0, 16)
}

function ensureSchema(database) {
  database.exec(`
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
  `)
}
