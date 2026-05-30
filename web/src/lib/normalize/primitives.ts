// Shared normalization primitives (see ../../../../normalizer-spec.md §3).
// NOTE: unlike the legacy model-normalization.ts, canonicalId PRESERVES dots
// ("qwen3.6-max-preview"), matching the new target schema slug rules.

/** Strip a leading "vendor/" route prefix, lowercase, preserve [a-z0-9._-]. */
export function canonicalId(rawId: string): string {
  const withoutVendor = rawId.includes('/') ? rawId.slice(rawId.indexOf('/') + 1) : rawId
  return withoutVendor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^[-.]+|[-.]+$/gu, '')
}

/**
 * Strip a trailing snapshot date suffix to get the base id. Handles the three standard
 * forms; the `-` anchor + month/day validation prevents folding non-date numeric suffixes:
 *   -YYYY-MM-DD  (e.g. -2026-05-20)
 *   -YYYYMMDD    (e.g. -20260520)
 *   -YYMMDD      (e.g. -260520)
 * Returns the id unchanged when no plausible date suffix is present.
 */
const MD = '(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])'
const SNAPSHOT_SUFFIXES = [
  new RegExp(`-(?:19|20)\\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$`, 'u'),
  new RegExp(`-(?:19|20)\\d{2}${MD}$`, 'u'),
  new RegExp(`-\\d{2}${MD}$`, 'u'),
]
export function foldSnapshotId(id: string): string {
  for (const re of SNAPSHOT_SUFFIXES) {
    const folded = id.replace(re, '')
    if (folded !== id) return folded
  }
  return id
}

/** Vendor segment of a route id ("qwen/qwen3.6-max" -> "qwen"); null when unprefixed. */
export function vendorPrefix(rawId: string): string | null {
  if (!rawId.includes('/')) return null
  return rawId.slice(0, rawId.indexOf('/')).trim().toLowerCase() || null
}

/** Cross-source grouping key: aggressive, separator/case-insensitive. */
export function matchKey(id: string): string {
  return canonicalId(id).replace(/[._-]+/gu, '')
}

/** Strip a leading "Vendor: " label and collapse whitespace. */
export function cleanName(rawName: string): string {
  return rawName.replace(/^[^:]{1,40}:\s*/u, '').replace(/\s+/gu, ' ').trim()
}

/** Round away float noise from unit conversions (1.0399999.. -> 1.04). */
export function roundMoney(value: number): number {
  return Math.round(value * 1e8) / 1e8
}

/** USD per-token decimal (string or number) -> amount per 1M tokens. */
export function usdPerTokenTo1m(raw: string | number): number {
  return roundMoney(Number(raw) * 1_000_000)
}

/** ISO/`YYYY-MM`/epoch-seconds -> epoch seconds. */
export function toEpochSeconds(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Math.trunc(value)
  const trimmed = value.trim()
  if (/^\d+$/u.test(trimmed)) return Math.trunc(Number(trimmed))
  const ms = Date.parse(trimmed)
  return Number.isNaN(ms) ? null : Math.trunc(ms / 1000)
}

/** Bailian/Volcengine token-price unit label -> canonical PriceUnit. */
export function cnyUnit(label: string): 'per_1m_tokens' {
  // Currently only "每百万tokens" is observed; assert and normalize.
  if (label.includes('百万')) return 'per_1m_tokens'
  return 'per_1m_tokens'
}

/** Map an OpenAI-compatible base URL to its call shape. */
export function endpointsFromBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null
  if (/compatible-mode|\/v1\b|openai/iu.test(baseUrl)) return 'chat'
  return null
}

// Router/aggregator products that are not real models (mostly OpenRouter meta-routes).
const NON_CANONICAL_SLUGS = new Set([
  'auto',
  'bodybuilder',
  'free',
  'router',
  'model_router',
  'owl-alpha',
  'pareto-code',
])
// Moving/service routes (streaming, transcode, translate) are endpoints, not canonical models.
const NON_CANONICAL_PATTERNS: readonly RegExp[] = [
  /^group-/u,
  /(?:^|[-:_])free$/u,
  /-latest$/u,
  /(?:^|[-/_])router(?:$|[-/_])/u,
  /(?:^|-)realtime(?:$|-)/u,
  /(?:^|-)filetrans(?:$|-)/u,
  /(?:^|-)livetranslate(?:$|-)/u,
]

/** True for ids that must never be a canonical model (router/product/free/latest/service route). */
export function isNonCanonicalId(id: string): boolean {
  if (NON_CANONICAL_SLUGS.has(id)) return true
  return NON_CANONICAL_PATTERNS.some((pattern) => pattern.test(id))
}

/** Dedup strings, preserving first-seen order. */
export function uniq(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

/** Dedup display names ignoring case/separators, keeping the first-seen original. */
export function uniqNames(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.toLowerCase().replace(/[\s._-]+/gu, '')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}
