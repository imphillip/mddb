import { describe, expect, it } from 'vitest'
import {
  buildBailianCatalog,
  extractVolcengineDocFromHtml,
  mergeBailianPayload,
  selectChangedBailianSlugs,
  volcengineContentToMarkdown,
} from './lib/incremental-source-fetch.mjs'

describe('incremental China provider fetch helpers', () => {
  it('selects only new or changed Bailian catalog rows for detail fetching', () => {
    const catalog = buildBailianCatalog([
      { model_id: 'qwen-plus', slug: 'qwen-plus', name: 'Qwen Plus', description: 'old', features: ['文本生成'] },
      { model_id: 'qwen-new', slug: 'qwen-new', name: 'Qwen New', description: 'new', features: ['文本生成'] },
      { model_id: 'qwen-max', slug: 'qwen-max', name: 'Qwen Max', description: 'changed', features: ['深度思考'] },
    ], '2026-05-26T00:00:00.000Z')
    const previousStable = buildBailianCatalog([
      { model_id: 'qwen-plus', slug: 'qwen-plus', name: 'Qwen Plus', description: 'old', features: ['文本生成'] },
      { model_id: 'qwen-max', slug: 'qwen-max', name: 'Qwen Max', description: 'old', features: ['文本生成'] },
    ], '2026-05-25T00:00:00.000Z')

    const changed = selectChangedBailianSlugs(catalog, {
      list_observation: previousStable,
      models: [{ model_id: 'qwen-plus' }, { model_id: 'qwen-max' }],
    })

    expect(changed).toEqual(['qwen-new', 'qwen-max'])
  })

  it('preserves unchanged Bailian details and marks catalog visibility', () => {
    const catalog = buildBailianCatalog([
      { model_id: 'qwen-plus', slug: 'qwen-plus', name: 'Qwen Plus' },
      { model_id: 'qwen-new', slug: 'qwen-new', name: 'Qwen New' },
    ], '2026-05-26T00:00:00.000Z')

    const payload = mergeBailianPayload({
      models: [
        { model_id: 'qwen-plus', pricing: [{ price: 1 }] },
        { model_id: 'qwen-old', pricing: [{ price: 9 }] },
      ],
    }, {
      catalog,
      details: [{ model_id: 'qwen-new', pricing: [{ price: 2 }] }],
      fetchedAt: '2026-05-26T00:00:00.000Z',
      region: 'cn-beijing',
      serviceSite: 'asia-pacific-china',
    })

    expect(payload.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ model_id: 'qwen-plus', pricing: [{ price: 1 }], list_observed: true }),
      expect.objectContaining({ model_id: 'qwen-new', pricing: [{ price: 2 }], list_observed: true }),
      expect.objectContaining({ model_id: 'qwen-old', pricing: [{ price: 9 }], list_observed: false }),
    ]))
  })

  it('extracts Volcengine SSR doc content and converts rich ops to markdown text', () => {
    const content = {
      version: '1.2.57',
      data: {
        0: { ops: [
          { insert: '*', attributes: { lmkr: '1' } },
          { insert: '模型列表\n', attributes: { heading: 'h1' } },
          { insert: 'doubao-seed-2-0\n' },
        ] },
      },
    }
    const html = `<script>window._SSR_DATA = {"context":{"loaderData":{"x":{"curDoc":{"BusinessID":1330310,"LibraryID":82379,"Title":"模型列表","UpdateTime":"2026-05-26T00:00:00Z","Content":${JSON.stringify(JSON.stringify(content))}}}}}}</script>`

    const doc = extractVolcengineDocFromHtml(html, { url: 'https://www.volcengine.com/docs/82379/1330310?lang=zh' })

    expect(doc).toMatchObject({ library_id: 82379, document_id: 1330310, title: '模型列表', updated_time: '2026-05-26T00:00:00.000Z' })
    expect(doc.md_content).toContain('# 模型列表')
    expect(doc.md_content).toContain('doubao-seed-2-0')
    expect(volcengineContentToMarkdown(content)).toContain('# 模型列表')
  })
})
