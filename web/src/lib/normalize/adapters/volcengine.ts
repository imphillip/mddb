// Volcengine Ark adapter (see ../../../../../normalizer-spec.md §4.3).
// Source is Chinese MARKDOWN prose, not structured JSON -> low-confidence text extraction.
// Every fragment is tagged source_confidence:"low" so it never silently overrides a
// structured source and lands in a human-review queue.
//
// SCOPE (phase 2): reliably extracts TEXT models (doubao-seed / deepseek / glm) whose spec
// block is `<id>` immediately followed by `最大 RPM:`. Image/video/3D models
// (seedream / seedance / hitem3d) use entirely different field patterns and are a
// flagged follow-up — see parseVolcengineSpecs notes.
import type { Modality, ModelFacts, Offer, SourceFragment } from '../schema.js'
import { canonicalId, matchKey } from '../primitives.js'

export interface VolcengineSpec {
  id: string
  rpm: number | null
  tpm: number | null
  contextLength: number | null
  maxInputTokens: number | null
  maxOutputTokens: number | null
  maxReasoningTokens: number | null
  capabilities: string[]
}

export interface VolcengineAdapterOptions {
  observedAt?: string
  sourceUrl?: string
}

const CAPABILITY_VOCAB = new Set([
  '深度思考',
  '文本生成',
  '多模态理解',
  '视觉理解',
  '视觉定位',
  'GUI任务',
  '工具调用',
  '结构化输出',
  '视频生成',
  '图片生成',
])

const KB = 1024

/**
 * Extract text-model spec blocks from the Volcengine "模型列表" markdown.
 *
 * The doc layout drifts (an id may be followed by spec lines in any order, with
 * `最大 RPM` appearing later or as a tiered 企业用户/个人用户 sub-block, and ids may
 * repeat or be glued to trailing text). So we parse by BLOCKS: every id-shaped line
 * (extracted leniently from the line start) opens a block that runs to the next
 * id-shaped line; fields are scanned order-independently; duplicate ids are merged
 * (first non-null wins). Media families (Seedream/Seedance/3D) are excluded here and
 * handled by parseVolcengineMediaModels.
 */
export function parseVolcengineSpecs(markdown: string): VolcengineSpec[] {
  const lines = markdown.split('\n').map((l) => l.trim())
  const idAt = lines.map((l) => ID_CORE.exec(l)?.[1] ?? null)
  const boundaries = idAt.map((id, i) => (id ? i : -1)).filter((i) => i >= 0)

  const merged = new Map<string, VolcengineSpec>()
  for (let b = 0; b < boundaries.length; b += 1) {
    const start = boundaries[b]!
    const id = idAt[start]!
    if (mediaFamilyKind(id)) continue // media handled separately
    const end = boundaries[b + 1] ?? lines.length
    mergeSpec(merged, parseBlock(id, lines.slice(start + 1, end)))
  }
  return [...merged.values()].filter(hasSpecSignal)
}

function parseBlock(id: string, blockLines: string[]): VolcengineSpec {
  const capabilities: string[] = []
  const spec: VolcengineSpec = {
    id,
    rpm: null,
    tpm: null,
    contextLength: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    maxReasoningTokens: null,
    capabilities,
  }
  const setOnce = (key: 'rpm' | 'tpm' | 'contextLength' | 'maxInputTokens' | 'maxOutputTokens' | 'maxReasoningTokens', value: number | null): void => {
    if (value !== null && spec[key] === null) spec[key] = value
  }
  for (let i = 0; i < blockLines.length; i += 1) {
    const line = blockLines[i]!
    if (!line) continue
    let m
    if ((m = line.match(/^最大 ?RPM[:：]\s*(\d+)/u))) setOnce('rpm', Number(m[1]))
    else if (/^最大 ?RPM[:：]\s*$/u.test(line)) setOnce('rpm', tieredValue(blockLines, i))
    else if ((m = line.match(/^最大 ?TPM[:：]\s*(\d+)/u))) setOnce('tpm', Number(m[1]))
    else if (/^最大 ?TPM[:：]\s*$/u.test(line)) setOnce('tpm', tieredValue(blockLines, i))
    else if ((m = line.match(/^上下文窗口[:：]\s*([\d.]+)\s*([kmKM])/u))) setOnce('contextLength', kTokens(m[1]!, m[2]!))
    else if ((m = line.match(/^最大输入[:：]\s*([\d.]+)\s*([kmKM])/u))) setOnce('maxInputTokens', kTokens(m[1]!, m[2]!))
    else if ((m = line.match(/^最大回答[^:：]*[:：]\s*([\d.]+)\s*([kmKM])/u))) setOnce('maxOutputTokens', kTokens(m[1]!, m[2]!))
    else if ((m = line.match(/^最大思维链[:：]\s*([\d.]+)\s*([kmKM])/u))) setOnce('maxReasoningTokens', kTokens(m[1]!, m[2]!))
    else if (CAPABILITY_VOCAB.has(line) && !capabilities.includes(line)) capabilities.push(line)
  }
  return spec
}

