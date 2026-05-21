const AUTHOR_PROVIDER_IDS = new Set(['anthropic', 'google', 'openai', 'xai', 'meta-llama', 'mistral', 'moonshot-ai', 'z-ai', 'qwen', 'deepseek', 'baidu', 'bytedance', 'alibaba', 'tencent', 'minimax', 'cohere', 'ai21', 'nousresearch', 'reka', 'liquid', 'poolside', 'morph', 'arcee-ai', 'ibm-granite', 'inception', 'inflection'])

const GROUP_META = {
  canonical: { label: '核心：models.json', reviewLevel: 'strict' },
  'author-provider': { label: '核心：自研/作者 Provider', reviewLevel: 'strict' },
  'endpoint-provider': { label: '一般：渠道/端点 Provider', reviewLevel: 'routine' },
  'source-snapshot': { label: '一般：原始抓取快照', reviewLevel: 'routine' },
  other: { label: '其他', reviewLevel: 'routine' },
} as const

export type DiffFileSummary = {
  path: string
  category: 'canonical' | 'author-provider' | 'endpoint-provider' | 'source-snapshot' | 'other'
  reviewLevel: 'strict' | 'routine'
  addedLines: number
  removedLines: number
}

export type DiffSummary = {
  files: DiffFileSummary[]
  totals: {
    files: number
    addedLines: number
    removedLines: number
  }
  groups: Array<{
    id: DiffFileSummary['category']
    label: string
    reviewLevel: 'strict' | 'routine'
    files: DiffFileSummary[]
  }>
}

export function summarizeRegistryDiff(diff: string, changedFiles: string[] = []): DiffSummary {
  const stats = parseDiffStats(diff)
  const paths = changedFiles.length ? changedFiles : [...stats.keys()]
  const files = paths.map((path) => {
    const category = classifyPath(path)
    const meta = GROUP_META[category]
    const stat = stats.get(path) ?? { addedLines: 0, removedLines: 0 }
    return {
      path,
      category,
      reviewLevel: meta.reviewLevel,
      addedLines: stat.addedLines,
      removedLines: stat.removedLines,
    }
  })
  const groups = (Object.keys(GROUP_META) as DiffFileSummary['category'][])
    .map((id) => ({
      id,
      label: GROUP_META[id].label,
      reviewLevel: GROUP_META[id].reviewLevel,
      files: files.filter((file) => file.category === id),
    }))
    .filter((group) => group.files.length > 0)
  return {
    files,
    totals: {
      files: files.length,
      addedLines: files.reduce((sum, file) => sum + file.addedLines, 0),
      removedLines: files.reduce((sum, file) => sum + file.removedLines, 0),
    },
    groups,
  }
}

function classifyPath(path: string): DiffFileSummary['category'] {
  if (path === 'data/models.json') return 'canonical'
  const provider = path.match(/^data\/providers\/([^/]+)\.json$/u)?.[1]
  if (provider) return AUTHOR_PROVIDER_IDS.has(provider) ? 'author-provider' : 'endpoint-provider'
  if (path.startsWith('.internal/source-data/')) return 'source-snapshot'
  return 'other'
}

function parseDiffStats(diff: string): Map<string, { addedLines: number, removedLines: number }> {
  const stats = new Map<string, { addedLines: number, removedLines: number }>()
  let current: string | undefined
  for (const line of diff.split('\n')) {
    const fileMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/u)
    if (fileMatch) {
      current = fileMatch[2] ?? fileMatch[1] ?? ''
      if (!current) continue
      if (!stats.has(current)) stats.set(current, { addedLines: 0, removedLines: 0 })
      continue
    }
    if (!current) continue
    if (line.startsWith('+++ ') || line.startsWith('--- ')) continue
    const stat = stats.get(current)
    if (!stat) continue
    if (line.startsWith('+')) stat.addedLines += 1
    if (line.startsWith('-')) stat.removedLines += 1
  }
  return stats
}
