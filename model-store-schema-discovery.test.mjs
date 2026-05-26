import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const discoveryDoc = readFileSync(new URL('./docs/model-store-schema-discovery.md', import.meta.url), 'utf8')
const referenceItem = JSON.parse(readFileSync('/home/phillip_wu/.hermes/cache/documents/doc_e387eb2ee3f9_model_item.json', 'utf8'))

function hasForbiddenNestedRegistry(value, path = []) {
  if (Array.isArray(value)) return value.some((item, index) => hasForbiddenNestedRegistry(item, [...path, String(index)]))
  if (!value || typeof value !== 'object') return false
  if (Object.prototype.hasOwnProperty.call(value, 'mddb_registry')) return true
  return Object.entries(value).some(([key, child]) => hasForbiddenNestedRegistry(child, [...path, key]))
}

describe('model store schema discovery contract', () => {
  it('treats the user-provided model item as a reference example rather than final schema', () => {
    expect(discoveryDoc).toContain('方向性参考样例，不是唯一标准答案')
    expect(discoveryDoc).toContain('不是最终 schema')
    expect(discoveryDoc).toContain('schema 发现')
    expect(discoveryDoc).toContain('不确定字段必须停下来问用户')
  })

  it('documents raw-source versus final model-store boundaries', () => {
    expect(discoveryDoc).toContain('Fetch / source snapshot')
    expect(discoveryDoc).toContain('Normalize / import')
    expect(discoveryDoc).toContain('Build / validate')
    expect(discoveryDoc).toContain('raw source')
    expect(discoveryDoc).toContain('确定性代码')
  })

  it('keeps the reference example free of nested mddb_registry copies and uses offers for source prices', () => {
    expect(hasForbiddenNestedRegistry(referenceItem)).toBe(false)
    expect(referenceItem).toHaveProperty('offers')
    expect(Array.isArray(referenceItem.offers)).toBe(true)
    expect(referenceItem).not.toHaveProperty('prices')
    expect(referenceItem.offers.every((offer) => Array.isArray(offer.prices))).toBe(true)
  })
})
