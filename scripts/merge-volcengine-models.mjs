#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const now = new Date().toISOString()
const sourceName = 'volcengine_ark'
const providerId = 'volcengine-ark-cn'
const providerName = 'Volcengine Ark (China)'
const apiBaseUrl = 'https://ark.cn-beijing.volces.com/api/v3'
const listPath = path.join(root, '.internal/sources/volcengine/1330310.json')
const pricePath = path.join(root, '.internal/sources/volcengine/1544106.json')
const modelsPath = path.join(root, 'data/models.json')

const listDoc = JSON.parse(fs.readFileSync(listPath, 'utf8'))
const priceDoc = JSON.parse(fs.readFileSync(pricePath, 'utf8'))
const modelsPayload = JSON.parse(fs.readFileSync(modelsPath, 'utf8'))
const models = Array.isArray(modelsPayload.models) ? modelsPayload.models : []

function clean(value) {
  return String(value || '')
    .replace(/\\-/gu, '-')
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/`/gu, '')
    .replace(/\*\*/gu, '')
    .replace(/&nbsp;/gu, ' ')
    .replace(/\\/gu, '')
    .trim()
}
function slug(value) {
  return clean(value).toLowerCase().replace(/^[-_a-z0-9]+\//u, '').replace(/[:@].*$/u, '').replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '')
}
function norm(value) { return slug(value).replace(/[._-]+/gu, '-') }
function unique(values) { return Array.from(new Set(values.filter((v) => v !== undefined && v !== null && v !== ''))) }
function array(value) { return Array.isArray(value) ? value.filter((v) => v !== undefined && v !== null) : [] }
function titleFromId(id) {
  return String(id).split(/[-_]/u).filter(Boolean).map((part) => /^\d+(\.\d+)?$/u.test(part) ? part : part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`).join('-')
}
function dateFromId(id) {
  const m = String(id).match(/(?:^|-)(\d{6})(?:$|-)/u)
  if (!m) return undefined
  const yy = Number(m[1].slice(0, 2)); const mm = m[1].slice(2, 4); const dd = m[1].slice(4, 6)
  return `20${String(yy).padStart(2, '0')}-${mm}-${dd}`
}
function parseK(text) {
  const m = clean(text).match(/(\d+(?:\.\d+)?)\s*k/iu)
  return m ? Math.round(Number(m[1]) * 1000) : undefined
}
function sourceUrl(id) { return `https://console.volcengine.com/ark/region:ark+cn-beijing/model/detail?Id=${encodeURIComponent(baseId(id))}` }
function baseId(id) { return String(id).replace(/-\d{6}$/u, '') }
function sourceEntry(id) { return { source: sourceName, source_id: id, url: sourceUrl(id), observed_at: listDoc.updated_time || priceDoc.updated_time || now } }
function endpoint(id) { return { provider_id: providerId, provider_name: providerName, api_model_id: id, base_url: apiBaseUrl, docs_url: sourceUrl(id) } }
function splitRows(md) { return md.split(/\n/u).filter((line) => line.trim().startsWith('|') && !/^\|\s*-+/u.test(line.trim())).map((line) => line.trim().split('|').slice(1, -1)) }

function modalitiesFrom(text, id) {
  const t = `${text} ${id}`.toLowerCase()
  let input = ['text']; let output = ['text']
  if (t.includes('多模态理解') || t.includes('图片理解') || t.includes('视觉定位')) input = unique([...input, 'image'])
  if (t.includes('多模态生视频') || t.includes('文生视频') || t.includes('图生视频') || t.includes('视频')) { input = unique([...input, 'image', 'video']); output = ['video'] }
  if (t.includes('图片生成') || t.includes('文生图') || t.includes('图像')) { input = unique([...input, 'image']); output = ['image'] }
  if (t.includes('3d')) { input = unique([...input, 'image']); output = ['3d'] }
  if (t.includes('向量') || id.includes('embedding')) { output = ['embedding'] }
  return { input, output }
}

function parseListModels(md) {
  const facts = new Map()
  for (const cells of splitRows(md)) {
    const first = cells[0] || ''
    const link = first.match(/\[([^\]]+)\]\(([^)]+)\)/u)
    const card = first.match(/Id=([a-zA-Z0-9._-]+)/u)
    const id = slug(link?.[1] || card?.[1] || first)
    if (!id || !/(doubao|seedance|seedream|seed3d|embedding|deepseek|glm)/u.test(id)) continue
    if (['模型-id-model-id', '模型-id'].includes(id)) continue
    const text = clean(cells.join(' '))
    const { input, output } = modalitiesFrom(text, id)
    facts.set(id, {
      id,
      base_id: slug((link?.[2] || '').match(/Id=([^&\)]+)/u)?.[1] || baseId(id)),
      model: titleFromId(id),
      author: authorFor(id),
      input_modalities: input,
      output_modalities: output,
      reasoning: text.includes('深度思考'),
      tool_calling: text.includes('工具调用'),
      context_length: parseK(text.match(/上下文窗口:?\s*([^\n|]+)/u)?.[1] || ''),
      max_output_tokens: parseK(text.match(/最大回答[^\n]*:?\s*([^\n|]+)/u)?.[1] || ''),
      raw_text: text,
    })
  }
  return facts
}
function authorFor(id) {
  if (id.startsWith('deepseek')) return 'deepseek'
  if (id.startsWith('glm')) return 'z-ai'
  return 'volcengine'
}

