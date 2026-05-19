export type ModelAliasType = 'official' | 'snapshot' | 'provider_route' | 'third_party' | 'colloquial'

export type ModelAliasRecord = {
  alias: string
  modelTag: string
  aliasType: ModelAliasType
  source: string
  confidence: number
}

export type NormalizeModelNameResult = {
  input: string
  normalizedInput: string
  matchedTag: string | null
  confidence: number
  matchType: 'exact_tag' | 'exact_alias' | 'snapshot_alias' | 'heuristic' | 'none'
  reason: string
}

export type NormalizeModelNameOptions = {
  tags: string[]
  aliases?: ModelAliasRecord[]
}

export function normalizeModelTagCandidate(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function stripSnapshotSuffix(normalizedName: string): { tagCandidate: string; snapshot: string | null } {
  const dashedDateMatch = normalizedName.match(/^(.*)-((?:19|20)\d{2}-\d{2}-\d{2})$/)
  if (dashedDateMatch) {
    return { tagCandidate: dashedDateMatch[1]!, snapshot: dashedDateMatch[2]! }
  }

  const compactDateMatch = normalizedName.match(/^(.*)-((?:19|20)\d{6})$/)
  if (compactDateMatch) {
    return { tagCandidate: compactDateMatch[1]!, snapshot: compactDateMatch[2]! }
  }

  const semanticSnapshotMatch = normalizedName.match(/^(.*)-(v\d+(?:-\d+)*)$/)
  if (semanticSnapshotMatch) {
    return { tagCandidate: semanticSnapshotMatch[1]!, snapshot: semanticSnapshotMatch[2]! }
  }

  return { tagCandidate: normalizedName, snapshot: null }
}

export function normalizeModelName(input: string, options: NormalizeModelNameOptions): NormalizeModelNameResult {
  const normalizedInput = normalizeModelTagCandidate(input)
  const tagSet = new Set(options.tags.map(normalizeModelTagCandidate))

  if (tagSet.has(normalizedInput)) {
    return {
      input,
      normalizedInput,
      matchedTag: normalizedInput,
      confidence: 1,
      matchType: 'exact_tag',
      reason: 'Input normalizes to an existing canonical model tag.',
    }
  }

  const alias = options.aliases
    ?.map((record) => ({ ...record, normalizedAlias: normalizeModelTagCandidate(record.alias) }))
    .find((record) => record.normalizedAlias === normalizedInput)

  if (alias) {
    return {
      input,
      normalizedInput,
      matchedTag: alias.modelTag,
      confidence: alias.confidence,
      matchType: alias.aliasType === 'snapshot' ? 'snapshot_alias' : 'exact_alias',
      reason: `Input matched ${alias.aliasType} alias from ${alias.source}.`,
    }
  }

  const stripped = stripSnapshotSuffix(normalizedInput)
  if (stripped.snapshot && tagSet.has(stripped.tagCandidate)) {
    return {
      input,
      normalizedInput,
      matchedTag: stripped.tagCandidate,
      confidence: 0.85,
      matchType: 'heuristic',
      reason: `Input matched canonical tag after stripping snapshot suffix ${stripped.snapshot}.`,
    }
  }

  return {
    input,
    normalizedInput,
    matchedTag: null,
    confidence: 0,
    matchType: 'none',
    reason: 'No canonical tag, alias, snapshot alias, or deterministic heuristic matched.',
  }
}
