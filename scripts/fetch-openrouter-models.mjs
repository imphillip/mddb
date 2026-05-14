#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const targetPath = process.argv[2] ?? join(process.cwd(), 'data', 'openrouter-models.json')
const endpoint = process.env.OPENROUTER_MODELS_URL ?? 'https://openrouter.ai/api/v1/models'
const headers = { Accept: 'application/json' }
if (process.env.OPENROUTER_API_KEY) headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`

const response = await fetch(endpoint, { headers })
if (!response.ok) {
  throw new Error(`OpenRouter model fetch failed: ${response.status} ${response.statusText}`)
}

const payload = await response.json()
if (!payload || !Array.isArray(payload.data)) {
  throw new Error('OpenRouter model fetch returned an unsupported payload shape')
}

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Wrote ${payload.data.length} OpenRouter model rows to ${targetPath}`)
