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

  for (const providerId of providerIds) {
    if (!providers.some((provider) => provider.value === providerId)) {
      providers.push({ value: providerId, confidence: 0.9, evidence: 'Provider inferred from matched model tag' })
    }
  }

  return { providers, models }
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

function matchesModelAlias(text, alias, model) {
  if (shouldConsiderModelAlias(alias, model) && matchesAlias(text, alias)) return true
  const normalized = alias.toLowerCase()
  const tokens = tokenAliases(alias)
  return tokens.some((token) => token !== normalized && shouldConsiderModelAlias(token, model) && matchesAlias(text, token))
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
