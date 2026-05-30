#!/usr/bin/env node
// Parse the Volcengine Ark "复制markdown" exports into one structured source file.
//   sources/raw/volcengine/ark-models.md   -> model specs (id, capabilities, limits, RPM/TPM)
//   sources/raw/volcengine/ark-pricing.md   -> CNY tiered/flat prices (per 1M tokens / image / call)
// Output: sources/raw/volcengine/volcengine.json  { source, models[] }
//
// These markdown files are clean tables (unlike the SSR-scraped docs), so parsing is
// deterministic. A headless-browser fetch produces the .md (see docs/volcengine-pricing-fetch.md);
// this script is the source-agnostic parser that the Volcengine adapter consumes.
//
// Usage: node scripts/parse-volcengine-markdown.mjs [--dir=sources/raw/volcengine]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const KB = 1024

// Build the structured model records from the two markdown documents. Pure: no I/O. Exported for
// unit tests (parse-volcengine-markdown.test.mjs).
export function buildModels(modelsMd, pricingMd) {
  const specs = modelsMd ? parseSpecs(modelsMd) : new Map()
  const prices = pricingMd ? parsePrices(pricingMd) : new Map()

  // Join specs + prices by matchKey (separator/case-insensitive). The spec id (dash convention)
  // wins as the canonical id; price tiers/kind come from the pricing doc.
  const byKey = new Map()
  for (const [k, s] of specs) byKey.set(k, { ...s })
  for (const [k, p] of prices) {
    const cur = byKey.get(k) ?? { id: p.id, name: p.name }
    byKey.set(k, { ...cur, ...p, ...(cur.id ? { id: cur.id } : {}), prices: p.prices, kind: p.kind ?? cur.kind })
  }

  return [...byKey.values()]
    .filter((m) => m.id)
    .map(({ kind, ...m }) => ({ source_kind: kind ?? 'text', currency: 'CNY', ...m }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function main() {
  const root = process.cwd()
  const dir = arg('dir') ?? join(root, 'sources', 'raw', 'volcengine')
  const modelsMd = readMaybe(join(dir, 'ark-models.md'))
  const pricingMd = readMaybe(join(dir, 'ark-pricing.md'))
  const outPath = join(dir, 'volcengine.json')

  const models = buildModels(modelsMd, pricingMd)
  writeFileSync(outPath, `${JSON.stringify({ source: 'volcengine', count: models.length, models }, null, 2)}\n`)
  const priced = models.filter((m) => (m.prices ?? []).length > 0).length
  console.log(`parse-volcengine-markdown: ${models.length} models (${priced} priced) -> ${rel(outPath, root)}`)
}

// ---------------- spec parsing (ark-models.md) ----------------
// ark-models.md groups rows under capability headings (深度思考能力 / 文本生成能力 / … /
// 视频生成能力 / 图片生成能力 / 3D生成能力 / 向量化能力). A model recurs across the text-capability
// sections (deduped by matchKey); the media sections contain only media models, so the current
// heading tells us the output kind. Rows carry the clean base id in the URL's Id=<base> param and
// the dated snapshot as the link text; column count varies by family (LLM rows have caps|limits|
// rate, media rows are shorter), so we split on '|' and scan the cells generically.
function parseSpecs(md) {
  const out = new Map()
  let kind = 'text'
  for (const line of md.split('\n')) {
    if (line.startsWith('#')) {
      kind = headingKind(line) ?? kind
      continue
    }
    if (!line.startsWith('|')) continue
    const link = line.match(/\[([a-z0-9.\-]+)\]\(([^)]*\bId=([a-z0-9.\-]+)[^)]*)\)/u)
    if (!link) continue
    const snapshot = link[1]
    const id = canonId(link[3])
    const cells = line.split('|').slice(1, -1) // [nameCell, capsCell?, limitsCell?, rateCell?, …]
    const capsCell = cells[1] ?? ''
    const rest = cells.slice(1).join(' \n ') // scan every non-name cell for limits / rate limits
    const rec = out.get(matchKey(id)) ?? { id, name: id, kind, capabilities: [], snapshots: [] }
    if (kind !== 'text') rec.kind = kind
    if (snapshot && canonId(snapshot) !== id && !rec.snapshots.includes(snapshot)) rec.snapshots.push(snapshot)
    rec.capabilities = uniq([...rec.capabilities, ...splitbr(capsCell).filter((c) => /[一-鿿]/u.test(c) && c.length <= 8)])
    Object.assign(rec, limits(rest), rateLimits(rest))
    out.set(matchKey(id), rec)
  }
  return out
}

function headingKind(line) {
  if (/视频生成/u.test(line)) return 'video'
  if (/图片生成/u.test(line)) return 'image'
  if (/3D\s*生成/u.test(line)) return '3d'
  if (/向量化/u.test(line)) return 'embedding'
  // Any other capability heading (深度思考 / 文本生成 / 视觉理解 / 工具调用 / …) is a text/chat model.
  if (/能力/u.test(line)) return 'text'
  return null
}

function limits(cell) {
  const o = {}
  const k = (re, key) => {
    const m = cell.match(re)
    if (m) o[key] = Number(m[1]) * KB
  }
  k(/上下文窗口:\s*(\d+)k/u, 'context_window')
  k(/最大输入:\s*(\d+)k/u, 'max_input_tokens')
  k(/最大思维链:\s*(\d+)k/u, 'max_reasoning_tokens')
  // 最大回答 renders as a markdown link whose LABEL carries a "(默认 Nk)" default hint, with the REAL
  // cap following the link, e.g. "[最大回答(默认 4k):](url)128k". Take the value after the label
  // (dropping the "(默认 …)" parenthetical) so we don't capture the 4k default instead of 128k.
  const ans = cell.match(/最大回答([\s\S]*?)(?:最大思维链|$)/u)
  if (ans) {
    const v = ans[1].replace(/[(（]默认[^)）]*[)）]/gu, '').match(/(\d+)k/u)
    if (v) o.max_output_tokens = Number(v[1]) * KB
  }
  return o
}
function rateLimits(cell) {
  const o = {}
  const rpm = cell.match(/最大 RPM:\s*(\d+)/u)
  const tpm = cell.match(/最大 TPM:\s*(\d+)/u)
  if (rpm) o.rpm = Number(rpm[1])
  if (tpm) o.tpm = Number(tpm[1])
  return o
}

