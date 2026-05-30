import { describe, expect, it } from 'vitest'
import { bailianFragment, type BailianModel } from './bailian.js'

const make = (raw: Partial<BailianModel> & { model_id: string }): BailianModel => raw as BailianModel

describe('bailianFragment: non-token pricing units', () => {
  it('maps TTS 每万字符 to character per_character (price / 10000) and audio.speech', () => {
    const f = bailianFragment(make({
      model_id: 'cosyvoice-v2',
      capabilities: ['TTS'],
      pricing: [{ type: 'cosy_tts_number', price: 2, unit: '每万字符' }],
    }))!
    expect(f.offer?.prices).toEqual([{ character: { amount: 0.0002, unit: 'per_character' } }])
    expect(f.endpoint).toBe('audio.speech')
    expect(f.facts.input_modalities).toEqual(['text'])
    expect(f.facts.output_modalities).toEqual(['audio'])
  })

  it('maps ASR 每秒 to audio_input per_second and audio.transcription', () => {
    const f = bailianFragment(make({
      model_id: 'paraformer-8k-v1',
      capabilities: ['ASR'],
      pricing: [{ type: 'content_duration', price: 0.00008, unit: '每秒' }],
    }))!
    expect(f.offer?.prices).toEqual([{ audio_input: { amount: 0.00008, unit: 'per_second' } }])
    expect(f.endpoint).toBe('audio.transcription')
  })

  it('maps rerank token pricing to input per_1m and the rerank endpoint', () => {
    const f = bailianFragment(make({
      model_id: 'gte-rerank-v2',
      capabilities: ['TR'],
      pricing: [{ type: 'embedding_token', price: 0.8, unit: '每百万tokens' }],
    }))!
    expect(f.offer?.prices).toEqual([{ input: { amount: 0.8, unit: 'per_1m_tokens' } }])
    expect(f.endpoint).toBe('rerank')
  })

  it('maps image 每张 to image_output per_image and the images endpoint', () => {
    const f = bailianFragment(make({
      model_id: 'aitryon',
      capabilities: ['IG'],
      pricing: [{ type: 'image_number', price: 0.3, unit: '每张' }],
    }))!
    expect(f.offer?.prices).toEqual([{ image_output: { amount: 0.3, unit: 'per_image' } }])
    expect(f.endpoint).toBe('images')
  })

  it('converts 每千tokens to per_1m_tokens (x1000)', () => {
    const f = bailianFragment(make({
      model_id: 'x-1k',
      capabilities: ['TG'],
      pricing: [{ type: 'input_token', price: 0.002, unit: '每千tokens' }],
    }))!
    expect(f.offer?.prices[0]?.input).toEqual({ amount: 2, unit: 'per_1m_tokens' })
  })
})

describe('bailianFragment: variant grouping (omni)', () => {
  const f = bailianFragment(make({
    model_id: 'qwen-omni-turbo',
    capabilities: ['OMNI'],
    pricing: [
      { type: 'text_input_token', price: 0.4, unit: '每百万tokens' },
      { type: 'audio_input_token', price: 25, unit: '每百万tokens' },
      { type: 'vision_input_token', price: 1.5, unit: '每百万tokens' },
      { type: 'purein_text_output_token', price: 1.6, unit: '每百万tokens' },
      { type: 'multiin_text_output_token', price: 4.5, unit: '每百万tokens' },
      { type: 'text_input_token_cache', price: 0.08, unit: '每百万tokens' },
      { type: 'audio_input_token_cache', price: 5, unit: '每百万tokens' },
      { type: 'text_input_token_batch', price: 0.2, unit: '每百万tokens' },
    ],
  }))!

  it('routes modality inputs to distinct components in the base tier', () => {
    const base = f.offer!.prices.find((p) => !p.conditions)!
    expect(base.input).toEqual({ amount: 0.4, unit: 'per_1m_tokens' })
    expect(base.audio_input).toEqual({ amount: 25, unit: 'per_1m_tokens' })
    expect(base.image_input).toEqual({ amount: 1.5, unit: 'per_1m_tokens' })
  })

  it('splits input-modality-conditional output into labelled variant tiers', () => {
    const labels = f.offer!.prices.flatMap((p) => p.conditions?.map((c) => c.label) ?? [])
    expect(labels).toContain('输入仅文本')
    expect(labels).toContain('输入含多模态')
    expect(labels).toContain('批量推理')
  })

  it('keeps per-modality cache prices in distinct labelled tiers (no silent collision)', () => {
    const caches = f.offer!.prices.filter((p) => p.cache_read).map((p) => p.cache_read!.amount)
    expect(caches).toEqual(expect.arrayContaining([0.08, 5]))
  })
})

describe('bailianFragment: empties', () => {
  it('drops a null-priced entry rather than recording amount 0', () => {
    const f = bailianFragment(make({
      model_id: 'multimodal-embedding-v1',
      capabilities: ['ME'],
      pricing: [{ type: 'embedding_token', price: null as unknown as number, unit: '每百万tokens' }],
    }))!
    expect(f.offer?.prices).toEqual([]) // no fabricated zero
    expect(f.endpoint).toBe('embeddings') // still classified by capability
  })

  it('drops a model with no price AND no spec facts entirely', () => {
    const f = bailianFragment(make({ model_id: 'mystery-tool', pricing: [] }))
    expect(f).toBeNull()
  })
})