function numberCell(value) {
  const text = clean(value)
  if (!text) return Number.NaN
  return Number(text)
}
function parseConditionLabel(label) {
  const text = clean(label)
  const m = text.match(/输入长度\s*([\[(])\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*([\])])/u)
  if (!m) return text ? { label: text } : {}
  const lower = Math.round(Number(m[2]) * 1000)
  const upper = Math.round(Number(m[3]) * 1000)
  const out = { label: text, type: 'input_token' }
  if (m[1] === '[') out.gte = lower
  else out.gt = lower
  if (m[4] === ']') out.lte = upper
  else out.lt = upper
  return out
}
function priceRowsForTextModel(id, sourceId, rows) {
  const out = []
  let current = ''
  for (const cells of rows) {
    const maybe = slug(cells[0] || '')
    if (maybe) current = maybe
    if (norm(current) !== norm(sourceId) && norm(current) !== norm(baseId(sourceId))) continue
    const amountIn = numberCell(cells[2] || '')
    const cacheWrite = numberCell(cells[3] || '')
    const cacheRead = numberCell(cells[4] || '')
    const amountOut = numberCell(cells[5] || '')
    const unit_prices = {}
    if (Number.isFinite(amountIn)) unit_prices.input = { amount: amountIn, unit: 'per_1m_tokens' }
    if (Number.isFinite(cacheWrite)) unit_prices.cache_write = { amount: cacheWrite, unit: 'per_1m_tokens_hour' }
    if (Number.isFinite(cacheRead)) unit_prices.cache_read = { amount: cacheRead, unit: 'per_1m_tokens' }
    if (Number.isFinite(amountOut)) unit_prices.output = { amount: amountOut, unit: 'per_1m_tokens' }
    if (Object.keys(unit_prices).length) out.push({ source: sourceName, source_id: id, source_url: sourceUrl(id), currency: 'CNY', unit_prices, conditions: parseConditionLabel(cells[1] || ''), endpoint: endpoint(id) })
  }
  return out
}
function parseVideoPrices(md) {
  const prices = new Map()
  for (const cells of splitRows(md)) {
    const priceId = slug(clean(cells[0] || '').split('\n>')[0].split('\n')[0])
    if (!priceId.includes('seedance') && !priceId.includes('seedream') && !priceId.includes('seed3d')) continue
    const nums = [...clean(cells.slice(1).join(' ')).matchAll(/(\d+(?:\.\d+)?)/gu)].map((m) => Number(m[1])).filter(Number.isFinite)
    if (!nums.length) continue
    const key = priceId.includes('seedream') ? 'image' : priceId.includes('seed3d') ? 'output' : 'video'
    prices.set(priceId, nums.slice(0, 4).map((n, i) => ({ source: sourceName, source_id: priceId, source_url: sourceUrl(priceId), currency: 'CNY', unit_prices: { [key]: { amount: n, unit: key === 'image' ? 'per_image' : key === 'video' ? 'per_1m_tokens' : 'per_call' } }, conditions: { label: i === 0 ? 'default' : `variant ${i + 1}` }, endpoint: endpoint(priceId) })))
  }
  return prices
}
function parseAllPrices(md, facts) {
  const rows = splitRows(md)
  const byId = new Map()
  const textModelIds = new Set()
  let current = ''
  for (const cells of rows) {
    const maybe = slug(cells[0] || '')
    if (maybe) current = maybe
    if (current) textModelIds.add(norm(current))
  }
  for (const [id, fact] of facts) {
    const sourceIds = unique([fact.id, fact.base_id, baseId(fact.id), baseId(fact.base_id || '')]).filter(Boolean)
    const prices = []
    const seenPrice = new Set()
    for (const sourceId of sourceIds) {
      if (!textModelIds.has(norm(sourceId)) && !textModelIds.has(norm(baseId(sourceId)))) continue
      for (const price of priceRowsForTextModel(id, sourceId, rows)) {
        const key = JSON.stringify(price)
        if (seenPrice.has(key)) continue
        seenPrice.add(key)
        prices.push(price)
      }
    }
    if (prices.length) byId.set(id, prices)
  }
  const media = parseVideoPrices(md)
  for (const [priceId, rowsForId] of media) {
    for (const [id] of facts) {
      if (norm(id) === norm(priceId) || norm(baseId(id)) === norm(priceId)) byId.set(id, rowsForId.map((p) => ({ ...p, source_id: id, endpoint: endpoint(id) })))
    }
  }
  return byId
}

