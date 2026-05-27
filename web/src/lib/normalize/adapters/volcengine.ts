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

const MODEL_ID = /^[a-z][a-z0-9]+(?:[.-][a-z0-9]+)+$/u
// Lines that mark the end of a model's contiguous spec list (start of a new section).
const BOUNDARY = /限流|长度限制|能力支持|模型 ?ID|文生|图生|产物|分辨率|帧率|时长/u
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

/** Extract text-model spec blocks from the Volcengine "模型列表" markdown. */
export function parseVolcengineSpecs(markdown: string): VolcengineSpec[] {
  const lines = markdown.split('\n').map((l) => l.trimEnd())
  const nextNonEmpty = (i: number): string => {
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j += 1) {
      const s = lines[j]?.trim()
      if (s) return s
    }
    return ''
  }
  const starts: number[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const s = lines[i]?.trim() ?? ''
    if (MODEL_ID.test(s) && nextNonEmpty(i).startsWith('最大 RPM')) starts.push(i)
  }

  const specs: VolcengineSpec[] = []
  const seen = new Set<string>()
  for (let k = 0; k < starts.length; k += 1) {
    const start = starts[k]!
    const end = starts[k + 1] ?? lines.length
    const id = lines[start]!.trim()
    if (seen.has(id)) continue
    seen.add(id)
    specs.push(parseBlock(id, lines.slice(start + 1, end)))
  }
  return specs
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
  for (const raw of blockLines) {
    const line = raw.trim()
    if (!line) continue
    if (BOUNDARY.test(line)) break // stop at the next section
    const rpm = line.match(/^最大 RPM:\s*(\d+)/u)
    if (rpm) {
      spec.rpm = Number(rpm[1])
      continue
    }
    const tpm = line.match(/^最大 TPM:\s*(\d+)/u)
    if (tpm) {
      spec.tpm = Number(tpm[1])
      continue
    }
    const ctx = line.match(/^上下文窗口:\s*(\d+)k/u)
    if (ctx) {
      spec.contextLength = Number(ctx[1]) * KB
      continue
    }
    const input = line.match(/^最大输入:\s*(\d+)k/u)
    if (input) {
      spec.maxInputTokens = Number(input[1]) * KB
      continue
    }
    const output = line.match(/^最大回答[^:]*:\s*(\d+)k/u)
    if (output) {
      spec.maxOutputTokens = Number(output[1]) * KB
      continue
    }
    const reasoning = line.match(/^最大思维链:\s*(\d+)k/u)
    if (reasoning) {
      spec.maxReasoningTokens = Number(reasoning[1]) * KB
      continue
    }
    if (CAPABILITY_VOCAB.has(line)) capabilities.push(line)
  }
  return spec
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
    endpoints: 'openai/chat.completions',
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
  image: 'openai/images.generations',
  video: 'volcengine/video.generation',
  '3d': 'volcengine/3d.generation',
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