// ---------------- price parsing (ark-pricing.md) ----------------
function parsePrices(md) {
  const out = new Map()
  parseTextTable(md, out) // 大语言模型 在线推理（常规）: tiered input/output/cache
  parseFlatImage(md, out) // 图片生成: 元/张
  parse3d(md, out) //        3D生成: 元/次
  parseEmbedding(md, out) // 向量: 元/百万 token text/image
  parseVideo(md, out) //     视频生成 (seedance): best-effort
  return out
}

// 大语言模型 / 在线推理（常规） — the main tiered token table.
function parseTextTable(md, out) {
  const lines = md.split('\n')
  const hi = lines.findIndex((l) => l.includes('输入(非音频)') && l.includes('缓存命中(非音频)'))
  if (hi < 0) return
  let model = null
  for (let i = hi + 2; i < lines.length; i += 1) {
    const l = lines[i]
    if (!l.startsWith('|')) break
    const c = cells(l)
    if (c.length < 8) continue
    const [name, cond, inp, , , cacheHit, , outp] = c
    if (name) model = name
    if (!model) continue
    const id = canonId(model)
    const rec = out.get(matchKey(id)) ?? { id, name: model, kind: 'text', prices: [] }
    const price = { conditions: tierCondition(cond), input: comp(inp), output: comp(outp), cache_read: comp(cacheHit) }
    if (price.input || price.output) rec.prices.push(clean(price))
    out.set(matchKey(id), rec)
  }
}