function modelKeys(model) { return unique([model.id, model.model, model.name, ...(model.alias || []), ...(model.aliases || [])]).map((value) => String(value).toLowerCase()) }
const exact = new Map(); const normalized = new Map()
for (const model of models) { for (const k of modelKeys(model)) exact.set(k, model); for (const k of modelKeys(model)) normalized.set(norm(k), model) }
function findTarget(fact) {
  const keys = unique([fact.id, fact.base_id]).map((value) => String(value).toLowerCase())
  for (const k of keys) if (exact.has(k)) return { model: exact.get(k), mode: 'exact' }
  for (const k of keys) if (normalized.has(norm(k))) return { model: normalized.get(norm(k)), mode: 'normalized' }
  return { model: null, mode: 'new' }
}
function mergeSources(existing, incoming) {
  const seen = new Set(); const out = []
  for (const s of [...array(existing), incoming]) { const key = `${s.source}:${s.source_id}`; if (!seen.has(key)) { seen.add(key); out.push(s) } }
  return out
}
function mergePrices(existing, incoming) {
  const map = new Map()
  const key = (p) => JSON.stringify([p.source, p.source_id, p.currency, p.conditions || {}, p.endpoint?.provider_id, p.endpoint?.api_model_id])
  for (const p of array(existing)) map.set(key(p), p)
  for (const p of incoming) map.set(key(p), p)
  return [...map.values()]
}
function newModel(fact, prices) {
  return {
    id: fact.id,
    model: fact.model,
    name: fact.model,
    alias: [],
    aliases: [],
    author: fact.author,
    author_id: fact.author,
    input_modalities: fact.input_modalities,
    output_modalities: fact.output_modalities,
    reasoning: fact.reasoning,
    tool_calling: fact.tool_calling,
    context_length: fact.context_length,
    max_output_tokens: fact.max_output_tokens,
    created: dateFromId(fact.id),
    last_updated: sourceEntry(fact.id).observed_at,
    sources: [sourceEntry(fact.id)],
    prices,
  }
}

const facts = parseListModels(listDoc.md_content || '')
const pricesById = parseAllPrices(priceDoc.md_content || '', facts)
let matchedExact = 0, matchedNormalized = 0, created = 0, priceRowsAdded = 0, updated = 0
const sampleNew = [], sampleUpdated = []
for (const fact of facts.values()) {
  const prices = pricesById.get(fact.id) || []
  const src = sourceEntry(fact.id)
  const { model, mode } = findTarget(fact)
  if (model) {
    if (mode === 'exact') matchedExact++; else matchedNormalized++
    const before = array(model.prices).length
    model.sources = mergeSources(model.sources, src)
    const existingPrices = array(model.prices).filter((price) => price.source !== sourceName)
    model.prices = mergePrices(existingPrices, prices)
    model.context_length ??= fact.context_length
    model.max_output_tokens ??= fact.max_output_tokens
    model.input_modalities = unique([...(model.input_modalities || []), ...fact.input_modalities])
    model.output_modalities = unique([...(model.output_modalities || []), ...fact.output_modalities])
    model.reasoning ||= fact.reasoning
    model.tool_calling ||= fact.tool_calling
    model.last_updated = src.observed_at
    const added = array(model.prices).length - before
    priceRowsAdded += Math.max(0, added)
    updated++
    if (sampleUpdated.length < 20) sampleUpdated.push({ id: model.id, volcengine: fact.id, prices: prices.length, added })
  } else {
    const m = newModel(fact, prices)
    models.push(m)
    created++
    priceRowsAdded += prices.length
    if (sampleNew.length < 30) sampleNew.push({ id: m.id, author: m.author, prices: prices.length })
  }
}
modelsPayload.models = models.sort((a, b) => String(a.author_id || a.author || '').localeCompare(String(b.author_id || b.author || '')) || String(a.id).localeCompare(String(b.id)))
const summary = { apply, volcengine: facts.size, before: JSON.parse(fs.readFileSync(modelsPath, 'utf8')).models.length, after: models.length, matchedExact, matchedNormalized, created, updated, priceRowsAdded, cnyModels: models.filter((m) => array(m.prices).some((p) => p.source === sourceName && p.currency === 'CNY')).length, sampleUpdated, sampleNew }
if (apply) fs.writeFileSync(modelsPath, JSON.stringify(modelsPayload, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
