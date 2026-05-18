#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = 'https://basellm.github.io/llm-metadata/api/newapi/models.json'
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = process.env.BASELLM_NEWAPI_TARGET ?? join(repoRoot, '.internal', 'source-data', 'basellm-newapi.raw.json')

const response = await fetch(source)
if (!response.ok) throw new Error(`Failed to fetch BaseLLM NewAPI metadata: ${response.status} ${response.statusText}`)
const payload = await response.json()
const rows = Array.isArray(payload.data) ? payload.data : []

const snapshot = {
  source,
  fetchedAt: new Date().toISOString(),
  baseRule: '500000 tokens = 1 USD; ratio=1 => $2 / 1M tokens',
  models: rows,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`fetch-basellm-newapi: wrote ${rows.length} rows to ${outputPath}`)
