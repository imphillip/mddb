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

  it('builds the production site from checked-in data/registry provider/model data by default', () => {
    const buildScript = readProjectFile('web/src/scripts/build-site.ts')
    const adapter = readProjectFile('web/src/lib/registry-graph.ts')
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(buildScript).toContain('buildRegistryGraphFromFiles')
    expect(buildScript).toContain('buildDataQualityReport')
    expect(buildScript).toContain("'graph/data-quality.json'")
    expect(adapter).toContain("'data', 'registry', 'models.json'")
    expect(adapter).toContain("'data', 'registry', 'providers'")
    expect(buildScript).not.toContain('MDDB_OPENROUTER_SOURCE')
    expect(packageJson.scripts?.['data:openrouter']).toBe('node scripts/fetch-openrouter-models.mjs')
  })

  it('keeps transient news exports out of public data while preserving exchange-rate support', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }
    const buildScript = readProjectFile('web/src/scripts/build-site.ts')
    const gitignore = readProjectFile('.gitignore')

    expect(gitignore).toContain('data/model-news-tagged.json')
    expect(() => readProjectFile('data/model-news-tagged.json')).toThrow()
    expect(packageJson.scripts?.['data:fx']).toBe('node scripts/fetch-exchange-rate.mjs')
    expect(buildScript).toContain("'.internal', 'source-data', 'exchange-rate-usd-cny.raw.json'")
    expect(buildScript).toContain('attachCurrency')
  })

  it('documents deploy commands that publish built assets to an external runtime directory', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(packageJson.scripts?.deploy).toBe('bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['deploy:dry-run']).toBe('DRY_RUN=1 bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['hooks:install']).toBe('git config core.hooksPath .internal/git-hooks')
  })

  it('keeps deploy prompt hooks local-only instead of publishing them as public source', () => {
    const gitignore = readProjectFile('.gitignore')
    const hook = readProjectFile('.internal/git-hooks/post-commit')

    expect(gitignore).toContain('.internal/')
    expect(() => readProjectFile('.githooks/post-commit')).toThrow()
    expect(hook).toContain('npm run deploy')
    expect(hook).toContain('MDDB_SKIP_POST_COMMIT_DEPLOY')
    expect(hook).toContain('post-commit')
  })

  it('ships a deploy script with safe defaults for the nginx runtime root', () => {
    const script = readProjectFile('scripts/deploy-static-site.sh')

    expect(script).toContain('WORKSPACE_DIR')
    expect(script).toContain('PUBLIC_DIR')
    expect(script).toContain('RUNTIME_DIR=${RUNTIME_DIR:-/srv/models.mddb.dev/www}')
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
