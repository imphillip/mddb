import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { applyOpenRouterUpdate, previewOpenRouterUpdate } from './update-runner.js'

describe('update runner', () => {
  it('previews OpenRouter-generated data changes and applies only after confirmation', async () => {
    const repoRoot = mkdirTempRepo()
    await initGitRepo(repoRoot)
    const dataDir = join(repoRoot, 'data')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'models.json'), '{"models":[{"id":"old"}]}\n')
    spawnSync('git', ['add', 'data/models.json'], { cwd: repoRoot, stdio: 'ignore' })
    spawnSync('git', ['commit', '-m', 'baseline'], { cwd: repoRoot, stdio: 'ignore' })

    const preview = await previewOpenRouterUpdate({
      repoRoot,
      command: process.execPath,
      args: ['-e', "const fs=require('fs'); fs.writeFileSync('data/models.json', '{\\\"models\\\":[{\\\"id\\\":\\\"new\\\"}]}\\n')"],
      timeoutMs: 10_000,
    })

    expect(preview.ok).toBe(true)
    expect(preview.changedFiles).toContain('data/models.json')
    expect(preview.diff).toContain('-{"models":[{"id":"old"}]}')
    expect(preview.diff).toContain('+{"models":[{"id":"new"}]}')
    expect(readFileSync(join(dataDir, 'models.json'), 'utf8')).toContain('old')

    const applied = await applyOpenRouterUpdate({ repoRoot, patchFile: preview.patchFile })
    expect(applied.ok).toBe(true)
    expect(readFileSync(join(dataDir, 'models.json'), 'utf8')).toContain('new')
  })
})

function mkdirTempRepo(): string {
  const dir = join(tmpdir(), `mddb-update-${process.pid}-${Math.random().toString(16).slice(2)}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

async function initGitRepo(repoRoot: string): Promise<void> {
  spawnSync('git', ['init'], { cwd: repoRoot, stdio: 'ignore' })
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoRoot, stdio: 'ignore' })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: repoRoot, stdio: 'ignore' })
}
