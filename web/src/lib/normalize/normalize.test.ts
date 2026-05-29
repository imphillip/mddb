import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { openRouterFragment, type OpenRouterModel } from './adapters/openrouter.js'
import { bailianFragment, type BailianModel } from './adapters/bailian.js'
import { mergeGroup } from './merge.js'
import type { ModelEntry, Offer } from './schema.js'

const orRaw = JSON.parse(
  readFileSync(new URL('./__fixtures__/openrouter-qwen3.6-max-preview.json', import.meta.url), 'utf8'),
) as OpenRouterModel
const bailianRaw = JSON.parse(
  readFileSync(new URL('./__fixtures__/bailian-qwen3.6-max-preview.json', import.meta.url), 'utf8'),
) as BailianModel

function buildGolden(): ModelEntry {
  const orFragment = openRouterFragment(orRaw, { observedAt: '2026-05-19T22:11:55.841Z' })
  const bailianFrag = bailianFragment(bailianRaw, { observedAt: '2026-05-24T18:19:06Z' })
  if (!bailianFrag) throw new Error('bailian fragment unexpectedly dropped')
  const entry = mergeGroup([orFragment, bailianFrag], { now: '2026-05-24T18:19:06Z' })
  if (!entry) throw new Error('merge produced no entry')
  return entry
}

describe('golden case: qwen3.6-max-preview (OpenRouter + Bailian)', () => {
  const entry = buildGolden()

  it('derives canonical identity, aliases, and author', () => {
    expect(entry.id).toBe('qwen3.6-max-preview')
    expect(entry.author).toBe('qwen')
    expect(entry.author_id).toBe('qwen')
    expect(entry.alias_id).toEqual([
      'qwen/qwen3.6-max-preview',
      'qwen/qwen3.6-max-preview-20260420',
    ])
    // Without an override the model name is the upstream "Qwen3.6 Max Preview", so the only
    // display alias equals the model name and is dropped (model/alias never duplicate).
    expect(entry.alias).toBeUndefined()
  })

  it('merges scalar facts across both sources', () => {
    expect(entry.input_modalities).toEqual(['text'])
    expect(entry.output_modalities).toEqual(['text'])
    expect(entry.reasoning).toBe(true)
    expect(entry.tool_calling).toBe(true)
    expect(entry.context_length).toBe(262144)
    expect(entry.max_output_tokens).toBe(65536)
    expect(entry.release_timestamp).toBe(1777260242)
  })

  it('field-level fill: max_input_tokens comes from Bailian (OpenRouter has none)', () => {
    expect(orRaw.top_provider).not.toHaveProperty('max_input_tokens')
    expect(entry.max_input_tokens).toBe(245760)
  })

  it('captures the full Bailian CNY offer — the data the old script dropped', () => {
    const bailianOffer = entry.offers.find((o) => o.source === 'bailian')
    const expected: Offer = {
      source: 'bailian',
      url: bailianRaw.source_url as string,
      observed_at: '2026-05-24T18:19:06Z',
      currency: 'CNY',
      other_params: { RPM: 600, TPM: 1000000 },
      prices: [
        {
          conditions: [{ type: 'input_token', label: '输入<=128k', lte: 131072 }],
          input: { amount: 9, unit: 'per_1m_tokens' },
          output: { amount: 54, unit: 'per_1m_tokens' },
          cache_write: { amount: 11.25, unit: 'per_1m_tokens' },
          cache_read: { amount: 0.9, unit: 'per_1m_tokens' },
        },
        {
          conditions: [{ type: 'input_token', label: '128k<输入<=256k', gt: 131072, lte: 262144 }],
          input: { amount: 15, unit: 'per_1m_tokens' },
          output: { amount: 90, unit: 'per_1m_tokens' },
          cache_write: { amount: 18.75, unit: 'per_1m_tokens' },
          cache_read: { amount: 1.5, unit: 'per_1m_tokens' },
        },
      ],
    }
    expect(bailianOffer).toEqual(expected)
  })

  it('captures the OpenRouter USD offer (incl. cache_write the sample omitted)', () => {
    const orOffer = entry.offers.find((o) => o.source === 'openrouter')
    expect(orOffer?.currency).toBe('USD')
    expect(entry.endpoints).toEqual(['chat']) // model-level union (OpenRouter + Bailian both chat)
    expect(orOffer?.prices[0]?.input).toEqual({ amount: 1.04, unit: 'per_1m_tokens' })
    expect(orOffer?.prices[0]?.output).toEqual({ amount: 6.24, unit: 'per_1m_tokens' })
    expect(orOffer?.prices[0]?.cache_write).toEqual({ amount: 1.3, unit: 'per_1m_tokens' })
  })

  it('orders offers OpenRouter-first and buckets unclassified fields', () => {
    expect(entry.offers.map((o) => o.source)).toEqual(['openrouter', 'bailian'])
    expect(entry.other_parameters).toMatchObject({
      tokenizer: 'Qwen',
      max_reasoning_tokens: 131072,
    })
  })

  // Known, intentional deltas vs the hand-curated model_item.json (resolved later):
  //  - model name: auto = upstream "Qwen3.6 Max Preview"; curated "Qwen 3.6 Max" comes via overrides (phase 3)
  //  - knowledge_cutoff: null here; filled by models.dev whitelist (phase 2), overridable (phase 3)
  it('leaves curated-only fields for later phases', () => {
    expect(entry.model).toBe('Qwen3.6 Max Preview')
    expect(entry.knowledge_cutoff).toBeNull()
  })
})
