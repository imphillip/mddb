import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { spawn } from 'node:child_process'

export type UpdateOptions = {
  repoRoot: string
  command?: string
  args?: string[]
  timeoutMs?: number
}

type UpdateSourceConfig = {
  id: string
  defaultShellCommand: string
}

const UPDATE_SOURCES = {
  openrouter: {
    id: 'openrouter',
    defaultShellCommand: 'npm run data:openrouter && npm run registry:populate:openrouter',
  },
  modelsDev: {
    id: 'models-dev',
    defaultShellCommand: 'npm run data:models-dev && npm run registry:populate:models-dev',
  },
} satisfies Record<string, UpdateSourceConfig>

export type PreviewResult = {
  ok: boolean
  changedFiles: string[]
  diff: string
  patchFile: string
  stdout: string
  stderr: string
}

export type ApplyResult = {
  ok: boolean
  stdout: string
  stderr: string
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000

export async function previewOpenRouterUpdate(options: UpdateOptions): Promise<PreviewResult> {
  return previewUpdate({ ...options, source: UPDATE_SOURCES.openrouter })
}

export async function previewModelsDevUpdate(options: UpdateOptions): Promise<PreviewResult> {
  return previewUpdate({ ...options, source: UPDATE_SOURCES.modelsDev })
}


async function previewUpdate(options: UpdateOptions & { source: UpdateSourceConfig }): Promise<PreviewResult> {
  const repoRoot = resolve(options.repoRoot)
  const patchFile = join(repoRoot, '.internal', 'update-previews', `${options.source.id}-${Date.now()}.patch`)
  const snapshot = await git(repoRoot, ['diff', '--binary'])
  const command = options.command ?? 'sh'
  const args = options.args ?? ['-lc', options.source.defaultShellCommand]
  const run = await runCommand(repoRoot, command, args, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  await git(repoRoot, ['add', '-N', '--', 'data'], true)
  if (existsSync(join(repoRoot, '.internal', 'source-data'))) {
    await git(repoRoot, ['add', '-N', '--', '.internal/source-data'], true)
  }
  const changed = await git(repoRoot, ['diff', '--name-only', '--', 'data', '.internal/source-data'])
  const diff = await git(repoRoot, ['diff', '--', 'data', '.internal/source-data'])
  mkdirSync(dirname(patchFile), { recursive: true })
  writeFileSync(patchFile, diff.stdout)
  await restoreWorkingTree(repoRoot, snapshot.stdout)

  if (run.exitCode !== 0) {
    throw new Error(`${options.source.id} update failed (${run.exitCode})\n${run.stderr || run.stdout}`)
  }

  return {
    ok: true,
    changedFiles: changed.stdout.split('\n').map((line) => line.trim()).filter(Boolean),
    diff: diff.stdout,
    patchFile,
    stdout: run.stdout,
    stderr: run.stderr,
  }
}

export async function applyOpenRouterUpdate(options: { repoRoot: string, patchFile: string }): Promise<ApplyResult> {
  const repoRoot = resolve(options.repoRoot)
  const patchFile = resolve(options.patchFile)
  const previewDir = resolve(repoRoot, '.internal', 'update-previews')
  if (!patchFile.startsWith(`${previewDir}/`) || !existsSync(patchFile)) {
    throw new Error('Invalid preview patch file')
  }
  const result = await git(repoRoot, ['apply', '--whitespace=nowarn', patchFile])
  if (result.exitCode === 0) rmSync(patchFile, { force: true })
  return { ok: result.exitCode === 0, stdout: result.stdout, stderr: result.stderr }
}

async function restoreWorkingTree(repoRoot: string, originalPatch: string): Promise<void> {
  await git(repoRoot, ['checkout', 'HEAD', '--', 'data'], true)
  await git(repoRoot, ['checkout', 'HEAD', '--', '.internal/source-data'], true)
  await git(repoRoot, ['reset', '-q', '--', 'data', '.internal/source-data'], true)
  await runCommand(repoRoot, 'git', ['clean', '-fd', '--', 'data', '.internal/source-data'], 60_000)
  if (originalPatch.trim()) {
    const patchPath = join(repoRoot, '.internal', 'update-previews', `restore-${Date.now()}.patch`)
    mkdirSync(dirname(patchPath), { recursive: true })
    writeFileSync(patchPath, originalPatch)
    await git(repoRoot, ['apply', '--whitespace=nowarn', patchPath], true)
    rmSync(patchPath, { force: true })
  }
}

async function git(repoRoot: string, args: string[], allowFailure = false): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  const result = await runCommand(repoRoot, 'git', args, 60_000)
  if (!allowFailure && result.exitCode !== 0) throw new Error(`git ${args.join(' ')} failed\n${result.stderr}`)
  return result
}

function runCommand(cwd: string, command: string, args: string[], timeoutMs: number): Promise<{ exitCode: number, stdout: string, stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: process.env })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`${command} ${args.join(' ')} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (exitCode) => {
      clearTimeout(timer)
      resolvePromise({ exitCode: exitCode ?? 1, stdout, stderr })
    })
  })
}

export function publicPatchLabel(repoRoot: string, patchFile: string): string {
  return relative(repoRoot, patchFile)
}
