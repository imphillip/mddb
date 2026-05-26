#!/usr/bin/env node
/**
 * Fetch public Alibaba Cloud Bailian model-market data via direct HTTP.
 *
 * The Bailian console uses a public `bailian-cs.console.aliyun.com` gateway
 * with x-www-form-urlencoded `params` envelopes. We first fetch the catalog,
 * then fetch details only for new/changed catalog rows.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  bailianApiEnvelopeData,
  buildBailianCatalog,
  mergeBailianPayload,
  normalizeBailianModelDetail,
  selectChangedBailianSlugs,
} from './lib/incremental-source-fetch.mjs'

const DEFAULT_REGION = process.env.BAILIAN_REGION || 'cn-beijing'
const DEFAULT_SERVICE_SITE = process.env.BAILIAN_SERVICE_SITE || 'asia-pacific-china'
const DEFAULT_OUTPUT = process.env.BAILIAN_OUTPUT || '.internal/sources/bailian-model-market.json'
const GATEWAY_URL = 'https://bailian-cs.console.aliyun.com/data/api.json'
const LIST_API = 'zeldaHttp.dashscopeModel./zelda/api/v1/modelCenter/listFoundationModels'
const REFERER_BASE = `https://bailian.console.aliyun.com/${DEFAULT_REGION}/?tab=model`
const DETAIL_BASE = `${REFERER_BASE}#/model-market/detail/`
const LIST_URL = `${REFERER_BASE}#/model-market/all`

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

const outputPath = resolve(args.output || DEFAULT_OUTPUT)
const limit = args.limit === undefined ? 10 : Number(args.limit)
const serviceSite = args.serviceSite || DEFAULT_SERVICE_SITE
const fetchedAt = new Date().toISOString()

const previousPayload = await readJsonIfExists(outputPath)
let modelSlugs = []
let catalog = null
if (args.model) modelSlugs.push(args.model)
if (args.models) modelSlugs.push(...String(args.models).split(',').map((s) => s.trim()).filter(Boolean))
if (args.incremental || args.fromList) {
  const list = await fetchList({ serviceSite })
  catalog = buildBailianCatalog(list.models, fetchedAt)
  if (args.incremental) {
    modelSlugs.push(...selectChangedBailianSlugs(catalog, previousPayload, { force: args.forceDetails, limit }))
  } else {
    modelSlugs.push(...catalog.models.map((m) => m.slug || slugFromModelCode(m.model_id) || slugFromName(m.name)).filter(Boolean))
  }
}

modelSlugs = unique(modelSlugs).slice(0, Number.isFinite(limit) ? limit : undefined)
if (modelSlugs.length === 0 && !catalog) {
  console.error('No models requested. Use --model, --models, --from-list, or --incremental.')
  process.exit(1)
}

const models = []
for (const slug of modelSlugs) {
  const url = `${DETAIL_BASE}${encodeURIComponent(slug)}?serviceSite=${encodeURIComponent(serviceSite)}`
  console.error(`Fetching ${slug} ...`)
  const detail = await fetchDetail(slug, { serviceSite })
  models.push({ source_url: url, service_site: serviceSite, ...detail })
}

const payload = catalog
  ? mergeBailianPayload(previousPayload, { catalog, details: models, fetchedAt, region: DEFAULT_REGION, serviceSite })
  : {
      source: 'bailian_model_market',
      fetched_at: fetchedAt,
      region: DEFAULT_REGION,
      service_site: serviceSite,
      count: models.length,
      models,
    }

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
console.error(`Wrote ${payload.models.length} models to ${outputPath} (${models.length} details fetched)`)

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--from-list') out.fromList = true
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
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

function printHelp() {
  console.log(`Fetch Bailian model-market details via direct HTTP.\n\nOptions:\n  --incremental          Fetch catalog first, then details only for new/changed rows\n  --force-details        With --incremental, fetch details for all catalog rows\n  --model <slug>         Fetch one detail model, e.g. qwen3.7-max\n  --models <a,b,c>       Fetch comma-separated detail models\n  --from-list            Read slugs from the public all-models API first\n  --limit <n>            Limit details fetched; default 10\n  --output <path>        Output JSON path; default ${DEFAULT_OUTPUT}\n  --service-site <site>  Detail serviceSite input; default ${DEFAULT_SERVICE_SITE}`)
}

async function fetchList({ serviceSite }) {
  const input = {
    pageNo: 1,
    pageSize: 50,
    name: '',
    providers: [],
    inferenceProviders: [],
    features: [],
    group: true,
    capabilities: [],
    contextWindows: [],
    queryPermissions: true,
    queryApplyStatus: true,
    queryActivationStatus: true,
    supports: { inference: true },
  }
  const first = await callBailianApi(LIST_API, { input }, { referer: LIST_URL })
  const total = Number(first.total || first.count || 0)
  const list = [...(first.list || [])]
  const pageSize = input.pageSize
  for (let pageNo = 2; pageNo <= Math.ceil(total / pageSize); pageNo += 1) {
    const page = await callBailianApi(LIST_API, { input: { ...input, pageNo } }, { referer: LIST_URL })
    list.push(...(page.list || []))
  }
  return { total, count: list.length, models: list.flatMap((row) => [row, ...(row.items || [])]).map((row) => ({ ...row, slug: slugFromModelCode(row.model || row.modelId), service_site: serviceSite })) }
}

async function fetchDetail(model, { serviceSite }) {
  const data = await callBailianApi(LIST_API, {
    input: {
      pageNo: 1,
      pageSize: 1,
      group: true,
      model,
      querySampleCode: true,
      queryGroupByModel: true,
      queryWorkspaceLimit: true,
      queryPrice: true,
      queryQuota: false,
      queryQpmInfo: true,
      queryApplyStatus: true,
      queryPermissions: true,
      queryActivationStatus: true,
      ignoreWorkspaceServiceSite: true,
      serviceSite,
    },
  }, { referer: `${DETAIL_BASE}${encodeURIComponent(model)}?serviceSite=${encodeURIComponent(serviceSite)}` })
  const item = (data.list || []).flatMap((row) => row.items || []).find((row) => row.model === model || row.modelId === model) || data.list?.[0]?.items?.[0] || data.list?.[0]
  return normalizeBailianModelDetail(item, { model, serviceSite })
}

async function callBailianApi(api, data, { referer }) {
  const envelope = {
    Api: api,
    V: '1.0',
    Data: {
      ...data,
      cornerstoneParam: {
        feTraceId: randomUUID(),
        feURL: referer,
        protocol: 'V2',
        console: 'ONE_CONSOLE',
        productCode: 'p_efm',
        switchUserType: 3,
        domain: 'bailian.console.aliyun.com',
        consoleSite: 'BAILIAN_ALIYUN',
        xsp_lang: 'zh-CN',
        'X-Anonymous-Id': 'mddb-dev-fetcher',
      },
    },
  }
  const url = new URL(GATEWAY_URL)
  url.searchParams.set('action', 'BroadScopeAspnGateway')
  url.searchParams.set('product', 'sfm_bailian')
  url.searchParams.set('api', api)
  url.searchParams.set('_v', 'undefined')
  const body = new URLSearchParams({ params: JSON.stringify(envelope), region: DEFAULT_REGION })
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json, text/plain, */*',
      'content-type': 'application/x-www-form-urlencoded',
      'origin': 'https://bailian.console.aliyun.com',
      'referer': referer,
      'user-agent': 'Mozilla/5.0 mddb.dev-source-fetcher',
    },
    body,
  })
  if (!response.ok) throw new Error(`Bailian API HTTP ${response.status} for ${api}`)
  const json = await response.json()
  return bailianApiEnvelopeData(json, api)
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function slugFromModelCode(code) {
  return String(code || '').replace(/-\d{4}-\d{2}-\d{2}$/, '').trim().toLowerCase()
}

function slugFromName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}