/** k/m token suffix -> token count (k = 1024 tokens, m = 1024k). */
function kTokens(num: string, unit: string): number {
  return Math.round(Number(num) * (unit.toLowerCase() === 'm' ? KB * KB : KB))
}

/** A bare `最大 RPM:` / `最大 TPM:` header is followed by tiered 企业用户/个人用户 values. */
function tieredValue(blockLines: string[], from: number): number | null {
  for (let j = from + 1; j < Math.min(from + 6, blockLines.length); j += 1) {
    const ent = blockLines[j]?.match(/企业用户[:：]\s*(\d+)/u)
    if (ent) return Number(ent[1])
  }
  for (let j = from + 1; j < Math.min(from + 6, blockLines.length); j += 1) {
    const per = blockLines[j]?.match(/个人用户[:：]\s*(\d+)/u)
    if (per) return Number(per[1])
  }
  return null
}

/** Merge a parsed block into the accumulator by id: first non-null per field wins; capabilities union. */
function mergeSpec(acc: Map<string, VolcengineSpec>, spec: VolcengineSpec): void {
  const prev = acc.get(spec.id)
  if (!prev) {
    acc.set(spec.id, spec)
    return
  }
  for (const key of ['rpm', 'tpm', 'contextLength', 'maxInputTokens', 'maxOutputTokens', 'maxReasoningTokens'] as const) {
    if (prev[key] === null && spec[key] !== null) prev[key] = spec[key]
  }
  for (const cap of spec.capabilities) if (!prev.capabilities.includes(cap)) prev.capabilities.push(cap)
}

/** Keep only blocks that carry a real spec signal (drops bare id mentions / noise). */
function hasSpecSignal(spec: VolcengineSpec): boolean {
  return (
    spec.contextLength !== null ||
    spec.maxInputTokens !== null ||
    spec.maxOutputTokens !== null ||
    spec.maxReasoningTokens !== null ||
    spec.rpm !== null ||
    spec.tpm !== null ||
    spec.capabilities.length > 0
  )
}

const AUTHOR_BY_PREFIX: ReadonlyArray<[string, string]> = [
  ['doubao', 'bytedance'],
  ['deepseek', 'deepseek'],
  ['glm', 'zhipu'],
]

export function volcengineFragment(spec: VolcengineSpec, options: VolcengineAdapterOptions = {}): SourceFragment {
  const id = canonicalId(spec.id)
  const caps = spec.capabilities

  const facts: ModelFacts = {
    reasoning: caps.includes('深度思考'),
    tool_calling: caps.includes('工具调用'),
    context_length: spec.contextLength,
    max_input_tokens: spec.maxInputTokens,
    max_output_tokens: spec.maxOutputTokens,
  }
  const modalities = modalitiesFromCapabilities(caps)
  if (modalities.input.length) facts.input_modalities = modalities.input
  if (modalities.output.length) facts.output_modalities = modalities.output
  const author = inferAuthor(id)
  if (author) {
    facts.author = author
    facts.author_id = author
  }

  const extra: Record<string, unknown> = { source_confidence: 'low' }
  if (spec.maxReasoningTokens !== null) extra['max_reasoning_tokens'] = spec.maxReasoningTokens
  facts.other_parameters = extra

  // Pricing is NOT auto-extracted: the Volcengine price doc (1544106) is a flattened
  // markdown where table cells/columns are scrambled, so model→input/output mapping is
  // not safely recoverable. Emitting a needs_review marker beats guessing wrong prices.
  const otherParams: Record<string, unknown> = { pricing_status: 'needs_review' }
  if (spec.rpm !== null) otherParams['RPM'] = spec.rpm
  if (spec.tpm !== null) otherParams['TPM'] = spec.tpm
  const offer: Offer = {
    source: 'volcengine',
    currency: 'CNY',
    prices: [],
    endpoints: 'chat',
    other_params: otherParams,
  }
  if (options.sourceUrl) offer.url = options.sourceUrl
  if (options.observedAt) offer.observed_at = options.observedAt

  return {
    source: 'volcengine',
    matchKey: matchKey(id),
    identityId: id, // CNY official source may mint canonical (low confidence; human-reviewed)
    aliasIds: [],
    aliasNames: [],
    facts,
    offer,
    provenance: null,
  }
}