function parseFlatImage(md, out) {
  forEachTableUnder(md, '# 图片生成模型', (c) => {
    const [name, price] = c
    if (!name) return
    addFlat(out, name, 'image', { image_output: comp(price, 'per_image') })
  })
}
function parse3d(md, out) {
  forEachTableUnder(md, '# 3D生成模型', (c) => {
    // columns: 模型 | 产物 | 输出单价 元/次  (Hitem3d spans multiple product rows)
    const name = c[0]
    const price = c[c.length - 1]
    if (!name) return
    addFlat(out, name, '3d', { request: comp(price, 'per_request') })
  })
}
function parseEmbedding(md, out) {
  forEachTableUnder(md, '# 向量模型', (c) => {
    const [name, textIn, imgIn] = c
    if (!name) return
    addFlat(out, name, 'embedding', { input: comp(textIn), image_input: comp(imgIn) })
  })
}
// Seedance video pricing (元/百万token). Simple rows (1.0-pro, 1.0-pro-fast) are a single bare price.
// The rest tier by output resolution / audio / whether input contains video — axes the token-based
// PriceCondition can't express, so each tier becomes a `video` price with a {type:'variant', label}
// condition (the label carries the human-readable axis). The old code wrongly read "480" (a 480p
// resolution) as a price; we never do that. The 离线推理 (batch) column is secondary — kept as a note.
// Read RAW cells here (keeping <br>) so multi-bullet tiers survive the <br>-stripping cells() helper.
function parseVideo(md, out) {
  const start = md.indexOf('# 视频生成模型')
  if (start < 0) return
  const lines = md.slice(start, nextHeadingIdx(md, start)).split('\n')
  const hi = lines.findIndex((l) => l.startsWith('|') && l.includes('在线推理'))
  if (hi < 0) return
  for (let i = hi + 2; i < lines.length; i += 1) {
    const l = lines[i]
    if (!l.startsWith('|')) break
    const raw = l.split('|').slice(1, -1).map((c) => c.replace(/\\/gu, '').trim())
    const name = (raw[0] ?? '').replace(/<br>[\s\S]*/u, '').trim()
    if (!name || !/seedance/iu.test(name)) continue
    const id = canonId(name)
    const rec = out.get(matchKey(id)) ?? { id, name, kind: 'video', prices: [] }
    rec.kind = 'video'
    const online = raw[1] ?? ''
    const simple = simpleVideoPrice(online)
    if (simple != null) {
      rec.prices.push({ video: { amount: simple, unit: 'per_1m_tokens' } })
    } else {
      const tiers = parseVideoTiers(online)
      for (const t of tiers) {
        rec.prices.push({ conditions: [{ type: 'variant', label: t.label }], video: { amount: t.amount, unit: 'per_1m_tokens' } })
      }
      if (!tiers.length) {
        rec.pricing_status = 'needs_review'
        const note = videoNote(online)
        if (note) rec.pricing_note = note
      }
    }
    const offline = videoNote(raw[2] ?? '')
    if (offline && !/暂不支持/u.test(offline)) rec.pricing_note_offline = offline
    out.set(matchKey(rec.id), rec)
  }
}
// A "simple" online-inference cell is a single bare 元/百万token price (no tier bullets/qualifiers).
function simpleVideoPrice(cell) {
  const s = String(cell).replace(/<br>[\s\S]*/u, '').trim()
  if (!s || /[*：:~～]|输入|输出|有声|无声|不含|包含|分辨率/u.test(s)) return null
  const m = s.match(/^\D*(\d+(?:\.\d+)?)/u)
  return m ? Number(m[1]) : null
}
// Parse a bulleted online-price cell into { label, amount } tiers. A bullet "<axis>：<price>" is a
// priced tier; a bullet that is a resolution group header ("输出视频分辨率为 480p，720p") sets the
// group prefix carried onto the sub-tiers under it.
function parseVideoTiers(cell) {
  const bullets = String(cell)
    .split(/<br>+/u)
    .map((s) => s.replace(/^[\s>*]+/u, '').trim())
    .filter(Boolean)
  const tiers = []
  let group = ''
  for (const b of bullets) {
    const priced = b.match(/^(.+?)[：:]\s*([\d.]+)/u)
    if (priced && Number.isFinite(Number(priced[2]))) {
      const label = [group, priced[1].trim()].filter(Boolean).join(' · ')
      tiers.push({ label, amount: Number(priced[2]) })
    } else {
      group = b.replace(/输出视频分辨率为\s*/u, '输出').replace(/\s+/gu, '')
    }
  }
  return tiers
}
function videoNote(cell) {
  return String(cell)
    .replace(/<br>+/gu, '; ')
    .replace(/\s+/gu, ' ')
    .replace(/(?:;\s*)+/gu, '; ')
    .replace(/^[;\s]+|[;\s]+$/gu, '')
    .trim()
}

