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
    expect(html).toContain('确认写入')
    expect(html).toContain('/api/update/openrouter/preview')
    expect(html).toContain('/api/update/openrouter/apply')
    expect(html).not.toContain('OPENROUTER_API_KEY')
    expect(html).not.toContain('UPDATE_ADMIN_PASSWORD')
    expect(html).not.toContain('.env.local')
  })
})
