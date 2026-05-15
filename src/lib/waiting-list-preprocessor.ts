export type RawWaitingListCandidate = {
  source: 'models.dev' | 'basellm'
  tag: string
  name: string
  brand: string
  providers: string[]
  sourceIds: string[]
  reason: string
}

export type PreprocessedWaitingListCandidate = RawWaitingListCandidate & {
  action: 'review' | 'alias' | 'variant' | 'reject'
  targetTag?: string | undefined
  reason: string
}

export type WaitingListPreprocessResult = {
  reviewReady: PreprocessedWaitingListCandidate[]
  aliases: PreprocessedWaitingListCandidate[]
  variants: PreprocessedWaitingListCandidate[]
  rejected: PreprocessedWaitingListCandidate[]
  stats: {
    total: number
    reviewReady: number
    aliases: number
    variants: number
    rejected: number
  }
}

const ALIAS_SUFFIXES = ['latest', 'preview', 'beta', 'alpha', 'experimental']
const VARIANT_SUFFIXES = ['thinking', 'nothinking', 'reasoning', 'fast', 'turbo', 'flash', 'lite', 'mini', 'small', 'large', 'pro', 'max', 'plus', 'chat', 'instruct']
const PROVIDER_ROUTE_PREFIXES = ['accounts-fireworks-models-', 'accounts-fireworks-routers-', 'projects-', 'models-', 'routers-']

export function preprocessWaitingListCandidates(candidates: RawWaitingListCandidate[], canonicalTags: Set<string>): WaitingListPreprocessResult {
  const reviewReady: PreprocessedWaitingListCandidate[] = []
  const aliases: PreprocessedWaitingListCandidate[] = []
  const variants: PreprocessedWaitingListCandidate[] = []
  const rejected: PreprocessedWaitingListCandidate[] = []

  for (const candidate of candidates) {
    const classified = classify(candidate, canonicalTags)
    if (classified.action === 'alias') aliases.push(classified)
    else if (classified.action === 'variant') variants.push(classified)
    else if (classified.action === 'reject') rejected.push(classified)
    else reviewReady.push(classified)
  }

  sortCandidates(reviewReady)
  sortCandidates(aliases)
  sortCandidates(variants)
  sortCandidates(rejected)

  return {
    reviewReady,
    aliases,
    variants,
    rejected,
    stats: {
      total: candidates.length,
      reviewReady: reviewReady.length,
      aliases: aliases.length,
      variants: variants.length,
      rejected: rejected.length,
    },
  }
}

function classify(candidate: RawWaitingListCandidate, canonicalTags: Set<string>): PreprocessedWaitingListCandidate {
  const providerRoute = stripProviderRoute(candidate.tag)
  if (providerRoute !== null && canonicalTags.has(providerRoute)) {
    return { ...candidate, action: 'reject', targetTag: providerRoute, reason: `provider route/wrapper for existing canonical ${providerRoute}` }
  }

  const aliasTarget = stripKnownSuffix(candidate.tag, ALIAS_SUFFIXES)
  const normalizedAliasTarget = aliasTarget?.replace(/^chatgpt-/, 'gpt-') ?? null
  if (normalizedAliasTarget !== null && canonicalTags.has(normalizedAliasTarget)) {
    return { ...candidate, action: 'alias', targetTag: normalizedAliasTarget, reason: `latest/preview floating alias marker for existing canonical ${normalizedAliasTarget}` }
  }

  const variantTarget = longestCanonicalPrefix(candidate.tag, canonicalTags)
  if (variantTarget !== null && variantTarget !== candidate.tag) {
    const suffix = candidate.tag.slice(variantTarget.length + 1)
    if (suffixContainsMarker(suffix, VARIANT_SUFFIXES) || /\b\d+b\b/.test(suffix)) {
      return { ...candidate, action: 'variant', targetTag: variantTarget, reason: `variant marker '${suffix}' for existing canonical ${variantTarget}` }
    }
  }

  const directVariant = stripKnownSuffix(candidate.tag, VARIANT_SUFFIXES)
  if (directVariant !== null && canonicalTags.has(directVariant)) {
    return { ...candidate, action: 'variant', targetTag: directVariant, reason: `variant marker for existing canonical ${directVariant}` }
  }

  return { ...candidate, action: 'review', reason: candidate.reason }
}

function stripProviderRoute(tag: string): string | null {
  for (const prefix of PROVIDER_ROUTE_PREFIXES) {
    if (tag.startsWith(prefix)) return tag.slice(prefix.length)
  }
  return null
}

function stripKnownSuffix(tag: string, suffixes: string[]): string | null {
  for (const suffix of suffixes) {
    const marker = `-${suffix}`
    if (tag.endsWith(marker)) return tag.slice(0, -marker.length)
  }
  return null
}

function longestCanonicalPrefix(tag: string, canonicalTags: Set<string>): string | null {
  let best: string | null = null
  for (const canonicalTag of canonicalTags) {
    if (!tag.startsWith(`${canonicalTag}-`)) continue
    if (best === null || canonicalTag.length > best.length) best = canonicalTag
  }
  return best
}

function suffixContainsMarker(suffix: string, markers: string[]): boolean {
  return suffix.split('-').some((part) => markers.includes(part))
}

function sortCandidates(candidates: PreprocessedWaitingListCandidate[]): void {
  candidates.sort((a, b) => a.source.localeCompare(b.source) || a.brand.localeCompare(b.brand) || a.tag.localeCompare(b.tag))
}
