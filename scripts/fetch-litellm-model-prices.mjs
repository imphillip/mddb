#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LITELLM_URL = process.env.LITELLM_MODEL_PRICES_URL ?? 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'
const OUT_DIR = process.env.MDDB_WORKING_DATA_DIR ?? join(process.cwd(), '.internal', 'source-data')
const TARGET = process.env.LITELLM_RAW_TARGET ?? join(OUT_DIR, 'litellm-model-prices.raw.json')
const USER_AGENT = process.env.MDDB_USER_AGENT ?? 'mddb.dev source fetch'

const response = await fetch(LITELLM_URL, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } })
if (!response.ok) {
  const body = await response.text().catch(() => '')
  throw new Error(`LiteLLM fetch failed: ${response.status} ${response.statusText}${body ? `\n${body.slice(0, 500)}` : ''}`)
}
const payload = await response.json()
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('LiteLLM payload must be a JSON object')

const output = {
  source: LITELLM_URL,
  fetchedAt: new Date().toISOString(),
  rawKind: 'litellm-model-prices-and-context-window',
  rowCount: Object.keys(payload).length,
  data: payload,
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(TARGET, JSON.stringify(output, null, 2) + '\n')
console.log(`litellm: rows=${output.rowCount} wrote=${TARGET}`)
