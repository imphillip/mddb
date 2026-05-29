#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { extractVolcengineDocFromHtml, fingerprint } from './lib/incremental-source-fetch.mjs'

const DEFAULT_DOCS = [
  { document_id: 1330310, library_id: 82379, title: '模型列表', target: 'sources/raw/volcengine/1330310.json' },
  { document_id: 1544106, library_id: 82379, title: '模型价格', target: 'sources/raw/volcengine/1544106.json' },
]
const USER_AGENT = process.env.MDDB_USER_AGENT ?? 'mddb.dev source fetch'
const args = parseArgs(process.argv.slice(2))

if (args.help) {
  console.log(`Fetch Volcengine Ark public docs.\n\nOptions:\n  --incremental       Compare fetched doc fingerprints and write only changed docs (default)\n  --force             Write all fetched docs even if unchanged\n  --doc <id>          Fetch only one document id; default fetches model list and price docs\n  --timeout <ms>      Fetch timeout; default 45000`)
  process.exit(0)
}

const selectedDocs = args.doc ? DEFAULT_DOCS.filter((doc) => String(doc.document_id) === String(args.doc)) : DEFAULT_DOCS
if (!selectedDocs.length) throw new Error(`Unknown Volcengine doc id: ${args.doc}`)
const timeoutMs = Number(args.timeout || 45000)
let changed = 0

for (const docSpec of selectedDocs) {
  const url = `https://www.volcengine.com/docs/${docSpec.library_id}/${docSpec.document_id}?lang=zh`
  const target = resolve(docSpec.target)
  const previous = await readJsonIfExists(target)
  const html = await fetchText(url, timeoutMs)
  const next = extractVolcengineDocFromHtml(html, { url, ...docSpec })
  const previousFingerprint = previous?.fingerprint || fingerprint(previous?.md_content || '')
  const nextFingerprint = fingerprint(next.md_content || '')
  const changedDoc = args.force || previousFingerprint !== nextFingerprint || previous?.updated_time !== next.updated_time
  const payload = { ...next, fingerprint: nextFingerprint, fetched_at: new Date().toISOString() }
  if (changedDoc) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`)
    changed += 1
    console.error(`Updated Volcengine doc ${docSpec.document_id}: ${target}`)
  } else {
    console.error(`Unchanged Volcengine doc ${docSpec.document_id}: ${target}`)
  }
}
console.error(`Volcengine fetch complete: ${changed}/${selectedDocs.length} docs changed`)

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT }, signal: controller.signal })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${body.slice(0, 300)}`)
    }
    return response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function parseArgs(argv) {
  const out = { incremental: true }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--force') out.force = true
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[key] = true
      else { out[key] = next; i += 1 }
    }
  }
  return out
}
