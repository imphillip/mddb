import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()

function readProjectFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('deployment separation', () => {
  it('keeps generated site output out of the open-source code repository', () => {
    expect(readProjectFile('.gitignore')).toContain('public/')
  })

  it('builds the production site from checked-in OpenRouter raw provider-graph data by default', () => {
    const buildScript = readProjectFile('src/scripts/build-site.ts')
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(buildScript).toContain("'data', 'openrouter-models.json'")
    expect(buildScript).toContain("'data', 'openrouter-endpoints.json'")
    expect(buildScript).toContain("'data', 'openrouter-sitemap-models.json'")
    expect(buildScript).toContain("'data', 'openrouter-model-pages.json'")
    expect(buildScript).toContain('buildOpenRouterRawGraphFromFiles')
    expect(buildScript).not.toContain('MDDB_OPENROUTER_SOURCE')
    expect(packageJson.scripts?.['data:openrouter']).toBe('node scripts/fetch-openrouter-models.mjs')
  })

  it('documents deploy commands that publish built assets to an external runtime directory', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(packageJson.scripts?.deploy).toBe('bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['deploy:dry-run']).toBe('DRY_RUN=1 bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['hooks:install']).toBe('git config core.hooksPath .githooks')
  })

  it('ships a post-commit hook that triggers the deploy flow without relying on agent memory', () => {
    const hook = readProjectFile('.githooks/post-commit')

    expect(hook).toContain('npm run deploy')
    expect(hook).toContain('MDDB_SKIP_POST_COMMIT_DEPLOY')
    expect(hook).toContain('post-commit')
  })

  it('ships a deploy script with safe defaults for the nginx runtime root', () => {
    const script = readProjectFile('scripts/deploy-static-site.sh')

    expect(script).toContain('WORKSPACE_DIR')
    expect(script).toContain('PUBLIC_DIR')
    expect(script).toContain('RUNTIME_DIR=${RUNTIME_DIR:-/srv/mddb.dev/www}')
    expect(script).toContain('rsync')
    expect(script).toContain('npm run build')
  })

  it('deploys writable runtime directories without requiring interactive sudo', () => {
    const script = readProjectFile('scripts/deploy-static-site.sh')

    expect(script).toContain('run_with_optional_sudo')
    expect(script).toContain('[[ -w "${target}" ]]')
    expect(script).toContain('sudo -n')
    expect(script).toContain('nginx reload skipped')
  })
})
