import { describe, expect, it } from 'vitest'
import { foldBrandAlias, foldSnapshotId } from './primitives.js'

describe('foldBrandAlias', () => {
  it('folds deepseek-chat-v<ver> to deepseek-v<ver> (OpenRouter brand token)', () => {
    expect(foldBrandAlias('deepseek-chat-v3-0324')).toBe('deepseek-v3-0324')
    expect(foldBrandAlias('deepseek-chat-v3.1')).toBe('deepseek-v3.1')
  })
  it('leaves the bare deepseek-chat moving pointer untouched', () => {
    expect(foldBrandAlias('deepseek-chat')).toBe('deepseek-chat')
    expect(foldBrandAlias('deepseek-v3-0324')).toBe('deepseek-v3-0324')
  })
})

describe('foldSnapshotId', () => {
  it('folds the three standard snapshot date suffixes to the base id', () => {
    expect(foldSnapshotId('doubao-seed-2-0-lite-260428')).toBe('doubao-seed-2-0-lite') // -YYMMDD
    expect(foldSnapshotId('claude-3-5-haiku-20241022')).toBe('claude-3-5-haiku') // -YYYYMMDD
    expect(foldSnapshotId('gpt-4o-2024-08-06')).toBe('gpt-4o') // -YYYY-MM-DD
    expect(foldSnapshotId('qwen-plus-2025-04-28')).toBe('qwen-plus')
  })

  it('leaves non-date numeric suffixes untouched', () => {
    expect(foldSnapshotId('doubao-1-5-pro-32k')).toBe('doubao-1-5-pro-32k') // 32k is not a date
    expect(foldSnapshotId('llama-3-70b')).toBe('llama-3-70b')
    expect(foldSnapshotId('gpt-4o')).toBe('gpt-4o')
    expect(foldSnapshotId('model-123456')).toBe('model-123456') // 12=YY but 34 is not a month
    expect(foldSnapshotId('model-991399')).toBe('model-991399') // invalid month 13
  })
})