// ---------------- table helpers ----------------
function forEachTableUnder(md, heading, fn) {
  const start = md.indexOf(heading)
  if (start < 0) return
  const seg = md.slice(start, nextHeadingIdx(md, start))
  const lines = seg.split('\n')
  const hi = lines.findIndex((l) => l.startsWith('|') && (l.includes('单价') || l.includes('元/') || l.includes('输入')))
  if (hi < 0) return
  let model = null
  for (let i = hi + 2; i < lines.length; i += 1) {
    const l = lines[i]
    if (!l.startsWith('|')) break
    const c = cells(l)
    if (c[0]) model = c[0]
    fn(c[0] ? c : [model, ...c.slice(1)])
  }
}
function nextHeadingIdx(md, from) {
  const m = md.slice(from + 1).search(/\n#\s/u)
  return m < 0 ? md.length : from + 1 + m
}
function addFlat(out, name, kind, components) {
  const id = canonId(name)
  const rec = out.get(matchKey(id)) ?? { id, name, kind, prices: [] }
  const price = clean(components)
  if (Object.keys(price).length) rec.prices.push(price)
  rec.kind = kind
  out.set(matchKey(id), rec)
}

function tierCondition(t) {
  const m = String(t).match(/输入长度\s*([[(])\s*(\d+)\s*,\s*(\d+)\s*([\])])/u)
  if (!m) return undefined
  const lo = Number(m[2]) * KB
  const hi = Number(m[3]) * KB
  const c = { type: 'input_token', label: String(t).replace(/<br>[\s\S]*/u, '').trim() }
  if (lo > 0) c.gt = lo
  c.lte = hi
  return [c]
}
function comp(raw, unit = 'per_1m_tokens') {
  const s = String(raw ?? '').replace(/\\/gu, '').trim()
  if (!s || s === '-' || !/\d/.test(s)) return undefined
  const n = Number(s.match(/-?\d+(?:\.\d+)?/u)?.[0])
  return Number.isFinite(n) ? { amount: n, unit } : undefined
}
function clean(price) {
  const out = {}
  for (const [k, v] of Object.entries(price)) if (v !== undefined) out[k] = v
  return out
}
function cells(line) {
  return line.split('|').slice(1, -1).map((c) => c.replace(/\\/gu, '').replace(/<br>[\s\S]*/u, '').trim())
}
function splitbr(cell) {
  return String(cell).replace(/\\/gu, '').split(/<br>|<br\/>|\n/u).map((s) => s.replace(/^>\s*/u, '').trim()).filter(Boolean)
}

// ---------------- generic ----------------
// Volcengine's canonical id convention is dashes for version numbers (the spec Id= params and all
// LLM ids use them, e.g. doubao-seed-2-0). Only the media PRICING table writes dotted versions
// (doubao-seedream-4.0, 5.0-lite); normalize <digit>.<digit> -> <digit>-<digit> so price-only
// media ids match the dash convention (matching already works via matchKey; this fixes display).
function canonId(raw) {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/(\d)\.(\d)/gu, '$1-$2')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '')
}
function matchKey(id) {
  return canonId(id).replace(/[._-]+/gu, '')
}
function uniq(a) {
  return [...new Set(a)]
}
function readMaybe(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}
function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}
function rel(p, root) {
  return p.startsWith(root) ? p.slice(root.length + 1) : p
}

// Run as a CLI only when invoked directly (not when imported by a test).
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
}
