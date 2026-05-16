import { readFileSync, writeFileSync } from 'node:fs'

const source = 'https://open.er-api.com/v6/latest/USD'
const outputPath = process.argv[2] ?? 'data/exchange-rate-usd-cny.json'

const response = await fetch(source)
if (!response.ok) {
  throw new Error(`Failed to fetch exchange rate: ${response.status} ${response.statusText}`)
}
const payload = await response.json()
const rawRate = Number(payload?.rates?.CNY)
if (!Number.isFinite(rawRate) || rawRate <= 0) {
  throw new Error('Exchange rate response does not include a valid USD/CNY rate')
}
const updatedAt = typeof payload?.time_last_update_utc === 'string'
  ? new Date(payload.time_last_update_utc).toISOString()
  : new Date().toISOString()
const record = {
  base: 'USD',
  quote: 'CNY',
  rate: Math.round(rawRate * 10) / 10,
  rawRate,
  source,
  provider: payload?.provider ?? 'https://www.exchangerate-api.com',
  updatedAt,
}
writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`)
console.log(JSON.stringify(record))
