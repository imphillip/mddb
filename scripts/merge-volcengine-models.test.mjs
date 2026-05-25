#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'

function runFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mddb-volcengine-merge-test-'))
  fs.mkdirSync(path.join(root, '.internal/sources/volcengine'), { recursive: true })
  fs.mkdirSync(path.join(root, 'data'), { recursive: true })

  fs.writeFileSync(path.join(root, '.internal/sources/volcengine/1330310.json'), JSON.stringify({
    url: 'https://www.volcengine.com/docs/82379/1330310?lang=zh',
    title: '模型列表',
    updated_time: '2026-05-19T12:12:53Z',
    md_content: `# 深度思考能力
|模型 ID (Model ID) |能力支持 |长度限制（token） |限流 |
|---|---|---|---|
|[doubao-seed-2-0-lite-260428](https://console.volcengine.com/ark/region:ark+cn-beijing/model/detail?Id=doubao-seed-2-0-lite) |深度思考<br><br>文本生成<br><br>多模态理解<br><br>工具调用 |上下文窗口: 256k<br><br>最大输入: 224k<br><br>最大回答(默认 4k):128k |最大 RPM: 30000 |
# 视频生成能力
|模型 ID (Model ID) |能力支持 |规格 |限流 |
|---|---|---|---|
|[doubao-seedance-2-0-260128](https://console.volcengine.com/ark/region:ark+cn-beijing/model/detail?Id=doubao-seedance-2-0) |多模态生视频<br><br>文生视频 |分辨率:<br><br>480p, 720p, 1080p<br><br>时长: 4~15 秒 |最大 RPM: 600 |
`,
  }, null, 2))
  fs.writeFileSync(path.join(root, '.internal/sources/volcengine/1544106.json'), JSON.stringify({
    url: 'https://www.volcengine.com/docs/82379/1544106?lang=zh',
    title: '模型价格',
    updated_time: '2026-05-19T12:31:53Z',
    md_content: `# 大语言模型
|模型名称 |条件<br><br>千 token |输入<br><br>元/百万token |缓存存储<br><br>元/百万 token /小时 |缓存输入<br><br>元/百万token |输出<br><br>元/百万token |
|---|---|---|---|---|---|
|doubao\\-seed\\-2.0\\-lite |输入长度 [0, 32] |0.6 |0.017 |0.12 |3.6 |
||输入长度 (32, 128] |0.9 |0.017 |0.18 |5.4 |
# 视频生成模型
|模型 |default: 在线推理 |flex: 离线推理 |
|---|---|---|
|doubao\\-seedance\\-2.0 |46.00 |暂不支持 |
`,
  }, null, 2))
  fs.writeFileSync(path.join(root, 'data/models.json'), JSON.stringify({ models: [{
    id: 'doubao-seed-2-0-lite-260428',
    model: 'Doubao Seed 2.0 Lite 260428',
    name: 'Doubao Seed 2.0 Lite 260428',
    author: 'volcengine',
    author_id: 'volcengine',
    sources: [{ source: 'openrouter', source_id: 'bytedance/doubao-seed-2-0-lite-260428' }],
    prices: [{ source: 'openrouter', source_id: 'bytedance/doubao-seed-2-0-lite-260428', currency: 'USD', unit_prices: { input: { amount: 0.2, unit: 'per_1m_tokens' } } }],
  }] }, null, 2))

  execFileSync(process.execPath, [path.resolve('scripts/merge-volcengine-models.mjs'), '--apply'], { cwd: root, stdio: 'pipe' })
  return JSON.parse(fs.readFileSync(path.join(root, 'data/models.json'), 'utf8')).models
}

describe('merge-volcengine-models', () => {
  it('merges Ark model-list facts and CNY prices into canonical models without duplicate aliases', () => {
    const models = runFixture()
    const lite = models.find((m) => m.id === 'doubao-seed-2-0-lite-260428')
    expect(lite).toBeTruthy()
    expect(lite.sources.some((s) => s.source === 'volcengine_ark' && s.source_id === 'doubao-seed-2-0-lite-260428')).toBe(true)
    expect(lite.prices.some((p) => p.source === 'volcengine_ark' && p.currency === 'CNY' && p.unit_prices.input.amount === 0.6 && p.unit_prices.output.amount === 3.6)).toBe(true)
    expect(lite.context_length).toBe(256000)
    expect(lite.input_modalities).toEqual(['text', 'image'])
    expect(lite.output_modalities).toEqual(['text'])
    expect(models.filter((m) => m.id === 'doubao-seed-2-0-lite-260428')).toHaveLength(1)
    const video = models.find((m) => m.id === 'doubao-seedance-2-0-260128')
    expect(video).toBeTruthy()
    expect(video.author).toBe('volcengine')
    expect(video.input_modalities).toEqual(['text', 'image', 'video'])
    expect(video.output_modalities).toEqual(['video'])
    expect(video.prices.some((p) => p.source === 'volcengine_ark' && p.currency === 'CNY' && p.unit_prices.video?.amount === 46 && p.unit_prices.video.unit === 'per_1m_tokens')).toBe(true)
    expect(JSON.stringify(models)).not.toContain('pricing_currency')
  })
})
