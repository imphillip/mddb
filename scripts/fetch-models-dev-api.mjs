#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = process.env.MODELS_DEV_URL ?? 'https://models.dev/api.json'
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = process.env.MODELS_DEV_TARGET ?? join(repoRoot, '.internal', 'source-data', 'models-dev-api.raw.json')

const response = await fetch(source, { headers: { Accept: 'application/json', 'User-Agent': 'mddb.dev source fetch' } })
if (!response.ok) throw new Error(`Failed to fetch models.dev metadata: ${response.status} ${response.statusText}`)
const payload = await response.json()
if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('models.dev payload must be a JSON object')

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`models-dev: providers=${Object.keys(payload).length} wrote=${outputPath}`)
