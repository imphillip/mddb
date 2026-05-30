#!/usr/bin/env node
// Stage ① FETCH (Volcengine, headless-browser variant).
//
// The Volcengine Ark docs (模型列表 / 模型价格) are Feishu/Lark client-rendered SPAs: the raw
// HTML is scrambled SSR with no markdown API. The pages DO expose a "复制markdown" (copy as
// markdown) action in a per-document "···" overflow menu, which serializes the rendered tables
// into CLEAN markdown. This script drives a headless browser to trigger that action and saves:
//
//     sources/raw/volcengine/ark-models.md    (doc 1330310 — model specs)
//     sources/raw/volcengine/ark-pricing.md   (doc 1544106 — CNY prices)
//
// Then scripts/parse-volcengine-markdown.mjs turns those into sources/raw/volcengine/volcengine.json
// (structured records the Volcengine adapter consumes). This split is deliberate: the FETCH step
// is environment-specific (needs a browser + sometimes a login) and runs on a Playwright-equipped
// host; the PARSE step is deterministic and runs anywhere.
//
// >>> This is the FRAMEWORK / skeleton. The exact selectors for the "···" menu and the
// >>> "复制markdown" item must be confirmed/debugged against the live page on the Playwright
// >>> host. See docs/volcengine-pricing-fetch.md for the task brief, known DOM hints, and the
// >>> post-fetch refinements to apply. Search this file for "TODO(playwright-host)".
//
// Usage:
//   node scripts/fetch-volcengine-markdown.mjs                 # headless, both docs, then parse
//   node scripts/fetch-volcengine-markdown.mjs --headed        # visible browser (debugging)
//   node scripts/fetch-volcengine-markdown.mjs --doc 1330310   # one doc only
//   node scripts/fetch-volcengine-markdown.mjs --no-parse      # fetch .md only, skip parse step
//   node scripts/fetch-volcengine-markdown.mjs --keep-open     # leave the browser open on failure
//
// Auth: if a doc requires login, set MDDB_VOLC_STORAGE_STATE=<path to a Playwright storageState
// JSON> (export it once from a logged-in session); the script loads it into the browser context.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const OUT_DIR = resolve(ROOT, 'sources/raw/volcengine')

// Each doc: the page to open and the .md file to write. `title` is only for logs.
const DOCS = [
  { document_id: 1330310, library_id: 82379, title: '模型列表', out: join(OUT_DIR, 'ark-models.md') },
  { document_id: 1544106, library_id: 82379, title: '模型价格', out: join(OUT_DIR, 'ark-pricing.md') },
]

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(`Fetch Volcengine Ark docs as markdown via headless browser.

Options:
  --doc <id>        Only fetch this document id (1330310 | 1544106)
  --headed          Run with a visible browser window (debugging)
  --keep-open       On failure, leave the browser open for inspection
  --no-parse        Skip running parse-volcengine-markdown.mjs afterwards
  --timeout <ms>    Per-step timeout; default 60000
  --out-dir <dir>   Override output dir (default sources/raw/volcengine)`)
  process.exit(0)
}

const selected = args.doc ? DOCS.filter((d) => String(d.document_id) === String(args.doc)) : DOCS
if (!selected.length) {
  console.error(`Unknown Volcengine doc id: ${args.doc}. Known: ${DOCS.map((d) => d.document_id).join(', ')}`)
  process.exit(2)
}
const timeoutMs = Number(args.timeout || 60000)
const outDir = args.outDir ? resolve(ROOT, args.outDir) : OUT_DIR

const chromium = await loadChromium()

const browser = await chromium.launch({ headless: !args.headed })
const context = await browser.newContext({
  // Grant clipboard read/write so the "复制markdown" action can be read back via the clipboard.
  permissions: ['clipboard-read', 'clipboard-write'],
  ...(process.env.MDDB_VOLC_STORAGE_STATE ? { storageState: process.env.MDDB_VOLC_STORAGE_STATE } : {}),
})

let ok = 0
let failed = 0
for (const doc of selected) {
  const page = await context.newPage()
  try {
    const md = await fetchDocMarkdown(page, doc)
    if (!md || md.length < 200) throw new Error(`copied markdown looks empty/too short (${md?.length ?? 0} chars)`)
    await mkdir(dirname(doc.out), { recursive: true })
    await writeFile(doc.out, md.endsWith('\n') ? md : `${md}\n`)
    console.error(`✓ ${doc.title} (${doc.document_id}) → ${rel(doc.out)} (${md.length} chars)`)
    ok += 1
    await page.close()
  } catch (error) {
    failed += 1
    console.error(`✗ ${doc.title} (${doc.document_id}): ${error?.message ?? error}`)
    await dumpFailure(page, doc).catch(() => {})
    if (args.keepOpen) {
      console.error('  --keep-open set; leaving browser open. Ctrl-C to exit.')
      await new Promise(() => {})
    }
    await page.close().catch(() => {})
  }
}

