import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { applyOpenRouterUpdate, previewBaseLlmUpdate, previewModelsDevUpdate, previewOpenRouterUpdate } from './update-runner.js'

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
    expect(() => readFileSync(preview.patchFile, 'utf8')).toThrow()

    const secondPreview = await previewOpenRouterUpdate({
      repoRoot,
      command: process.execPath,
      args: ['-e', "const fs=require('fs'); fs.writeFileSync('data/models.json', '{\\\"models\\\":[{\\\"id\\\":\\\"newer\\\"}]}\\n')"],
      timeoutMs: 10_000,
    })
    expect(secondPreview.ok).toBe(true)
    expect(secondPreview.changedFiles).toContain('data/models.json')
    expect(readFileSync(join(dataDir, 'models.json'), 'utf8')).toContain('new')
  })

  it('previews models.dev provider enrichment through the same update toolbox flow', async () => {
    const repoRoot = mkdirTempRepo()
    await initGitRepo(repoRoot)
    const dataDir = join(repoRoot, 'data')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'models.json'), '{"models":[]}\n')
    spawnSync('git', ['add', 'data/models.json'], { cwd: repoRoot, stdio: 'ignore' })
    spawnSync('git', ['commit', '-m', 'baseline'], { cwd: repoRoot, stdio: 'ignore' })

    const preview = await previewModelsDevUpdate({
      repoRoot,
      command: process.execPath,
      args: ['-e', "const fs=require('fs'); fs.mkdirSync('data/providers',{recursive:true}); fs.writeFileSync('data/providers/openai.json', '{\\\"id\\\":\\\"openai\\\",\\\"icon\\\":\\\"https://models.dev/logos/openai.svg\\\"}\\n')"],
      timeoutMs: 10_000,
    })

    expect(preview.ok).toBe(true)
    expect(preview.patchFile).toContain('/.internal/update-previews/models-dev-')
    expect(preview.changedFiles).toContain('data/providers/openai.json')
    expect(preview.diff).toContain('+{"id":"openai","icon":"https://models.dev/logos/openai.svg"}')
    expect(() => readFileSync(join(dataDir, 'providers', 'openai.json'), 'utf8')).toThrow()
  })

  it('previews BaseLLM provider price enrichment through the same update toolbox flow', async () => {
    const repoRoot = mkdirTempRepo()
    await initGitRepo(repoRoot)
    const dataDir = join(repoRoot, 'data')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(join(dataDir, 'models.json'), '{"models":[]}\n')
    spawnSync('git', ['add', 'data/models.json'], { cwd: repoRoot, stdio: 'ignore' })
    spawnSync('git', ['commit', '-m', 'baseline'], { cwd: repoRoot, stdio: 'ignore' })

    const preview = await previewBaseLlmUpdate({
      repoRoot,
      command: process.execPath,
      args: ['-e', "const fs=require('fs'); fs.mkdirSync('data/providers',{recursive:true}); fs.writeFileSync('data/providers/302-ai.json', '{\\\"id\\\":\\\"302-ai\\\",\\\"sources\\\":[{\\\"source\\\":\\\"basellm-newapi\\\"}]}\\n')"],
      timeoutMs: 10_000,
    })

    expect(preview.ok).toBe(true)
    expect(preview.patchFile).toContain('/.internal/update-previews/basellm-')
    expect(preview.changedFiles).toContain('data/providers/302-ai.json')
    expect(preview.diff).toContain('basellm-newapi')
    expect(() => readFileSync(join(dataDir, 'providers', '302-ai.json'), 'utf8')).toThrow()
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
