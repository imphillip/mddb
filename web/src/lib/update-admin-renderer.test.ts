import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { renderUpdateAdminPage } from './update-admin-renderer.js'

describe('renderUpdateAdminPage', () => {
  it('renders an internal password-gated data sync console without embedding secrets', () => {
    const html = renderUpdateAdminPage()

    expect(html).toContain('<title>数据同步 · mddb.dev</title>')
    expect(html).toContain('内部数据同步')
    expect(html).toContain('type="password"')
    expect(html).toContain('管理员密码')
    expect(html).not.toContain('管理员工具：先输入密码')
    expect(html).not.toContain('页面不嵌入任何密钥')
    expect(html).toContain('OpenRouter')
    expect(html).toContain('models.dev')
    expect(html).toContain('BaseLLM')
    expect(html).toContain('LiteLLM')
    expect(html).toContain('data-source-id="openrouter"')
    expect(html).toContain('data-enabled="true"')
    expect(html).toContain('data-enabled="false"')
    expect(html).toContain('预览 diff')
    expect(html).toContain('确认写入全部变更')
    expect(html).toContain('放弃本次预览')
    expect(html).toContain('/api/update/openrouter/preview')
    expect(html).toContain('/api/update/openrouter/apply')
    expect(html).toContain('核心：models.json')
    expect(html).toContain('核心：自研/作者 Provider')
    expect(html).toContain('一般：渠道/端点 Provider')
    expect(html).toContain('按文件查看')
    expect(html).toContain('inlineDiff')
    expect(html).toContain('activeDiffButton')
    expect(html).toContain('aria-expanded')
    expect(html).toContain('insertAdjacentHTML')
    expect(html).toContain('String.fromCharCode(10)')
    expect(html).not.toContain('严格：')
    expect(html).not.toContain('需严格确认')
    expect(html).toContain('renderDiffSummary')
    expect(html).not.toContain('OPENROUTER_API_KEY')
    expect(html).not.toContain('UPDATE_ADMIN_PASSWORD')
    expect(html).not.toContain('.env.local')
  })

  it('embeds syntactically valid client JavaScript', () => {
    const html = renderUpdateAdminPage()
    const script = html.match(/<script>([\s\S]*)<\/script>/u)?.[1]
    expect(script).toBeTruthy()
    const scriptPath = join(tmpdir(), `mddb-update-admin-${process.pid}.js`)
    writeFileSync(scriptPath, script ?? '')
    expect(() => execFileSync(process.execPath, ['--check', scriptPath], { stdio: 'pipe' })).not.toThrow()
  })
})
