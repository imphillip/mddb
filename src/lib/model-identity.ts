import { normalizeModelTagCandidate, stripSnapshotSuffix } from './model-normalization.js'

export type ModelsDevIdentityInput = {
  id: string
  name: string
  providerId: string
}

export type IdentityAliasObservation = {
  alias: string
  normalizedAlias: string
  aliasType: 'official' | 'snapshot' | 'provider_route' | 'third_party'
  source: 'models.dev'
  confidence: number
}

export type IdentitySnapshotObservation = {
  snapshotId: string
  snapshotName: string
  marker: string
}

export type IdentityVariantHint = {
  kind: 'thinking' | 'nothinking' | 'fast' | 'compact' | 'batch' | 'priority'
  marker: string
}

export type IdentityDeploymentHint = {
  kind: 'provider_route' | 'region' | 'wrapper' | 'suffix'
  value: string
}

export type ModelIdentityResolution = {
  canonicalTag: string
  displayNameCandidate: string
  versionId: string
  aliases: IdentityAliasObservation[]
  snapshot: IdentitySnapshotObservation | null
  variant: IdentityVariantHint | null
  deploymentHints: IdentityDeploymentHint[]
  sourceRecord: {
    source: 'models.dev'
    rawId: string
    rawName: string
    providerId: string
    normalizedId: string
    lossyFields: Record<string, unknown>
  }
}

const PROVIDER_PREFIXES = ['openai', 'anthropic', 'google', 'meta', 'mistralai', 'mistral', 'deepseek', 'xai', 'qwen', 'alibaba', 'zai', 'z-ai']
const REGION_PREFIXES = ['global', 'us', 'eu', 'jp', 'au', 'ca', 'uk']
const DEPLOYMENT_WRAPPERS = ['databricks', 'azure', 'bedrock', 'vertex', 'openrouter']
const DEPLOYMENT_SUFFIXES = ['default']
const ANTHROPIC_CLAUDE_FAMILIES = ['opus', 'sonnet', 'haiku'] as const
const VARIANT_SUFFIXES: Array<{ marker: string; kind: IdentityVariantHint['kind'] }> = [
  { marker: 'thinking', kind: 'thinking' },
  { marker: 'think', kind: 'thinking' },
  { marker: 'nothinking', kind: 'nothinking' },
  { marker: 'nothink', kind: 'nothinking' },
  { marker: 'fast', kind: 'fast' },
  { marker: 'compact', kind: 'compact' },
  { marker: 'batch', kind: 'batch' },
  { marker: 'priority', kind: 'priority' },
]

export function resolveModelsDevIdentity(input: ModelsDevIdentityInput): ModelIdentityResolution {
  const routeParts = input.id.split('/').filter(Boolean)
  const routeNamespace = routeParts.length > 1 ? routeParts.slice(0, -1).join('/') : null
  const rawModelId = routeParts.at(-1) ?? input.id
  const normalizedId = normalizeModelTagCandidate(rawModelId)
  const normalizedName = normalizeModelTagCandidate(input.name || input.id)
  const aliases: IdentityAliasObservation[] = [aliasFor(input.id, 'official')]
  const deploymentHints: IdentityDeploymentHint[] = []
  const lossyFields: Record<string, unknown> = {}

  if (routeNamespace) {
    deploymentHints.push({ kind: 'provider_route', value: routeNamespace })
    lossyFields.routeNamespace = routeNamespace
    aliases[0] = aliasFor(input.id, 'provider_route')
  }

  const strippedSnapshot = stripSnapshotSuffix(normalizedId)
  let tag = strippedSnapshot.tagCandidate
  let snapshot: IdentitySnapshotObservation | null = null
  if (strippedSnapshot.snapshot) {
    snapshot = {
      snapshotId: normalizedId,
      snapshotName: input.name || input.id,
      marker: strippedSnapshot.snapshot,
    }
    aliases[0] = aliasFor(input.id, 'snapshot')
    lossyFields.normalizedAwaySnapshot = strippedSnapshot.snapshot
  }

  const suffixVariant = extractVariantSuffix(tag)
  let variant: IdentityVariantHint | null = null
  if (suffixVariant) {
    tag = suffixVariant.tag
    variant = { kind: suffixVariant.kind, marker: suffixVariant.marker === 'think' ? 'thinking' : suffixVariant.marker }
    lossyFields.variantSuffix = suffixVariant.marker
  }

  const suffixDeployment = stripDeploymentSuffix(tag)
  if (suffixDeployment) {
    tag = suffixDeployment.tag
    deploymentHints.push({ kind: 'suffix', value: suffixDeployment.suffix })
    lossyFields.deploymentSuffix = suffixDeployment.suffix
  }

  const providerPrefix = stripProviderPrefix(tag)
  if (providerPrefix) {
    tag = providerPrefix.tag
    deploymentHints.push({ kind: 'provider_route', value: providerPrefix.prefix })
    lossyFields.providerPrefix = providerPrefix.prefix
  }

  const regionPrefix = stripRegionPrefix(tag)
  if (regionPrefix) {
    tag = regionPrefix.tag
    deploymentHints.push({ kind: 'region', value: regionPrefix.region })
    lossyFields.regionPrefix = regionPrefix.region
  }

  const wrapperPrefix = stripDeploymentWrapper(tag)
  if (wrapperPrefix) {
    tag = wrapperPrefix.tag
    deploymentHints.push({ kind: 'wrapper', value: wrapperPrefix.wrapper })
    lossyFields.deploymentWrapper = wrapperPrefix.wrapper
  }

  const postWrapperProviderPrefix = stripProviderPrefix(tag)
  if (postWrapperProviderPrefix) {
    tag = postWrapperProviderPrefix.tag
    deploymentHints.push({ kind: 'provider_route', value: postWrapperProviderPrefix.prefix })
    lossyFields.postWrapperProviderPrefix = postWrapperProviderPrefix.prefix
  }

  tag = normalizeFamilyOrdering(tag)

  const canonicalTag = tag
  const versionId = snapshot ? snapshot.snapshotId : variant ? `${canonicalTag}-${variant.marker}` : canonicalTag

  return {
    canonicalTag,
    displayNameCandidate: displayNameCandidate(canonicalTag, input.name || input.id),
    versionId,
    aliases,
    snapshot,
    variant,
    deploymentHints: uniqueHints(deploymentHints),
    sourceRecord: {
      source: 'models.dev',
      rawId: input.id,
      rawName: input.name,
      providerId: input.providerId,
      normalizedId,
      lossyFields,
    },
  }
}

