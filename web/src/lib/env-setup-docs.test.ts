import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('environment setup docs', () => {
  it('tracks only a safe env template and documents local secret setup', () => {
    const template = readFileSync('.env.example', 'utf8')
    const gitignore = readFileSync('.gitignore', 'utf8')
    const readme = readFileSync('README.md', 'utf8')

    expect(gitignore).toContain('.env.local')
    expect(template).toContain('OPENROUTER_API_KEY=')
    expect(template).toContain('UPDATE_ADMIN_PASSWORD=')
    expect(template).not.toContain('changeme-replace-before-use')
    expect(template).not.toMatch(/sk-or-|Bearer\s+\S+/u)
    expect(readme).toContain('cp .env.example .env.local')
    expect(readme).toContain('OPENROUTER_API_KEY')
    expect(readme).toContain('UPDATE_ADMIN_PASSWORD')
    expect(readme).toContain('/update/')
  })
})
