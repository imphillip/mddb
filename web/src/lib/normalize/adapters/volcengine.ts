// Volcengine Ark adapter (see ../../../../../normalizer-spec.md §4.3).
// Consumes STRUCTURED records produced by scripts/parse-volcengine-markdown.mjs (which parses
// the clean "复制markdown" exports ark-models.md + ark-pricing.md). Volcengine is the CNY
// official-pricing source for the ByteDance Doubao / Seed / Seedream / Seedance / 3D family,
// most of which have no other price source. Tagged source_confidence:"low" (doc-derived).
import type { Modality, ModelFacts, Offer, Price, SourceFragment } from '../schema.js'
import { canonicalId, foldSnapshotId, matchKey, uniq } from '../primitives.js'

/** One structured Volcengine model (output of parse-volcengine-markdown.mjs). */
export interface VolcengineModel {
  id: string
  name?: string
  source_kind?: 'text' | 'image' | 'video' | '3d' | 'embedding'
  currency?: string
  capabilities?: string[]
  context_window?: number | null
  max_input_tokens?: number | null
  max_output_tokens?: number | null
  max_reasoning_tokens?: number | null
  rpm?: number
  tpm?: number
  prices?: Price[]
  pricing_status?: string
  /** Raw tier text for prices that don't fit the schema (e.g. seedance resolution/audio tiers). */
  pricing_note?: string
  pricing_note_offline?: string
  snapshots?: string[]
}

export interface VolcengineAdapterOptions {
  observedAt?: string
  sourceUrl?: string
}

const AUTHOR_BY_PREFIX: ReadonlyArray<[string, string]> = [
  ['doubao', 'bytedance'],
  ['seed', 'bytedance'],
  ['hitem', 'bytedance'],
  ['hyper3d', 'bytedance'],
  ['deepseek', 'deepseek'],
  ['glm', 'zhipu'],
  ['kimi', 'moonshotai'],
]

const ENDPOINT_BY_KIND: Record<NonNullable<VolcengineModel['source_kind']>, string> = {
  text: 'chat',
  embedding: 'embeddings',
  image: 'images',
  video: 'video',
  '3d': '3d',
}

const OUTPUT_MODALITY: Record<NonNullable<VolcengineModel['source_kind']>, Modality> = {
  text: 'text',
  embedding: 'embedding',
  image: 'image',
  video: 'video',
  '3d': 'other',
}

export function volcengineModelFragment(raw: VolcengineModel, options: VolcengineAdapterOptions = {}): SourceFragment {
  const fullId = canonicalId(raw.id)
  const id = foldSnapshotId(fullId)
  const kind = raw.source_kind ?? 'text'
  const caps = raw.capabilities ?? []

  const facts: ModelFacts = {
    reasoning: caps.includes('深度思考'),
    tool_calling: caps.includes('工具调用'),
    context_length: raw.context_window ?? null,
    max_input_tokens: raw.max_input_tokens ?? null,
    max_output_tokens: raw.max_output_tokens ?? null,
  }
  const mod = modalities(caps, kind)
  if (mod.input.length) facts.input_modalities = mod.input
  if (mod.output.length) facts.output_modalities = mod.output
  const author = inferAuthor(id)
  if (author) {
    facts.author = author
    facts.author_id = author
  }
  const extra: Record<string, unknown> = { source_confidence: 'low' }
  if (raw.max_reasoning_tokens != null) extra['max_reasoning_tokens'] = raw.max_reasoning_tokens
  facts.other_parameters = extra

  const otherParams: Record<string, unknown> = {}
  if (raw.rpm != null) otherParams['RPM'] = raw.rpm
  if (raw.tpm != null) otherParams['TPM'] = raw.tpm
  if (raw.pricing_status) otherParams['pricing_status'] = raw.pricing_status
  if (raw.pricing_note) otherParams['pricing_note'] = raw.pricing_note
  if (raw.pricing_note_offline) otherParams['pricing_note_offline'] = raw.pricing_note_offline

  const offer: Offer = {
    source: 'volcengine',
    currency: raw.currency ?? 'CNY',
    prices: (raw.prices ?? []).filter(hasComponent),
  }
  if (Object.keys(otherParams).length) offer.other_params = otherParams
  if (options.sourceUrl) offer.url = options.sourceUrl
  if (options.observedAt) offer.observed_at = options.observedAt

  const aliasIds = uniq([
    ...(id !== fullId ? [fullId] : []),
    ...(raw.snapshots ?? []).map((s) => canonicalId(s)),
  ]).filter((a) => a !== id)

  return {
    source: 'volcengine',
    matchKey: matchKey(id),
    identityId: id, // CNY official source may mint canonical (low confidence; human-reviewed)
    aliasIds,
    aliasNames: raw.name ? [raw.name] : [],
    facts,
    endpoint: ENDPOINT_BY_KIND[kind],
    offer,
    provenance: null,
  }
}

/** Map all structured Volcengine models to fragments. */
export function volcengineFragments(models: readonly VolcengineModel[], options: VolcengineAdapterOptions = {}): SourceFragment[] {
  return models.filter((m) => m?.id).map((m) => volcengineModelFragment(m, options))
}

// Capabilities that imply the model accepts image INPUT: visual/multimodal understanding, and the
// "图生X" (image-to-X) generation families (图生图 / 图生视频 / 图生3D), plus 参考图 / 编辑.
const IMAGE_INPUT_CAP = /图生|图片|视觉|多模态|参考图|编辑/u

function modalities(caps: string[], kind: NonNullable<VolcengineModel['source_kind']>): { input: Modality[]; output: Modality[] } {
  const input = new Set<Modality>(['text'])
  const output = new Set<Modality>([OUTPUT_MODALITY[kind]])
  // Video & 3D generation are inherently image-conditioned families.
  if (kind === 'video' || kind === '3d') input.add('image')
  if (caps.some((c) => IMAGE_INPUT_CAP.test(c) || c === 'GUI任务')) input.add('image')
  return { input: [...input], output: [...output] }
}

function hasComponent(price: Price): boolean {
  return Object.keys(price).some((k) => k !== 'conditions')
}

function inferAuthor(id: string): string | null {
  for (const [prefix, author] of AUTHOR_BY_PREFIX) {
    if (id.startsWith(prefix)) return author
  }
  return null
}
