export function buildModelNewsVocabulary(graph) {
  const visibleProviderIds = new Set(
    graph.nodes.filter((node) => node.nodeKind === 'source_model').map((node) => node.provider),
  )
  const providerByName = new Map()
  for (const provider of graph.providers) {
    if (!visibleProviderIds.has(provider.id)) continue
    const existing = providerByName.get(provider.name.toLowerCase())
    if (!existing || provider.id === provider.name.toLowerCase() || provider.id.length < existing.id.length) {
      providerByName.set(provider.name.toLowerCase(), provider)
    }
  }
  const providerById = new Map()
  for (const provider of providerByName.values()) {
    providerById.set(provider.id, {
      id: provider.id,
      name: provider.name,
      aliases: unique([provider.name, provider.id, provider.id.replace(/-/g, ' '), provider.name.replace(/-/g, ' ')]),
    })
  }
  for (const node of graph.nodes) {
    if (node.nodeKind !== 'source_model') continue
    if (!providerById.has(node.provider) && !providerByName.has(node.providerName.toLowerCase())) {
      providerById.set(node.provider, {
        id: node.provider,
        name: node.providerName,
        aliases: unique([node.providerName, node.provider, node.provider.replace(/-/g, ' '), node.providerName.replace(/-/g, ' ')]),
      })
    }
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const anchorEdgeByFrom = new Map()
  for (const edge of graph.edges ?? []) {
    if (!['deployment_of', 'alias_of', 'snapshot_of', 'variant_of', 'spec_same_as'].includes(edge.type)) continue
    if (!nodeById.has(edge.to)) continue
    anchorEdgeByFrom.set(edge.from, edge.to)
  }

  const searchOnlyNodeIds = modelPlazaSearchOnlyNodeIds(graph)
  const modelByKey = new Map()
  for (const node of graph.nodes) {
    const visibleAnchor = node.nodeKind === 'source_model' && !searchOnlyNodeIds.has(node.id) ? node : undefined
    const anchor = visibleAnchor ?? anchorModelForNode(node, nodeById, anchorEdgeByFrom, searchOnlyNodeIds)
    if (!anchor || anchor.nodeKind !== 'source_model') continue
    const key = `${anchor.provider}/${anchor.modelId}`
    const existing = modelByKey.get(key) ?? {
      modelId: anchor.modelId,
      route: `/models/${anchor.urlProvider}/${anchor.urlModelId}/`,
      provider: anchor.provider,
      sourceId: anchor.sourceId,
      displayName: anchor.displayName,
      anchorNodeId: anchor.id,
      aliases: [],
      aliasSourceIds: [],
    }
    existing.aliases = unique([...existing.aliases, ...modelAliasesForNode(anchor), ...modelAliasesForNode(node)])
    existing.aliasSourceIds = unique([...existing.aliasSourceIds, node.sourceId].filter(Boolean))
    modelByKey.set(key, existing)
  }

  return {
    generatedAt: new Date().toISOString(),
    providers: Array.from(providerById.values()).sort((a, b) => a.id.localeCompare(b.id)),
    models: Array.from(modelByKey.values()).sort((a, b) => `${a.provider}/${a.modelId}`.localeCompare(`${b.provider}/${b.modelId}`)),
  }
}

function anchorModelForNode(node, nodeById, anchorEdgeByFrom, searchOnlyNodeIds) {
  let current = node
  const seen = new Set()
  for (let depth = 0; depth < 8; depth += 1) {
    if (!current || seen.has(current.id)) return node.nodeKind === 'source_model' && !searchOnlyNodeIds.has(node.id) ? node : undefined
    seen.add(current.id)
    const nextId = anchorEdgeByFrom.get(current.id)
    if (!nextId) return current.nodeKind === 'source_model' && !searchOnlyNodeIds.has(current.id) ? current : undefined
    const next = nodeById.get(nextId)
    if (!next) return current.nodeKind === 'source_model' && !searchOnlyNodeIds.has(current.id) ? current : undefined
    if (next.nodeKind === 'source_model' && !searchOnlyNodeIds.has(next.id)) return next
    current = next
  }
  return current?.nodeKind === 'source_model' && !searchOnlyNodeIds.has(current.id) ? current : node.nodeKind === 'source_model' && !searchOnlyNodeIds.has(node.id) ? node : undefined
}

function modelPlazaSearchOnlyNodeIds(graph) {
  const resolvedEdgeTypes = new Set(['deployment_of', 'alias_of', 'snapshot_of'])
  return new Set((graph.edges ?? []).filter((edge) => edge.from !== edge.to && resolvedEdgeTypes.has(edge.type)).map((edge) => edge.from))
}

function modelAliasesForNode(node) {
  return [
    node.modelId,
    node.sourceId,
    node.displayName,
    node.modelIdWithinNamespace,
    node.urlModelId,
    node.derived?.canonicalSlug,
  ].filter(Boolean)
}

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)))
}
