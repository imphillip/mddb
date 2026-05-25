#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const now = new Date().toISOString()
const bailianPath = path.join(root, '.internal/sources/bailian-model-market.json')
const modelsPath = path.join(root, 'data/models.json')
const bailianPayload = JSON.parse(fs.readFileSync(bailianPath, 'utf8'))
const modelsPayload = JSON.parse(fs.readFileSync(modelsPath, 'utf8'))
const bailianModels = (Array.isArray(bailianPayload.models) ? bailianPayload.models : []).filter((row) => row.list_observed !== false)
const models = Array.isArray(modelsPayload.models) ? modelsPayload.models : []

const sourceName = 'bailian_model_market'
const providerId = 'alibaba-bailian-cn'
const providerName = 'Alibaba Cloud Bailian (China)'
const apiBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^[-_a-z0-9]+\//u, '')
    .replace(/[:@].*$/u, '')
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}
function norm(value) { return slug(value).replace(/[._-]+/gu, '-') }
function titleFromId(id) {
  return String(id || '').split(/[-_]/u).filter(Boolean).map((part) => {
    if (/^\d+(\.\d+)?$/u.test(part)) return part
    return part.length <= 3 ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`
  }).join('-')
}
function array(value) { return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [] }
function unique(values) { return Array.from(new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))) }
function modality(value) {
  const map = { Text: 'text', Image: 'image', Audio: 'audio', Video: 'video' }
  return map[value] || String(value || '').toLowerCase()
}
function priceKey(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('output')) return t.includes('audio') ? 'audio_output' : 'output'
  if (t.includes('cache') && t.includes('read')) return 'cache_read'
  if (t.includes('cache') && (t.includes('creation') || t.includes('write'))) return 'cache_write'
  if (t.includes('audio') && t.includes('input')) return 'audio_input'
  if ((t.includes('vision') || t.includes('image') || t.includes('video')) && t.includes('input')) return 'vision_input'
  if (t.includes('image')) return 'image'
  if (t.includes('video')) return 'video'
  if (t.includes('input') || t.includes('text')) return 'input'
  return slug(t || 'custom') || 'custom'
}
function unit(rawUnit, key, context = '') {
  const u = String(rawUnit || '').trim()
  const c = `${key} ${context}`.toLowerCase()
  if (u.includes('百万') && u.toLowerCase().includes('token')) return 'per_1m_tokens'
  if (u.includes('千次')) return 'per_1k_calls'
  if (u.includes('张')) return 'per_image'
  if (u.includes('秒')) return c.includes('video') || c.includes('视频') ? 'per_video_second' : 'per_second'
  return u || 'custom'
}

function sourceUrl(row) { return row.source_url || `https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/detail/${encodeURIComponent(row.model_id || row.model_code)}?serviceSite=asia-pacific-china` }

function sourceEntry(row) {
  return { source: sourceName, source_id: row.model_id || row.model_code, url: sourceUrl(row), observed_at: row.candidate_model_fact?.sources?.find((s) => s.source === sourceName)?.observed_at || bailianPayload.last_batch_observation?.observed_at || now }
}
function modelKeys(model) { return unique([model.id, model.model, model.name, ...(model.alias || []), ...(model.aliases || [])]).map((value) => String(value).toLowerCase()) }
const exact = new Map()
const normalized = new Map()
for (const model of models) {
  for (const key of modelKeys(model)) exact.set(key, model)
  for (const key of modelKeys(model)) normalized.set(norm(key), model)
}
function findTarget(row) {
  const keys = unique([row.model_id, row.model_code, row.slug, row.name, row.candidate_model_fact?.id, row.candidate_model_fact?.model]).map((value) => String(value).toLowerCase())
  for (const key of keys) if (exact.has(key)) return { model: exact.get(key), mode: 'exact' }
  for (const key of keys) if (normalized.has(norm(key))) return { model: normalized.get(norm(key)), mode: 'normalized' }
  return { model: null, mode: 'new' }
}
function pricesFor(row) {
  const rows = []
  const priceUnit = (p) => p.unit ?? p.priceUnit
  const priceLabel = (p) => p.label ?? p.priceName
  for (const p of array(row.pricing)) {
    const amount = Number(p.price)
    if (!Number.isFinite(amount)) continue
    const key = priceKey([p.type, priceLabel(p)].filter(Boolean).join(' '))
    rows.push({
      source: sourceName,
      source_id: row.model_id || row.model_code,
      source_url: sourceUrl(row),
      currency: p.currency || row.pricing_currency || 'CNY',
      unit_prices: { [key]: { amount, unit: unit(priceUnit(p), key, priceLabel(p)) } },
      conditions: Object.assign({}, p.discount !== undefined ? { discount: p.discount } : {}, priceLabel(p) ? { label: priceLabel(p) } : {}, p.type ? { bailian_type: p.type } : {}),
      endpoint: { provider_id: providerId, provider_name: providerName, api_model_id: row.model_id || row.model_code, base_url: row.api_base_url || apiBaseUrl, docs_url: sourceUrl(row) },
    })
  }
  for (const tool of array(row.tool_pricing)) {
    for (const p of array(tool.prices)) {
      const amount = Number(p.price)
      if (!Number.isFinite(amount)) continue
      rows.push({
        source: sourceName,
        source_id: row.model_id || row.model_code,
        source_url: sourceUrl(row),
        currency: p.currency || row.pricing_currency || 'CNY',
        unit_prices: { [slug(tool.type || tool.name || 'tool')]: { amount, unit: unit(p.priceUnit, 'tool') } },
        conditions: { label: tool.name, supported_api: tool.supportedApi, doc_url: tool.docUrl, bailian_type: 'tool_pricing' },
        endpoint: { provider_id: providerId, provider_name: providerName, api_model_id: row.model_id || row.model_code, base_url: row.api_base_url || apiBaseUrl, docs_url: sourceUrl(row) },
      })
    }
  }
  return rows
}
function mergePriceRows(existing, incoming) {
  const seen = new Set()
  const out = []
  for (const p of [...array(existing), ...incoming]) {
    const key = JSON.stringify([p.source, p.source_id, p.currency, p.conditions || {}, p.unit_prices || {}, p.endpoint?.provider_id, p.endpoint?.api_model_id])
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}
function mergeSources(existing, incoming) {
  const seen = new Set()
  const out = []
  for (const s of [...array(existing), incoming]) {
    const key = `${s.source}:${s.source_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}
function factFor(row) { return row.candidate_model_fact && typeof row.candidate_model_fact === 'object' ? row.candidate_model_fact : {} }
function newModel(row) {
  const fact = factFor(row)
  const id = slug(fact.id || row.model_id || row.model_code || row.name)
  const input = array(row.inference_metadata?.request_modality || fact.other_parameters?.request_modality).map(modality)
  const output = array(row.inference_metadata?.response_modality || fact.other_parameters?.response_modality).map(modality)
  const other = Object.assign({}, fact.other_parameters || {})
  delete other.price_rows_source
  delete other.price_rows_count
  return {
    id,
    model: fact.model || row.name || titleFromId(id),
    name: fact.model || row.name || titleFromId(id),
    alias: unique([row.model_id, row.model_code].filter((value) => value && value !== id)),
    aliases: unique([row.model_id, row.model_code].filter((value) => value && value !== id)),
    author: slug(fact.author || row.provider || 'qwen'),
    author_id: slug(fact.author || row.provider || 'qwen'),
    input_modalities: unique(input.length ? input : ['text']),
    output_modalities: unique(output.length ? output : ['text']),
    reasoning: array(row.capabilities).includes('Reasoning') || array(row.features).includes('reasoning'),
    tool_calling: array(row.features).includes('function-calling'),
    context_length: fact.context_length ?? row.limits?.context_window,
    max_output_tokens: fact.max_output_tokens ?? row.limits?.max_output_tokens,
    other_parameters: other,
    last_updated: sourceEntry(row).observed_at,
    sources: [sourceEntry(row)],
    prices: pricesFor(row),
  }
}
let matchedExact = 0, matchedNormalized = 0, created = 0, updated = 0, priceRowsAdded = 0
const sampleNew = [], sampleUpdated = []
for (const row of bailianModels) {
  const { model, mode } = findTarget(row)
  const prices = pricesFor(row)
  const src = sourceEntry(row)
  if (model) {
    if (mode === 'exact') matchedExact++; else matchedNormalized++
    const beforePrices = array(model.prices).length
    model.prices = mergePriceRows(model.prices, prices)
    model.sources = mergeSources(model.sources, src)
    if (!array(model.alias).map((a) => String(a).toLowerCase()).includes(String(row.model_id || '').toLowerCase()) && row.model_id && row.model_id !== model.id) model.alias = unique([...(model.alias || []), row.model_id])
    if (!array(model.aliases).map((a) => String(a).toLowerCase()).includes(String(row.model_id || '').toLowerCase()) && row.model_id && row.model_id !== model.id) model.aliases = unique([...(model.aliases || []), row.model_id])
    model.context_length ??= row.limits?.context_window
    model.max_output_tokens ??= row.limits?.max_output_tokens
    model.last_updated = src.observed_at
    const added = array(model.prices).length - beforePrices
    priceRowsAdded += Math.max(0, added)
    if (added || !array(model.sources).some((s) => s.source === sourceName && s.source_id === src.source_id)) updated++
    if (sampleUpdated.length < 20 && (added || prices.length)) sampleUpdated.push({ id: model.id, bailian: row.model_id, prices: prices.length, added })
  } else {
    const m = newModel(row)
    models.push(m)
    created++
    priceRowsAdded += array(m.prices).length
    if (sampleNew.length < 30) sampleNew.push({ id: m.id, name: m.name, author: m.author, prices: array(m.prices).length })
  }
}
modelsPayload.models = models.sort((a, b) => String(a.author_id || a.author || '').localeCompare(String(b.author_id || b.author || '')) || String(a.id).localeCompare(String(b.id)))
const summary = { apply, bailian: bailianModels.length, before: JSON.parse(fs.readFileSync(modelsPath, 'utf8')).models.length, after: models.length, matchedExact, matchedNormalized, created, priceRowsAdded, cnyModels: models.filter((m) => array(m.prices).some((p) => p.source === sourceName && p.currency === 'CNY')).length, sampleUpdated, sampleNew }
if (apply) fs.writeFileSync(modelsPath, JSON.stringify(modelsPayload, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
