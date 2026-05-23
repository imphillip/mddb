export function normalizeModelPrice(price) {
  const normalized = {}
  if (price.source !== undefined) normalized.source = String(price.source)
  if (price.source_id !== undefined) normalized.source_id = String(price.source_id)
  if (price.source_url !== undefined) normalized.source_url = String(price.source_url)
  if (price.currency !== undefined) normalized.currency = String(price.currency).toUpperCase()

  const unitPrices = {}
  const rawUnitPrices = isRecord(price.unit_prices) ? price.unit_prices : {}
  for (const [key, value] of Object.entries(rawUnitPrices)) {
    if (!isRecord(value)) continue
    const amount = typeof value.amount === 'number' ? value.amount : Number(value.amount)
    if (!Number.isFinite(amount)) continue
    unitPrices[key] = {
      amount,
      unit: value.unit === undefined ? 'unit' : String(value.unit),
      ...(value.condition ? { condition: String(value.condition) } : {}),
    }
  }
  normalized.unit_prices = unitPrices

  if (isRecord(price.endpoint)) {
    normalized.endpoint = {
      provider_id: String(price.endpoint.provider_id ?? ''),
      provider_name: String(price.endpoint.provider_name ?? ''),
      ...(price.endpoint.api_model_id !== undefined ? { api_model_id: String(price.endpoint.api_model_id) } : {}),
      ...(price.endpoint.base_url !== undefined ? { base_url: String(price.endpoint.base_url) } : {}),
      ...(price.endpoint.docs_url !== undefined ? { docs_url: String(price.endpoint.docs_url) } : {}),
    }
  }

  return normalized
}

export function priceDetailScore(price) {
  const normalized = normalizeModelPrice(price ?? {})
  let score = 0
  for (const value of Object.values(normalized.unit_prices ?? {})) {
    score += 10
    if (value.condition) score += 8
    if (String(value.unit ?? '').length > 0) score += 1
  }
  if (normalized.endpoint?.provider_id) score += 2
  if (normalized.endpoint?.api_model_id) score += 1
  if (normalized.source_url) score += 1
  return score
}

export function isCommercialPrice(price) {
  const normalized = normalizeModelPrice(price ?? {})
  const sourceId = String(normalized.source_id ?? normalized.endpoint?.api_model_id ?? '').toLowerCase()
  if (sourceId.includes(':free') || sourceId.endsWith('/free')) return false
  const values = Object.values(normalized.unit_prices ?? {})
  if (values.length === 0) return false
  return values.some((value) => typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0)
}

export function selectBestPrice(a, b) {
  const left = normalizeModelPrice(a ?? {})
  const right = normalizeModelPrice(b ?? {})
  const leftCommercial = isCommercialPrice(left)
  const rightCommercial = isCommercialPrice(right)
  if (leftCommercial && !rightCommercial) return left
  if (rightCommercial && !leftCommercial) return right
  if (!leftCommercial && !rightCommercial) return priceDetailScore(right) > priceDetailScore(left) ? right : left
  return priceDetailScore(right) > priceDetailScore(left) ? right : left
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