await context.close()
await browser.close()

console.error(`Volcengine markdown fetch: ${ok} ok, ${failed} failed`)
if (failed) process.exit(1)

if (!args.noParse) {
  const parser = resolve(ROOT, 'scripts/parse-volcengine-markdown.mjs')
  console.error(`→ parsing: node ${rel(parser)}`)
  const r = spawnSync(process.execPath, [parser, `--dir=${rel(outDir)}`], { stdio: 'inherit' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

// --------------------------------------------------------------------------------------------
// Per-document flow: open the page, trigger "复制markdown", read the clipboard.
// --------------------------------------------------------------------------------------------
async function fetchDocMarkdown(page, doc) {
  const url = `https://www.volcengine.com/docs/${doc.library_id}/${doc.document_id}?lang=zh`
  await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs })

  // The doc body is rendered into a Lark/Feishu editor container. Wait for real content
  // (a rendered table) before trying the menu, so "复制markdown" copies a full document.
  // TODO(playwright-host): confirm this wait targets the rendered doc, not a skeleton loader.
  await page
    .waitForSelector('table, [class*="table"], [class*="docx"], [class*="render"]', { timeout: timeoutMs })
    .catch(() => {})
  await settle(page)

  // Live Volcengine docs currently expose a top-of-document "复制全文" control that writes the
  // same rendered markdown/plaintext serialization we need. Older Lark-style pages used a
  // "···" overflow menu with "复制 markdown", so keep that path as fallback.
  const copied = await clickDirectCopyControl(page)
  if (!copied) {
    await openOverflowMenu(page)
    await clickCopyMarkdown(page)
  }

  // The action writes markdown to the clipboard; read it back.
  await settle(page, 500)
  const md = await page.evaluate(async () => {
    try {
      return await navigator.clipboard.readText()
    } catch {
      return ''
    }
  })
  return md
}

async function clickDirectCopyControl(page) {
  const candidates = [
    page.getByText(/^复制全文$/u).first(),
    page.getByText(/^复制全篇$/u).first(),
    page.getByText(/^Copy full text$/iu).first(),
  ]
  for (const item of candidates) {
    if (await item.isVisible().catch(() => false)) {
      await item.click({ timeout: 5000 })
      return true
    }
  }
  return false
}

async function openOverflowMenu(page) {
  // Try a sequence of likely triggers; the first that exists and is clickable wins.
  const candidates = [
    'button[aria-label*="更多"]',
    'button[aria-label*="More"]',
    '[class*="more"] button',
    '[class*="overflow"] button',
    'button:has([class*="more"])',
    // Lark doc header action menu icon (three dots)
    '[class*="header"] [class*="icon"]:near(:text("分享"))',
  ]
  for (const sel of candidates) {
    const el = page.locator(sel).first()
    if (await el.count().then((n) => n > 0).catch(() => false)) {
      await el.click({ timeout: 5000 }).catch(() => {})
      if (await menuVisible(page)) return
    }
  }
  // Fallback: keyboard-free hover of the title bar to reveal hover-only actions.
  // TODO(playwright-host): replace with the confirmed trigger.
  throw new Error('could not open the "···" overflow menu (selectors need confirmation)')
}

async function clickCopyMarkdown(page) {
  const item = page
    .getByText(/复制\s*markdown|copy\s*as\s*markdown/iu)
    .first()
  await item.waitFor({ state: 'visible', timeout: 8000 })
  await item.click({ timeout: 5000 })
}

async function menuVisible(page) {
  return page
    .getByText(/复制\s*markdown|copy\s*as\s*markdown/iu)
    .first()
    .isVisible()
    .catch(() => false)
}

// --------------------------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------------------------
async function settle(page, ms = 1200) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

async function dumpFailure(page, doc) {
  const png = join(outDir, `fetch-fail-${doc.document_id}.png`)
  await page.screenshot({ path: png, fullPage: true }).catch(() => {})
  console.error(`  saved screenshot → ${rel(png)} (inspect to fix selectors)`)
}

async function loadChromium() {
  try {
    const pw = await import('playwright')
    return pw.chromium
  } catch {
    console.error('playwright is not installed. On the fetch host run:')
    console.error('  npm i -D playwright && npx playwright install chromium')
    process.exit(127)
  }
}

function rel(p) {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') out.help = true
    else if (a === '--headed') out.headed = true
    else if (a === '--keep-open') out.keepOpen = true
    else if (a === '--no-parse') out.noParse = true
    else if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-([a-z])/gu, (_, c) => c.toUpperCase())
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[key] = true
      else {
        out[key] = next
        i += 1
      }
    }
  }
  return out
}