export type VolcengineMediaKind = 'image' | 'video' | '3d'

export interface VolcengineMediaSpec {
  id: string
  kind: VolcengineMediaKind
  note: string | null
  aliasIds: string[]
}

const ID_CORE = /^([a-z][a-z0-9]+(?:[.-][a-z0-9]+)+)/u
const ALSO_SUPPORTS = /同时支持[:：]\s*([a-z0-9][a-z0-9.-]+)/u

/**
 * Extract Volcengine image/video/3D models (Seedream / Seedance / *3d*).
 * Modality is keyed on the canonical PRODUCT FAMILY in the id, NOT on surrounding text:
 * the flattened markdown interleaves blocks, so window-based capability detection
 * mis-tags neighbouring text models. Family-name keying avoids those false positives.
 * Identity + modality are reliable; specs/prices are left for human review.
 */
export function parseVolcengineMediaModels(markdown: string): VolcengineMediaSpec[] {
  const lines = markdown.split('\n').map((l) => l.trim())
  const specs: VolcengineMediaSpec[] = []
  const seen = new Set<string>()
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const match = ID_CORE.exec(line)
    if (!match) continue
    const id = match[1]!
    const kind = mediaFamilyKind(id)
    if (!kind || seen.has(id)) continue
    seen.add(id)
    const note = line.slice(id.length).trim() || null
    const aliasIds: string[] = []
    for (let j = i + 1; j < Math.min(i + 12, lines.length); j += 1) {
      const also = ALSO_SUPPORTS.exec(lines[j] ?? '')
      if (also) aliasIds.push(also[1]!)
    }
    specs.push({ id, kind, note, aliasIds })
  }
  return specs
}

function mediaFamilyKind(id: string): VolcengineMediaKind | null {
  if (id.includes('seedream')) return 'image'
  if (id.includes('seedance')) return 'video'
  if (/3d/u.test(id)) return '3d'
  return null
}

const MEDIA_OUTPUT: Record<VolcengineMediaKind, Modality> = {
  image: 'image',
  video: 'video',
  '3d': 'other',
}
const MEDIA_ENDPOINTS: Record<VolcengineMediaKind, string> = {
  image: 'images',
  video: 'video',
  '3d': '3d',
}

export function volcengineMediaFragment(
  spec: VolcengineMediaSpec,
  options: VolcengineAdapterOptions = {},
): SourceFragment {
  const id = canonicalId(spec.id)
  const author = inferAuthor(id)

  const facts: ModelFacts = {
    input_modalities: ['text', 'image'],
    output_modalities: [MEDIA_OUTPUT[spec.kind]],
  }
  if (author) {
    facts.author = author
    facts.author_id = author
  }
  const extra: Record<string, unknown> = { source_confidence: 'low', media_type: spec.kind }
  if (spec.note) extra['note'] = spec.note
  facts.other_parameters = extra

  const offer: Offer = {
    source: 'volcengine',
    currency: 'CNY',
    prices: [],
    endpoints: MEDIA_ENDPOINTS[spec.kind],
    other_params: { pricing_status: 'needs_review' },
  }
  if (options.sourceUrl) offer.url = options.sourceUrl
  if (options.observedAt) offer.observed_at = options.observedAt

  return {
    source: 'volcengine',
    matchKey: matchKey(id),
    identityId: id,
    aliasIds: spec.aliasIds.map((a) => canonicalId(a)),
    aliasNames: [],
    facts,
    offer,
    provenance: null,
  }
}

function modalitiesFromCapabilities(caps: string[]): { input: Modality[]; output: Modality[] } {
  const input = new Set<Modality>()
  const output = new Set<Modality>()
  if (caps.includes('文本生成')) {
    input.add('text')
    output.add('text')
  }
  if (caps.includes('多模态理解') || caps.includes('视觉理解') || caps.includes('视觉定位') || caps.includes('GUI任务')) {
    input.add('text')
    input.add('image')
  }
  if (caps.includes('图片生成')) output.add('image')
  if (caps.includes('视频生成')) output.add('video')
  return { input: [...input], output: [...output] }
}

function inferAuthor(id: string): string | null {
  for (const [prefix, author] of AUTHOR_BY_PREFIX) {
    if (id.startsWith(prefix)) return author
  }
  return null
}
