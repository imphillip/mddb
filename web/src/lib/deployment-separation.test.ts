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

  it('builds the production site from checked-in data provider/model data by default', () => {
    const buildScript = readProjectFile('web/src/scripts/build-site.ts')
    const adapter = readProjectFile('web/src/lib/registry-graph.ts')
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(buildScript).toContain('buildRegistryGraphFromFiles')
    expect(buildScript).toContain('buildDataQualityReport')
    expect(buildScript).toContain("'graph/data-quality.json'")
    expect(buildScript).toContain("'favicon.svg'")
    expect(buildScript).toContain("'web', 'src', 'assets', 'favicon.svg'")
    expect(adapter).toContain("'data', 'models.json'")
    expect(adapter).toContain("'data', 'providers'")
    expect(adapter).not.toContain("'data', 'registry'")
    expect(buildScript).not.toContain('MDDB_OPENROUTER_SOURCE')
    expect(packageJson.scripts?.['data:openrouter']).toBe('node scripts/fetch-openrouter-models.mjs')
  })

  it('keeps transient news exports out of public data and omits frontend currency conversion', () => {
    const buildScript = readProjectFile('web/src/scripts/build-site.ts')
    const renderer = readProjectFile('web/src/lib/openrouter-raw-renderer.ts')
    const gitignore = readProjectFile('.gitignore')

    expect(gitignore).toContain('data/model-news-tagged.json')
    expect(() => readProjectFile('data/model-news-tagged.json')).toThrow()
    expect(buildScript).not.toContain('attachCurrency')
    expect(renderer).not.toContain('data-currency-toggle')
    expect(renderer).not.toContain('data-usd=')
    expect(renderer).not.toContain('data-cny=')
  })

  it('keeps the public README compact and focused on models.json', () => {
    const readme = readProjectFile('README.md')

    expect(readme).toContain('data/models.json')
    expect(readme).toContain('raw.githubusercontent.com/imphillip/mddb/main/data/models.json')
    expect(readme).toContain('前端只保留两类页面')
    expect(readme).toContain('scripts/')
    expect(readme).toContain('OpenRouter')
    expect(readme).toContain('LiteLLM')
    expect(readme).toContain('火山方舟')
    expect(readme).not.toContain('BaseLLM / NewAPI')
    expect(readme).not.toContain('AIHOT')
    expect(readme).not.toContain('项目的核心不是前端站点')
    expect(readme).not.toContain('## 数据质量与 refresh gate')
    expect(readme).not.toContain('## 公开贡献流程')
    expect(readme).not.toContain('data/registry')
  })

  it('keeps implementation plans private while publishing only schema docs', () => {
    const publicDocs = readProjectFile('docs/mddb-schema-v1.md')
    const readme = readProjectFile('README.md')
    const gitignore = readProjectFile('.gitignore')

    expect(publicDocs).toContain('data/schema/models.schema.json')
    expect(publicDocs).toContain('data/schema/provider.schema.json')
    expect(readme).toContain('data/models.json')
    expect(readme).toContain('data/schema/models.schema.json')
    expect(gitignore).toContain('.internal/')
    expect(() => readProjectFile('docs/mddb-wiki-registry-refactor-plan.md')).toThrow()
  })

  it('documents deploy commands that publish built assets to an external runtime directory', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as { scripts?: Record<string, string> }

    expect(packageJson.scripts?.deploy).toBe('bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['deploy:dry-run']).toBe('DRY_RUN=1 bash scripts/deploy-static-site.sh')
    expect(packageJson.scripts?.['serve:update']).toBe('node dist/scripts/update-admin-server.js')
  })

  it('keeps private maintainer notes and generated outputs out of public source', () => {
    const gitignore = readProjectFile('.gitignore')

    expect(gitignore).toContain('.internal/')
    expect(() => readProjectFile('.githooks/post-commit')).toThrow()
    expect(() => readProjectFile('.hermes/plans/2026-05-23-unified-models-open-source-refactor.md')).toThrow()
  })

  it('ships a deploy script with safe defaults for the nginx runtime root and restarts the update admin service', () => {
    const script = readProjectFile('scripts/deploy-static-site.sh')

    expect(script).toContain('WORKSPACE_DIR')
    expect(script).toContain('PUBLIC_DIR')
    expect(script).toContain('RUNTIME_DIR=${RUNTIME_DIR:-/srv/models.mddb.dev/www}')
    expect(script).toContain('rsync')
    expect(script).toContain('npm run build')
    expect(script).toContain('mddb-update-admin.service')
    expect(script).toContain('systemctl --user restart')
  })

  it('deploys writable runtime directories without requiring interactive sudo', () => {
    const script = readProjectFile('scripts/deploy-static-site.sh')

    expect(script).toContain('run_with_optional_sudo')
    expect(script).toContain('[[ -w "${target}" ]]')
    expect(script).toContain('sudo -n')
    expect(script).toContain('nginx reload skipped')
  })
})
