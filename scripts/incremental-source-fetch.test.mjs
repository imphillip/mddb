import { describe, expect, it } from 'vitest'
import {
  bailianApiEnvelopeData,
  buildBailianCatalog,
  extractVolcengineDocFromHtml,
  mergeBailianPayload,
  normalizeBailianModelDetail,
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

  it('unwraps Bailian direct HTTP gateway envelopes and normalizes details', () => {
    const inner = {
      model: 'qwen-plus',
      modelId: 'qwen-plus',
      name: 'Qwen Plus',
      provider: 'qwen',
      prices: [{ type: 'INFERENCE_INPUT', priceName: '输入', price: '0.8', priceUnit: '元/每百万tokens' }],
      multiPrices: [{ rangeName: 'default', rangeStart: 0, rangeEnd: 1000, prices: [{ type: 'INFERENCE_OUTPUT', price: 2 }] }],
      builtInToolMultiPrices: [{ type: 'web_search', name: 'web_search', supportedApi: 'Responses API', prices: [{ type: 'CALL', price: 4 }] }],
      modelInfo: { contextWindow: 131072, maxInputTokens: 129024, maxOutputTokens: 8192 },
    }
    const data = bailianApiEnvelopeData({ code: '200', data: { DataV2: { data: { code: '200', data: inner } } } })
    const detail = normalizeBailianModelDetail(data, { model: 'qwen-plus', serviceSite: 'asia-pacific-china' })

    expect(detail).toMatchObject({
      model_id: 'qwen-plus',
      pricing_currency: 'CNY',
      pricing: [expect.objectContaining({ price: 0.8, unit: '元/每百万tokens' })],
      tiered_pricing: [expect.objectContaining({ range_start_tokens: 0, range_end_tokens: 1000 })],
      tool_pricing: [expect.objectContaining({ name: 'web_search' })],
      limits: expect.objectContaining({ context_window: 131072 }),
    })
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
