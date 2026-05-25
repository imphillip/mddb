import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')

function runMerge({ bailianModels, seedModels = [] }) {
  const root = mkdtempSync(join(tmpdir(), 'mddb-bailian-merge-'))
  mkdirSync(join(root, '.internal', 'sources'), { recursive: true })
  mkdirSync(join(root, 'data'), { recursive: true })
  writeFileSync(join(root, '.internal', 'sources', 'bailian-model-market.json'), JSON.stringify({
    source: 'bailian_model_market',
    last_batch_observation: { observed_at: '2026-05-25T00:00:00Z' },
    models: bailianModels,
  }, null, 2))
  writeFileSync(join(root, 'data', 'models.json'), JSON.stringify({ models: seedModels }, null, 2))

  execFileSync(process.execPath, [join(ROOT, 'scripts', 'merge-bailian-models.mjs'), '--apply'], { cwd: root })

  return JSON.parse(readFileSync(join(root, 'data', 'models.json'), 'utf8')).models
}

function bailianRow(id, name, provider = 'qwen', overrides = {}) {
  return {
    model_id: id,
    model_code: id,
    name,
    provider,
    source_url: `https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/detail/${id}?serviceSite=asia-pacific-china`,
    api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    pricing_currency: 'CNY',
    pricing: [],
    candidate_model_fact: {
      id,
      model: name,
      author: provider,
      sources: [{ source: 'bailian_model_market', source_id: id, observed_at: '2026-05-25T00:00:00Z' }],
      other_parameters: {
        request_modality: ['Text'],
        response_modality: ['Text'],
      },
    },
    ...overrides,
  }
}

function klingRow(id, name, prices = []) {
  return {
    model_id: `kling/${id}`,
    model_code: `kling/${id}`,
    name,
    provider: 'kling',
    source_url: `https://bailian.console.aliyun.com/cn-beijing/?tab=model#/model-market/detail/kling/${id}?serviceSite=asia-pacific-china`,
    api_base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    pricing_currency: 'CNY',
    pricing: prices,
    list_observed: id === 'kling-v3-video-generation',
    candidate_model_fact: {
      id: `kling/${id}`,
      model: name,
      author: 'kling',
      sources: [{ source: 'bailian_model_market', source_id: `kling/${id}`, observed_at: '2026-05-25T00:00:00Z' }],
      other_parameters: {
        request_modality: ['Image', 'Text'],
        response_modality: ['Video'],
      },
    },
  }
}

describe('merge-bailian-models', () => {
  it('keeps only Bailian listing-visible Kling as a canonical model and maps per-second video prices', () => {
    const models = runMerge({
      bailianModels: [
        klingRow('kling-v3-video-generation', 'Kling Video 3.0', [
          { price: '0.9', priceName: '视频生成（720P）', priceUnit: '每秒', type: 'video_ratio_720p', currency: 'CNY' },
          { price: '1.2', priceName: '视频生成（1080P）', priceUnit: '每秒', type: 'video_ratio_1080p', currency: 'CNY' },
          { price: '0.6', priceName: '视频生成（720P 无声）', priceUnit: '每秒', type: '720P_no_audio', currency: 'CNY' },
        ]),
        klingRow('kling-v3-omni-video-generation', 'Kling Video 3.0 Omni', [
          { price: '0.9', priceName: '视频生成（720P 无参考视频）', priceUnit: '每秒', type: '720P_no_reference_video', currency: 'CNY' },
        ]),
        klingRow('kling-v3-image-generation', 'Kling Image 3.0', [
          { price: '0.2', priceName: '图片生成（1K）', priceUnit: '每张', type: 'image_type_1k', currency: 'CNY' },
        ]),
      ],
    })

    expect(models.map((model) => model.id)).toEqual(['kling-v3-video-generation'])
    const kling = models[0]
    expect(kling.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'bailian_model_market', source_id: 'kling/kling-v3-video-generation' }),
    ]))
    expect(kling.prices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        currency: 'CNY',
        unit_prices: { video: { amount: 0.9, unit: 'per_video_second' } },
        conditions: expect.objectContaining({ label: '视频生成（720P）', bailian_type: 'video_ratio_720p' }),
        endpoint: expect.objectContaining({ provider_id: 'alibaba-bailian-cn', api_model_id: 'kling/kling-v3-video-generation' }),
      }),
      expect.objectContaining({
        currency: 'CNY',
        unit_prices: { video: { amount: 1.2, unit: 'per_video_second' } },
        conditions: expect.objectContaining({ label: '视频生成（1080P）', bailian_type: 'video_ratio_1080p' }),
      }),
      expect.objectContaining({
        currency: 'CNY',
        unit_prices: { '720p_no_audio-720p': { amount: 0.6, unit: 'per_video_second' } },
        conditions: expect.objectContaining({ label: '视频生成（720P 无声）', bailian_type: '720P_no_audio' }),
      }),
    ]))
    expect(kling.prices).toHaveLength(3)
  })

  it('replaces older Bailian price rows for the same condition when price keys become more specific', () => {
    const models = runMerge({
      seedModels: [{
        id: 'kling-v3-video-generation',
        model: 'Kling Video 3.0',
        name: 'Kling Video 3.0',
        author: 'kling',
        author_id: 'kling',
        sources: [],
        prices: [{
          source: 'bailian_model_market',
          source_id: 'kling/kling-v3-video-generation',
          currency: 'CNY',
          unit_prices: { '720p_no_audio': { amount: 0.6, unit: 'per_second' } },
          conditions: { label: '视频生成（720P 无声）', bailian_type: '720P_no_audio' },
          endpoint: { provider_id: 'alibaba-bailian-cn', provider_name: 'Alibaba Cloud Bailian (China)', api_model_id: 'kling/kling-v3-video-generation' },
        }],
      }],
      bailianModels: [
        klingRow('kling-v3-video-generation', 'Kling Video 3.0', [
          { price: '0.6', priceName: '视频生成（720P 无声）', priceUnit: '每秒', type: '720P_no_audio', currency: 'CNY' },
        ]),
      ],
    })

    expect(models[0].prices).toEqual([
      expect.objectContaining({
        unit_prices: { '720p_no_audio-720p': { amount: 0.6, unit: 'per_video_second' } },
        conditions: { label: '视频生成（720P 无声）', bailian_type: '720P_no_audio' },
      }),
    ])
  })

  it('does not create Qwen application endpoints or legacy service wrappers as canonical models', () => {
    const seedModels = ['aitryon-plus', 'facechain-generation', 'paraformer-v2', 'sambert-zhina-v1'].map((id) => ({
      id,
      model: id,
      name: id,
      author: 'qwen',
      author_id: 'qwen',
      sources: [{ source: 'bailian_model_market', source_id: id }],
      prices: [],
    }))
    const models = runMerge({
      seedModels,
      bailianModels: [
        bailianRow('qwen-plus', 'Qwen-Plus'),
        bailianRow('aitryon-plus', 'AI试衣-Plus版'),
        bailianRow('facechain-generation', 'FaceChain人物写真生成'),
        bailianRow('paraformer-v2', 'Paraformer语音识别-v2'),
        bailianRow('sambert-zhina-v1', 'Sambert语音合成-知娜'),
        bailianRow('qwen-plus-latest', 'Qwen-Plus-Latest'),
        bailianRow('qwen3-asr-flash-realtime', 'Qwen3-ASR-Flash-Realtime'),
      ],
    })

    expect(models.map((model) => model.id)).toEqual(['qwen-plus'])
  })
})
