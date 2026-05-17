export function deterministicTags(item, vocab) {
  const text = searchableText(item)
  const providers = []
  const models = []
  const providerIds = new Set()

  const sortedModels = [...vocab.models]
    .map((model) => ({ ...model, aliases: sortedAliases(model.aliases ?? [model.modelId]) }))
    .sort((a, b) => longestAliasLength(b.aliases) - longestAliasLength(a.aliases) || a.modelId.localeCompare(b.modelId))

  for (const model of sortedModels) {
    const alias = model.aliases.find((candidate) => matchesModelAlias(text, candidate, model))
    if (!alias) continue
    models.push({ value: model.modelId, confidence: 0.95, evidence: `Matched model alias: ${alias}` })
    providerIds.add(model.provider)
    if (models.length >= 5) break
  }

  const sortedProviders = [...vocab.providers]
    .map((provider) => ({ ...provider, aliases: sortedAliases(provider.aliases ?? [provider.id, provider.name]) }))
    .sort((a, b) => longestAliasLength(b.aliases) - longestAliasLength(a.aliases) || a.id.localeCompare(b.id))

  for (const provider of sortedProviders) {
    if (providerIds.has(provider.id)) continue
    const alias = provider.aliases.find((candidate) => matchesAlias(text, candidate))
    if (!alias) continue
    providers.push({ value: provider.id, confidence: 0.82, evidence: `Matched provider alias: ${alias}` })
    providerIds.add(provider.id)
    if (providers.length >= 4) break
  }

  const prunedModels = pruneBroaderFamilyMatches(models)

  for (const providerId of providerIds) {
    if (!providers.some((provider) => provider.value === providerId)) {
      providers.push({ value: providerId, confidence: 0.9, evidence: 'Provider inferred from matched model tag' })
    }
  }

  return { providers, models: prunedModels }
}

function searchableText(item) {
  return ` ${[item.title, item.title_en, item.summary, item.source, item.url].filter(Boolean).join(' ')} `.toLowerCase()
}

function sortedAliases(aliases) {
  return Array.from(new Set(aliases.map((alias) => String(alias).trim()).filter((alias) => alias.length >= 3))).sort((a, b) => b.length - a.length || a.localeCompare(b))
}

function longestAliasLength(aliases) {
  return aliases.reduce((max, alias) => Math.max(max, alias.length), 0)
}

function pruneBroaderFamilyMatches(models) {
  return models.filter((model) => !models.some((other) => other !== model && isFinerVersionOf(other.value, model.value)))
}

function isFinerVersionOf(candidate, family) {
  const familyTokens = versionTokens(family)
  const candidateTokens = versionTokens(candidate)
  if (!familyTokens || !candidateTokens) return false
  if (candidateTokens.prefix !== familyTokens.prefix) return false
  if (candidateTokens.numbers.length <= familyTokens.numbers.length) return false
  return familyTokens.numbers.every((number, index) => candidateTokens.numbers[index] === number)
}

function versionTokens(value) {
  const match = String(value).toLowerCase().match(/^([a-z]+)-([0-9]+(?:[.-][0-9]+)*)(.*)$/)
  if (!match) return undefined
  return {
    prefix: match[1],
    numbers: match[2].split(/[.-]/).map(Number),
    suffix: match[3] ?? '',
  }
}

function matchesModelAlias(text, alias, model) {
  const normalized = alias.toLowerCase()
  const tokens = tokenAliases(alias)
  const hasFinerMention = tokens.some((token) => shouldConsiderModelAlias(token, model) && hasFinerVersionMention(text, token))
  if (hasFinerMention) return false
  if (shouldConsiderModelAlias(alias, model) && matchesAlias(text, alias)) return true
  return tokens.some((token) => token !== normalized && shouldConsiderModelAlias(token, model) && matchesAlias(text, token))
}

function hasFinerVersionMention(text, alias) {
  const tokens = versionTokens(String(alias).toLowerCase())
  if (!tokens) return false
  const major = `${tokens.prefix}-${tokens.numbers.join('.')}`
  const spacedMajor = major.replace('-', ' ')
  const forms = [major, spacedMajor]
  return forms.some((form) => {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '[\\s-]+')
    const pattern = new RegExp(`(^|[^a-z0-9])${escaped}[\\s.-]+[0-9]+([^a-z0-9]|$)`, 'i')
    return pattern.test(text)
  })
}

function tokenAliases(alias) {
  const raw = String(alias).toLowerCase()
  const tokens = new Set()
  tokens.add(raw)
  tokens.add(raw.replace(/\s+/g, '-'))
  tokens.add(raw.replace(/-/g, ' '))
  tokens.add(raw.replace(/:/g, ' '))
  tokens.add(raw.replace(/[\s:]+/g, '-'))
  return Array.from(tokens).filter(Boolean)
}

function shouldConsiderModelAlias(alias, model) {
  const normalized = alias.toLowerCase()
  if (normalized.includes('/')) return true
  if (normalized.length < 5) return false
  const generic = new Set(['free', 'auto', 'latest', 'search', 'claude', 'codex', 'hermes'])
  if (generic.has(normalized)) return false
  return normalized.includes('-') || normalized.includes('.') || /\d/.test(normalized) || normalized === model.displayName.toLowerCase()
}

function matchesAlias(text, alias) {
  const normalized = alias.toLowerCase()
  if (normalized.length < 3) return false
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const boundary = /^[a-z0-9][a-z0-9._/:/-]*$/i.test(normalized)
    ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i')
    : new RegExp(escaped, 'i')
  return boundary.test(text)
}
