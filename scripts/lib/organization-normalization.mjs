const ORGANIZATIONS = [
  {
    id: 'xai',
    name: 'xAI',
    currency: 'USD',
    aliases: ['xai', 'x-ai', 'x ai', 'X Ai', 'xAI', 'XAI'],
    regionalNames: [
      { name: 'xAI', regions: ['global'], currency: 'USD' },
    ],
  },
  {
    id: 'bytedance',
    name: 'ByteDance',
    localizedName: '字节跳动',
    currency: 'USD',
    aliases: ['bytedance', 'byte dance', 'ByteDance', 'Bytedance', '字节跳动'],
    regionalNames: [
      { name: '字节跳动', regions: ['CN'], currency: 'CNY' },
      { name: 'ByteDance', regions: ['global'], currency: 'USD' },
    ],
  },
]

const TEAM_ALIASES = [
  {
    organizationId: 'bytedance',
    teamName: 'ByteDance Seed',
    aliases: ['bytedance-seed', 'bytedance seed', 'ByteDance Seed', 'Bytedance Seed', 'seed', 'Seed', '字节 seed'],
  },
]

const ALIAS_TO_ORG = new Map()
const ALIAS_TO_TEAM = new Map()
for (const org of ORGANIZATIONS) {
  for (const alias of org.aliases) ALIAS_TO_ORG.set(normalizeAlias(alias), org)
}
for (const team of TEAM_ALIASES) {
  for (const alias of team.aliases) ALIAS_TO_TEAM.set(normalizeAlias(alias), team)
}

export function normalizeOrganization(value) {
  const key = normalizeAlias(value)
  const team = ALIAS_TO_TEAM.get(key)
  if (team) {
    const org = ORGANIZATIONS.find((candidate) => candidate.id === team.organizationId)
    return { ...org, teamName: team.teamName, matchedAlias: String(value ?? '').trim() }
  }
  const org = ALIAS_TO_ORG.get(key)
  if (org) return { ...org, matchedAlias: String(value ?? '').trim() }
  return {
    id: slugify(value),
    name: String(value ?? '').trim(),
    currency: 'USD',
    aliases: [String(value ?? '').trim()].filter(Boolean),
    regionalNames: [],
    matchedAlias: String(value ?? '').trim(),
  }
}

export function organizationRolesForNode(node) {
  const roles = []
  const authorValue = node?.derived?.author
  if (authorValue) {
    roles.push({ role: 'author', organizationId: normalizeOrganization(authorValue).id, sourceValue: authorValue })
  }
  if (node?.nodeKind === 'endpoint_deployment') {
    roles.push({ role: 'deployment_provider', organizationId: normalizeOrganization(node.provider).id, sourceValue: node.provider })
  } else if (!authorValue && node?.provider) {
    roles.push({ role: 'author', organizationId: normalizeOrganization(node.provider).id, sourceValue: node.provider })
  }
  return uniqueRoles(roles)
}

export function knownOrganizations() {
  return ORGANIZATIONS.map((org) => ({ ...org, aliases: [...org.aliases], regionalNames: [...(org.regionalNames ?? [])] }))
}

export function normalizeProviderVariant(value) {
  const raw = String(value ?? '').trim()
  const normalized = raw.toLowerCase()
  if (normalized.startsWith('together-')) return 'together'
  return slugify(raw)
}

function normalizeAlias(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[._]/g, '-').replace(/\s+/g, ' ')
}

function slugify(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}

function uniqueRoles(roles) {
  const seen = new Set()
  return roles.filter((role) => {
    const key = `${role.role}:${role.organizationId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
