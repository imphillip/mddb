#!/usr/bin/env node
/**
 * Fetch public Alibaba Cloud Bailian model-market data.
 *
 * Output is intentionally written under .internal/ because Bailian data needs
 * human review/canonicalization before it can enrich data/models.json.
 *
 * Usage:
 *   node scripts/fetch-bailian-model-market.mjs --incremental
 *   node scripts/fetch-bailian-model-market.mjs --model qwen3.7-max
 *   node scripts/fetch-bailian-model-market.mjs --models qwen3.7-max,qwen3.6-plus
 *   node scripts/fetch-bailian-model-market.mjs --from-list --limit 20
 *
 * Optional env:
 *   BAILIAN_SERVICE_SITE=asia-pacific-china
 *   BAILIAN_REGION=cn-beijing
 *   BAILIAN_OUTPUT=.internal/sources/bailian-model-market.json
 *   BAILIAN_BROWSER=chromium|google-chrome|...
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { buildBailianCatalog, mergeBailianPayload, selectChangedBailianSlugs } from './lib/incremental-source-fetch.mjs'

const DEFAULT_REGION = process.env.BAILIAN_REGION || 'cn-beijing'
const DEFAULT_SERVICE_SITE = process.env.BAILIAN_SERVICE_SITE || 'asia-pacific-china'
const DEFAULT_OUTPUT = process.env.BAILIAN_OUTPUT || '.internal/sources/bailian-model-market.json'
const DETAIL_BASE = `https://bailian.console.aliyun.com/${DEFAULT_REGION}/?tab=model#/model-market/detail/`
const LIST_URL = `https://bailian.console.aliyun.com/${DEFAULT_REGION}/?tab=model#/model-market/all`

const args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

const outputPath = resolve(args.output || DEFAULT_OUTPUT)
const timeoutMs = Number(args.timeout || 45000)
const limit = args.limit === undefined ? 10 : Number(args.limit)
const serviceSite = args.serviceSite || DEFAULT_SERVICE_SITE

const browser = process.env.BAILIAN_BROWSER || args.browser || findBrowser()
if (!browser) {
  console.error('Could not find a Chromium/Chrome executable. Set BAILIAN_BROWSER=/path/to/chrome.')
  process.exit(1)
}

const profileDir = await mkdtemp(resolve(tmpdir(), 'bailian-chrome-'))
try {
  const previousPayload = await readJsonIfExists(outputPath)
  let modelSlugs = []
  let catalog = null
  if (args.model) modelSlugs.push(args.model)
  if (args.models) modelSlugs.push(...String(args.models).split(',').map((s) => s.trim()).filter(Boolean))
  if (args.incremental || args.fromList) {
    const list = await fetchList(browser, profileDir, timeoutMs)
    catalog = buildBailianCatalog(list.models, new Date().toISOString())
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
    const detail = await fetchDetail(browser, profileDir, url, timeoutMs)
    models.push({ source_url: url, service_site: serviceSite, ...detail })
  }

  const payload = catalog
    ? mergeBailianPayload(previousPayload, { catalog, details: models, fetchedAt: new Date().toISOString(), region: DEFAULT_REGION, serviceSite })
    : {
        source: 'bailian_model_market',
        fetched_at: new Date().toISOString(),
        region: DEFAULT_REGION,
        service_site: serviceSite,
        count: models.length,
        models,
      }

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.error(`Wrote ${payload.models.length} models to ${outputPath} (${models.length} details fetched)`)
} finally {
  await rm(profileDir, { recursive: true, force: true })
}

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
  console.log(`Fetch Bailian model-market details.\n\nOptions:\n  --incremental          Fetch catalog first, then details only for new/changed rows\n  --force-details        With --incremental, fetch details for all catalog rows\n  --model <slug>         Fetch one detail page, e.g. qwen3.7-max\n  --models <a,b,c>       Fetch comma-separated detail slugs\n  --from-list            Read slugs from the public all-models page first\n  --limit <n>            Limit details fetched; default 10\n  --output <path>        Output JSON path; default ${DEFAULT_OUTPUT}\n  --service-site <site>  Detail serviceSite query; default ${DEFAULT_SERVICE_SITE}\n  --browser <path>       Chromium/Chrome executable\n  --timeout <ms>         Per-page timeout; default 45000`)
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function findBrowser() {
  const candidates = [
    'chromium',
    'chromium-browser',
    'google-chrome',
    'google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((cmd) => commandExists(cmd))
}

function commandExists(cmd) {
  const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' })
  return result.status === 0
}

async function fetchList(browser, profileDir, timeoutMs) {
  const result = await runChromeEval(browser, profileDir, LIST_URL, listExtractorSource(), timeoutMs)
  return result
}

async function fetchDetail(browser, profileDir, url, timeoutMs) {
  return runChromeEval(browser, profileDir, url, detailExtractorSource(), timeoutMs)
}

async function runChromeEval(browser, profileDir, url, extractorSource, timeoutMs) {
  const remotePort = 9222 + Math.floor(Math.random() * 1000)
  const child = spawn(browser, [
    '--headless=new',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${remotePort}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  try {
    await waitForDevTools(remotePort, timeoutMs)
    const tab = await newTab(remotePort, url)
    const wsUrl = tab.webSocketDebuggerUrl
    const client = new DevToolsClient(wsUrl)
    await client.connect()
    try {
      await client.send('Runtime.enable')
      await waitForPageReady(client, timeoutMs)
      const expression = `(${extractorSource})()`
      const response = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs,
      })
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.text || 'Runtime.evaluate failed')
      }
      return response.result.value
    } finally {
      await client.close()
      await closeTab(remotePort, tab.id).catch(() => {})
    }
  } finally {
    child.kill('SIGTERM')
  }
}

async function waitForDevTools(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return
    } catch {}
    await sleep(200)
  }
  throw new Error('Timed out waiting for Chrome DevTools')
}

async function newTab(port, url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  if (!res.ok) throw new Error(`Failed to create tab: HTTP ${res.status}`)
  return res.json()
}

async function closeTab(port, id) {
  await fetch(`http://127.0.0.1:${port}/json/close/${id}`)
}

async function waitForPageReady(client, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body?.innerText || '';
        return {
          ready: document.readyState,
          hasDetail: text.includes('模型价格') && text.includes('模型限流与上下文'),
          hasList: text.includes('模型作者') && text.includes('全部模型'),
          text: text.slice(0, 200),
        };
      })()`,
      returnByValue: true,
    })
    const value = response.result.value
    if (value?.hasDetail || value?.hasList) return value
    await sleep(500)
  }
  throw new Error('Timed out waiting for Bailian page content')
}

class DevToolsClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.nextId = 1
    this.pending = new Map()
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  async close() {
    this.ws?.close()
  }
}

function detailExtractorSource() {
  return String.raw`async function extractDetail() {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const asNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const parseBaseUrl = (item) => {
      const code = item?.sampleCodeV2?.openai?.completionsAPI?.python?.code
        || item?.sampleCodeV2?.openai?.completionsAPI?.curl?.code
        || item?.sampleCode?.openai?.python
        || item?.sampleCode?.openai?.curl
        || '';
      return clean(String(code).match(/base_?url\s*=\s*["']([^"']+)/i)?.[1] || String(code).match(/https:\/\/[^\s"']+/)?.[0] || '');
    };
    const normalizePrice = (price) => ({
      type: price.type || null,
      label: price.priceName || null,
      price: asNumber(price.price),
      currency: price.currency || 'CNY',
      unit: price.priceUnit || null,
      discount: asNumber(price.discount),
      raw: price,
    });
    const normalizeTier = (tier) => ({
      range_name: tier.rangeName || null,
      range_start_tokens: asNumber(tier.rangeStart),
      range_end_tokens: asNumber(tier.rangeEnd),
      prices: Array.isArray(tier.prices) ? tier.prices.map(normalizePrice) : [],
      raw: tier,
    });

    const modelFromUrl = decodeURIComponent(location.hash.match(/\/model-market\/detail\/([^?]+)/)?.[1] || '');
    const until = Date.now() + 45000;
    while (Date.now() < until) {
      if (window.webpackChunkDesktop) break;
      await sleep(250);
    }

    let req = window.__wreq;
    if (!req && window.webpackChunkDesktop?.push) {
      window.webpackChunkDesktop.push([[Math.floor(Math.random() * 1000000000)], {}, function(__webpack_require__) { req = __webpack_require__; window.__wreq = __webpack_require__; }]);
    }
    if (!req) throw new Error('Could not access webpack runtime for Bailian API module');

    const api = req(494633)?.O4?.getNewFoundationModelsList;
    if (!api) throw new Error('Could not access Bailian getNewFoundationModelsList API module');

    const serviceSite = new URLSearchParams(location.hash.split('?')[1] || location.search).get('serviceSite') || 'asia-pacific-china';
    const input = {
      pageNo: 1,
      pageSize: 50,
      group: true,
      model: modelFromUrl,
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
    };
    const response = await api({ input });
    const json = JSON.parse(JSON.stringify(response));
    if (json?.success === false) throw new Error(json.message || 'Bailian API returned success=false');
    const items = (json.list || []).flatMap((group) => group.items || []);
    const item = items.find((row) => row.model === modelFromUrl || row.modelId === modelFromUrl) || items[0];
    if (!item) throw new Error('Bailian API returned no model item for ' + modelFromUrl);
    item.__bailianListObserved = true;

    const flatPricing = Array.isArray(item.prices) ? item.prices.map(normalizePrice) : [];
    const tieredPricing = Array.isArray(item.multiPrices) ? item.multiPrices.map(normalizeTier) : [];
    const toolPricing = Array.isArray(item.builtInToolMultiPrices) ? item.builtInToolMultiPrices.map((tool) => ({
      type: tool.type || null,
      name: tool.name || null,
      supported_api: tool.supportedApi || null,
      doc_url: tool.docUrl || null,
      prices: Array.isArray(tool.prices) ? tool.prices.map(normalizePrice) : [],
      raw: tool,
    })) : [];

    return {
      model_code: item.model || modelFromUrl,
      model_id: item.modelId || item.model || modelFromUrl,
      name: item.name || null,
      provider: item.provider || item.providerId || null,
      description: item.description || item.shortDescription || null,
      equivalent_snapshot: item.equivalentSnapshot || null,
      open_source: Boolean(item.openSource),
      collection_tag: item.collectionTag || null,
      version_tag: item.versionTag || null,
      capabilities: item.capabilities || item.typeIds || [],
      features: item.features || [],
      pricing: flatPricing.length ? flatPricing : null,
      pricing_currency: 'CNY',
      tiered_pricing: tieredPricing.length ? tieredPricing : null,
      tool_pricing: toolPricing,
      limits: {
        context_window: asNumber(item.contextWindow ?? item.modelInfo?.contextWindow),
        max_input_tokens: asNumber(item.maxInputTokens ?? item.modelInfo?.maxInputTokens),
        max_output_tokens: asNumber(item.maxOutputTokens ?? item.modelInfo?.maxOutputTokens),
        max_reasoning_tokens: asNumber(item.modelInfo?.maxReasoningTokens),
        reasoning_max_input_tokens: asNumber(item.maxInputTokensThinking ?? item.modelInfo?.reasoningMaxInputTokens),
        reasoning_max_output_tokens: asNumber(item.maxOutputTokensThinking ?? item.modelInfo?.reasoningMaxOutputTokens),
      },
      qpm_info: item.qpmInfo || null,
      api_base_url: parseBaseUrl(item) || null,
      doc_url: item.docUrl || null,
      service_sites: item.serviceSites || [],
      latest_online_at: item.latestOnlineAt || item.onlineTime || null,
      list_observed: item.__bailianListObserved !== false,
      raw: item,
    };
  }`
}

function listExtractorSource() {
  return String.raw`async function extractList() {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const until = Date.now() + 45000;
    while (Date.now() < until) {
      const text = document.body?.innerText || '';
      if (text.includes('全部模型') && document.querySelector('[class*=modelCard]')) break;
      await sleep(500);
    }
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const slugFrom = (value) => clean(value).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    const cards = Array.from(document.querySelectorAll('[class*=modelCard]'));
    const seen = new Set();
    const models = [];
    for (const card of cards) {
      const text = card.innerText || '';
      if (!text.trim() || text.trim() === '\t') continue;
      const nameNode = card.querySelector('[class*=name]');
      const name = clean(nameNode?.childNodes?.[0]?.textContent || text.split('\n')[0]);
      const modelId = clean(card.querySelector('[class*=latestName]')?.innerText || '');
      const description = clean(card.querySelector('[class*=center]')?.innerText || '');
      const features = Array.from(card.querySelectorAll('[class*=bottomLeftTags] [class*=tag]')).map((el) => clean(el.innerText)).filter(Boolean);
      const date = clean(card.querySelector('[class*=time]')?.innerText || '');
      const tags = Array.from(card.querySelectorAll('[class*=topRightTagText]')).map((el) => clean(el.innerText)).filter(Boolean);
      const slug = slugFrom(modelId.replace(/-\d{4}-\d{2}-\d{2}$/, '') || name);
      const key = name + '|' + modelId;
      if (!seen.has(key) && name) {
        seen.add(key);
        models.push({ name, model_id: modelId, slug, description, features, date, tags });
      }
    }
    return { count: models.length, models };
  }`
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