function aliasFor(alias: string, aliasType: IdentityAliasObservation['aliasType']): IdentityAliasObservation {
  return {
    alias,
    normalizedAlias: normalizeModelTagCandidate(alias),
    aliasType,
    source: 'models.dev',
    confidence: aliasType === 'official' ? 1 : 0.98,
  }
}

function stripProviderPrefix(tag: string): { prefix: string; tag: string } | null {
  for (const prefix of PROVIDER_PREFIXES) {
    if (tag === `${prefix}-r1`) continue
    if (tag.startsWith(`${prefix}-`)) return { prefix, tag: tag.slice(prefix.length + 1) }
  }
  return null
}

function stripRegionPrefix(tag: string): { region: string; tag: string } | null {
  for (const region of REGION_PREFIXES) {
    const marker = `${region}-`
    if (tag.startsWith(marker)) return { region, tag: tag.slice(marker.length) }
  }
  return null
}

function stripDeploymentWrapper(tag: string): { wrapper: string; tag: string } | null {
  for (const wrapper of DEPLOYMENT_WRAPPERS) {
    if (tag.startsWith(`${wrapper}-`)) return { wrapper, tag: tag.slice(wrapper.length + 1) }
  }
  return null
}

function stripDeploymentSuffix(tag: string): { suffix: string; tag: string } | null {
  for (const suffix of DEPLOYMENT_SUFFIXES) {
    if (tag.endsWith(`-${suffix}`)) return { suffix, tag: tag.slice(0, -(suffix.length + 1)) }
  }
  return null
}

function extractVariantSuffix(tag: string): ({ tag: string } & IdentityVariantHint) | null {
  for (const suffix of VARIANT_SUFFIXES) {
    if (tag.endsWith(`-${suffix.marker}`)) return { ...suffix, tag: tag.slice(0, -(suffix.marker.length + 1)) }
  }
  return null
}

function normalizeFamilyOrdering(tag: string): string {
  let normalized = tag

  for (const family of ANTHROPIC_CLAUDE_FAMILIES) {
    normalized = normalized.replace(new RegExp(`^claude-${family}(?=\\d)`), `claude-${family}-`)

    const familyVersionOrder = normalized.match(new RegExp(`^claude-(\\d+)-(\\d+)-${family}$`))
    if (familyVersionOrder) {
      normalized = `claude-${family}-${familyVersionOrder[1]}-${familyVersionOrder[2]}`
      break
    }
  }

  return normalized
}

function displayNameCandidate(canonicalTag: string, rawName: string): string {
  const normalizedRaw = normalizeModelTagCandidate(rawName)
  const noisy = ['databricks', 'azure', 'bedrock', 'vertex', 'openrouter', ...REGION_PREFIXES].some((prefix) => normalizedRaw.startsWith(`${prefix}-`))
  if (!noisy && rawName.trim()) return rawName.trim()
  return canonicalTag
    .split('-')
    .map((part) => (/^(gpt|api|ai)$/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ')
}

function uniqueHints(hints: IdentityDeploymentHint[]): IdentityDeploymentHint[] {
  const seen = new Set<string>()
  return hints.filter((hint) => {
    const key = `${hint.kind}:${hint.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
