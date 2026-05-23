#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { renderUpdateAdminPage } from '../lib/update-admin-renderer.js'
import { summarizeRegistryDiff } from '../lib/update-diff-summary.js'
import { applyOpenRouterUpdate, previewBaseLlmUpdate, previewModelsDevUpdate, previewOpenRouterUpdate } from '../lib/update-runner.js'

const repoRoot = process.cwd()
const publicDir = join(repoRoot, 'public')
const port = Number.parseInt(process.env.UPDATE_ADMIN_PORT ?? '4174', 10)
const password = process.env.UPDATE_ADMIN_PASSWORD

if (!password) {
  console.error('UPDATE_ADMIN_PASSWORD is required')
  process.exit(1)
}
const adminPassword: string = password

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (req.method === 'GET' && (url.pathname === '/update' || url.pathname === '/update/')) {
      sendHtml(res, renderUpdateAdminPage())
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/session') {
      const body = await readJson(req)
      sendJson(res, verifyPassword(body.password) ? 200 : 401, { ok: verifyPassword(body.password) })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/openrouter/preview') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await previewOpenRouterUpdate({ repoRoot })
      sendJson(res, 200, result.ok ? { ...result, summary: summarizeRegistryDiff(result.diff, result.changedFiles) } : result)
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/models-dev/preview') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await previewModelsDevUpdate({ repoRoot })
      sendJson(res, 200, result.ok ? { ...result, summary: summarizeRegistryDiff(result.diff, result.changedFiles) } : result)
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/basellm/preview') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await previewBaseLlmUpdate({ repoRoot })
      sendJson(res, 200, result.ok ? { ...result, summary: summarizeRegistryDiff(result.diff, result.changedFiles) } : result)
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/openrouter/apply') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await applyOpenRouterUpdate({ repoRoot, patchFile: String(body.patchFile ?? '') })
      sendJson(res, result.ok ? 200 : 500, result)
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/models-dev/apply') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await applyOpenRouterUpdate({ repoRoot, patchFile: String(body.patchFile ?? '') })
      sendJson(res, result.ok ? 200 : 500, result)
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/update/basellm/apply') {
      const body = await readJson(req)
      if (!verifyPassword(body.password)) return sendJson(res, 401, { ok: false, error: 'unauthorized' })
      const result = await applyOpenRouterUpdate({ repoRoot, patchFile: String(body.patchFile ?? '') })
      sendJson(res, result.ok ? 200 : 500, result)
      return
    }
    if (req.method === 'GET') {
      await serveStatic(url.pathname, res)
      return
    }
    sendJson(res, 405, { ok: false, error: 'method not allowed' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`mddb update admin listening on http://127.0.0.1:${port}/update/`)
})

function verifyPassword(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const a = createHash('sha256').update(value).digest()
  const b = createHash('sha256').update(adminPassword).digest()
  return timingSafeEqual(a, b)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of req) raw += String(chunk)
  return raw ? JSON.parse(raw) as Record<string, unknown> : {}
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(html)
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(value))
}

async function serveStatic(pathname: string, res: ServerResponse): Promise<void> {
  const clean = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname
  if (clean.includes('..')) return sendJson(res, 400, { ok: false, error: 'bad path' })
  try {
    const content = await readFile(join(publicDir, clean))
    res.writeHead(200, { 'content-type': contentType(clean) })
    res.end(content)
  } catch {
    sendJson(res, 404, { ok: false, error: 'not found' })
  }
}

function contentType(pathname: string): string {
  if (pathname.endsWith('.html')) return 'text/html; charset=utf-8'
  if (pathname.endsWith('.json')) return 'application/json; charset=utf-8'
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8'
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8'
  return 'application/octet-stream'
}
