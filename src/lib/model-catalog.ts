export type Brand = {
  slug: string
  name: string
  description: string
  logoUrl?: string | undefined
}

export type ProviderDeployment = {
  slug: string
  name: string
  logoUrl?: string | undefined
  region: string
  uptime: string
  latency: string
  throughput: string
}

export type ModelVariant = {
  id: string
  name: string
  summary: string
  contextWindow: string
  inputPrice: string
  outputPrice: string
  differences: string[]
  providers: ProviderDeployment[]
}

export type ModelSummary = {
  tag: string
  route: string
  name: string
  brand: Brand
  description: string
  modalities: string[]
  contextWindow: string
  inputPrice: string
  outputPrice: string
  providerNames: string[]
  variantCount: number
  weeklyTokens: string
  releasedAt: string
}

export type ModelMetaItem = {
  label: string
  value: string | string[]
}

export type ModelDetail = ModelSummary & {
  longDescription: string
  variants: ModelVariant[]
  apiIdentifier: string
  benchmarks: Array<{ name: string; score: string; note: string }>
  meta: ModelMetaItem[]
}

export type BrandGroup = Brand & {
  models: ModelSummary[]
}

export type ModelGallery = {
  brands: BrandGroup[]
  models: ModelSummary[]
  stats: {
    modelCount: number
    brandCount: number
    providerCount: number
    variantCount: number
  }
}

const brands: Brand[] = [
  { slug: 'anthropic', name: 'Anthropic', description: 'Claude 系列，擅长代码、智能体与长文本推理。' },
  { slug: 'openai', name: 'OpenAI', description: 'GPT 与 o 系列，多模态、工具调用和通用智能入口。' },
  { slug: 'google', name: 'Google', description: 'Gemini 系列，强调长上下文、多模态与原生云部署。' },
  { slug: 'deepseek', name: 'DeepSeek', description: '高性价比推理与代码模型，开放权重生态活跃。' },
  { slug: 'meta', name: 'Meta', description: 'Llama 开放模型家族，适合私有化与多云托管。' },
]

const provider = {
  anthropic: { slug: 'anthropic', name: 'Anthropic', region: 'US', uptime: '99.9%', latency: '低', throughput: '高' },
  openrouter: { slug: 'openrouter', name: 'OpenRouter', region: 'Global', uptime: '99.8%', latency: '智能路由', throughput: '高' },
  vertex: { slug: 'google-vertex', name: 'Google Vertex', region: 'Global', uptime: '99.6%', latency: '中', throughput: '高' },
  bedrock: { slug: 'amazon-bedrock', name: 'Amazon Bedrock', region: 'US', uptime: '98.7%', latency: '中', throughput: '企业配额' },
  openai: { slug: 'openai', name: 'OpenAI', region: 'Global', uptime: '99.9%', latency: '低', throughput: '高' },
  azure: { slug: 'azure-ai-foundry', name: 'Azure AI Foundry', region: '多区域', uptime: '99.9%', latency: '区域相关', throughput: '企业配额' },
  google: { slug: 'google-ai', name: 'Google AI', region: 'Global', uptime: '99.7%', latency: '低', throughput: '高' },
  deepseek: { slug: 'deepseek', name: 'DeepSeek', region: 'CN/Global', uptime: '99.3%', latency: '中', throughput: '高' },
  together: { slug: 'together-ai', name: 'Together AI', region: 'US', uptime: '99.5%', latency: '中', throughput: '高' },
  fireworks: { slug: 'fireworks', name: 'Fireworks AI', region: 'US', uptime: '99.4%', latency: '低', throughput: '高' },
} satisfies Record<string, ProviderDeployment>

const modelDetails: ModelDetail[] = [
  {
    tag: 'claude-sonnet-4',
    route: '/models/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    brand: brands[0]!,
    description: '平衡编码、推理与日常智能体任务的高性能 Claude 模型。',
    longDescription: 'Claude Sonnet 4 显著增强代码库导航、复杂指令遵循和代理工作流稳定性。mddb.dev 将 Anthropic 官方、OpenRouter 聚合、Google Vertex 与 Amazon Bedrock 视为同一个规范模型下的部署来源；只有上下文、企业网络或参数行为不同的部署才作为 variant 展示。',
    modalities: ['文本', '视觉', '工具', '结构化输出'],
    contextWindow: '200K / 1M',
    inputPrice: '$3 / 1M',
    outputPrice: '$15 / 1M',
    providerNames: ['Anthropic', 'Amazon Bedrock', 'Google Vertex', 'OpenRouter'],
    variantCount: 3,
    weeklyTokens: '47.4B',
    releasedAt: '2025-05-22',
    apiIdentifier: 'claude-sonnet-4',
    meta: [
      { label: 'API identifier', value: 'claude-sonnet-4' },
      { label: 'Canonical tag', value: 'claude-sonnet-4' },
      { label: 'Context window', value: '200K / 1M' },
      { label: 'Input modalities', value: ['text', 'image'] },
      { label: 'Output modalities', value: ['text'] },
    ],
    variants: [
      {
        id: 'standard',
        name: '标准版',
        summary: '官方参数与默认上下文，适合大多数生产请求。',
        contextWindow: '200K',
        inputPrice: '$3 / 1M',
        outputPrice: '$15 / 1M',
        differences: ['相同模型能力', 'OpenRouter 仅作为聚合路由，不单独成为模型分类'],
        providers: [provider.anthropic, provider.openrouter],
      },
      {
        id: 'vertex-long-context',
        name: 'Vertex 长上下文版',
        summary: 'Google Vertex 部署提供更长上下文入口与云项目权限边界。',
        contextWindow: '1M',
        inputPrice: '$3 / 1M',
        outputPrice: '$15 / 1M',
        differences: ['上下文窗口可达 1M', 'Google Cloud IAM、区域与配额体系'],
        providers: [provider.vertex],
      },
      {
        id: 'bedrock-enterprise',
        name: 'Bedrock 企业版',
        summary: 'AWS Bedrock 托管入口，适合已有 AWS 采购和 VPC 合规场景。',
        contextWindow: '200K',
        inputPrice: '$3 / 1M',
        outputPrice: '$15 / 1M',
        differences: ['AWS 账号级配额', '企业网络与审计集成'],
        providers: [provider.bedrock],
      },
    ],
    benchmarks: [
      { name: 'SWE-bench', score: '72.7%', note: '公开报告中的软件工程任务表现' },
      { name: 'Agentic Coding', score: '强', note: '更稳定的多步代码编辑与检索' },
    ],
  },
  {
    tag: 'gpt-4o',
    route: '/models/gpt-4o',
    name: 'GPT-4o',
    brand: brands[1]!,
    description: 'OpenAI 多模态旗舰模型，覆盖文本、图像和实时交互场景。',
    longDescription: 'GPT-4o 是 OpenAI 的通用多模态模型。mddb.dev 将 OpenAI 官方、Azure AI Foundry 与 OpenRouter 聚合归入同一模型页，Azure 的区域合规、企业网络入口和配额体系作为 variant 差异展示。',
    modalities: ['文本', '视觉', '音频', '工具'],
    contextWindow: '128K',
    inputPrice: '$2.5 / 1M',
    outputPrice: '$10 / 1M',
    providerNames: ['Azure AI Foundry', 'OpenAI', 'OpenRouter'],
    variantCount: 2,
    weeklyTokens: '63.8B',
    releasedAt: '2024-05-13',
    apiIdentifier: 'gpt-4o',
    meta: [
      { label: 'API identifier', value: 'gpt-4o' },
      { label: 'Canonical tag', value: 'gpt-4o' },
      { label: 'Context window', value: '128K' },
      { label: 'Input modalities', value: ['text', 'image', 'audio'] },
      { label: 'Output modalities', value: ['text'] },
    ],
    variants: [
      {
        id: 'standard',
        name: '标准版',
        summary: 'OpenAI 官方能力与 OpenRouter 聚合路由共享的规范模型。',
        contextWindow: '128K',
        inputPrice: '$2.5 / 1M',
        outputPrice: '$10 / 1M',
        differences: ['相同模型能力', '聚合 provider 作为部署属性展示'],
        providers: [provider.openai, provider.openrouter],
      },
      {
        id: 'azure-global',
        name: 'Azure 企业版',
        summary: '面向 Azure 租户的企业托管入口。',
        contextWindow: '128K',
        inputPrice: '$2.5 / 1M',
        outputPrice: '$10 / 1M',
        differences: ['Azure 区域合规与企业网络入口', 'Azure 配额、账号和审计体系'],
        providers: [provider.azure],
      },
    ],
    benchmarks: [
      { name: 'MMLU', score: '88.7%', note: '通用知识能力参考' },
      { name: 'Multimodal', score: '强', note: '视觉和语音入口成熟' },
    ],
  },
  {
    tag: 'gemini-2-5-pro',
    route: '/models/gemini-2-5-pro',
    name: 'Gemini 2.5 Pro',
    brand: brands[2]!,
    description: 'Google 长上下文推理模型，适合大型文档、视频和代码库理解。',
    longDescription: 'Gemini 2.5 Pro 强调长上下文、多模态输入与推理能力。Google AI Studio、Vertex 和 OpenRouter 是同一规范模型的不同部署来源。',
    modalities: ['文本', '视觉', '视频', '工具'],
    contextWindow: '1M',
    inputPrice: '$1.25 / 1M',
    outputPrice: '$10 / 1M',
    providerNames: ['Google AI', 'Google Vertex', 'OpenRouter'],
    variantCount: 2,
    weeklyTokens: '28.1B',
    releasedAt: '2025-03-25',
    apiIdentifier: 'gemini-2.5-pro',
    meta: [
      { label: 'API identifier', value: 'gemini-2.5-pro' },
      { label: 'Canonical tag', value: 'gemini-2-5-pro' },
      { label: 'Context window', value: '1M' },
      { label: 'Input modalities', value: ['text', 'image', 'video'] },
      { label: 'Output modalities', value: ['text'] },
    ],
    variants: [
      {
        id: 'standard',
        name: '标准版',
        summary: 'Google AI 与聚合路由共享的主模型入口。',
        contextWindow: '1M',
        inputPrice: '$1.25 / 1M',
        outputPrice: '$10 / 1M',
        differences: ['相同模型能力'],
        providers: [provider.google, provider.openrouter],
      },
      {
        id: 'vertex-enterprise',
        name: 'Vertex 企业版',
        summary: '使用 Google Cloud 项目、区域和 IAM 的企业部署。',
        contextWindow: '1M',
        inputPrice: '$1.25 / 1M',
        outputPrice: '$10 / 1M',
        differences: ['Google Cloud IAM 与企业配额', '可接入 Vertex 生态工具'],
        providers: [provider.vertex],
      },
    ],
    benchmarks: [{ name: 'Long Context', score: '1M', note: '长文档与代码库分析' }],
  },
  {
    tag: 'deepseek-r1',
    route: '/models/deepseek-r1',
    name: 'DeepSeek R1',
    brand: brands[3]!,
    description: '开放推理模型，适合数学、代码和显式思维链类任务。',
    longDescription: 'DeepSeek R1 是开放生态中的代表性推理模型。不同托管方在量化、吞吐和上下文支持上可能不同，因此 mddb.dev 只在这些差异影响调用行为时拆分 variant。',
    modalities: ['文本', '推理', '工具'],
    contextWindow: '64K',
    inputPrice: '$0.55 / 1M',
    outputPrice: '$2.19 / 1M',
    providerNames: ['DeepSeek', 'OpenRouter', 'Together AI'],
    variantCount: 2,
    weeklyTokens: '39.6B',
    releasedAt: '2025-01-20',
    apiIdentifier: 'deepseek-r1',
    meta: [
      { label: 'API identifier', value: 'deepseek-r1' },
      { label: 'Canonical tag', value: 'deepseek-r1' },
      { label: 'Context window', value: '64K' },
      { label: 'Input modalities', value: ['text'] },
      { label: 'Output modalities', value: ['text'] },
    ],
    variants: [
      {
        id: 'official',
        name: '官方版',
        summary: 'DeepSeek 官方 API 与聚合入口。',
        contextWindow: '64K',
        inputPrice: '$0.55 / 1M',
        outputPrice: '$2.19 / 1M',
        differences: ['官方权重与价格基线'],
        providers: [provider.deepseek, provider.openrouter],
      },
      {
        id: 'hosted-open',
        name: '开放托管版',
        summary: '第三方托管开放权重，吞吐、量化和上下文可能不同。',
        contextWindow: '64K',
        inputPrice: '$0.80 / 1M',
        outputPrice: '$2.40 / 1M',
        differences: ['第三方托管吞吐', '可能存在量化或批处理策略差异'],
        providers: [provider.together],
      },
    ],
    benchmarks: [{ name: 'Reasoning', score: '强', note: '数学与代码推理任务' }],
  },
  {
    tag: 'llama-3-1-405b-instruct',
    route: '/models/llama-3-1-405b-instruct',
    name: 'Llama 3.1 405B Instruct',
    brand: brands[4]!,
    description: 'Meta 大规模开放指令模型，适合私有化和多 provider 竞价。',
    longDescription: 'Llama 3.1 405B Instruct 是开放权重生态中的旗舰指令模型。mddb.dev 将 provider 视为部署属性，重点展示不同托管方在吞吐、价格和上下文上的差异。',
    modalities: ['文本', '工具'],
    contextWindow: '128K',
    inputPrice: '$2.70 / 1M',
    outputPrice: '$2.70 / 1M',
    providerNames: ['Fireworks AI', 'OpenRouter', 'Together AI'],
    variantCount: 2,
    weeklyTokens: '9.4B',
    releasedAt: '2024-07-23',
    apiIdentifier: 'llama-3.1-405b-instruct',
    meta: [
      { label: 'API identifier', value: 'llama-3.1-405b-instruct' },
      { label: 'Canonical tag', value: 'llama-3-1-405b-instruct' },
      { label: 'Context window', value: '128K' },
      { label: 'Input modalities', value: ['text'] },
      { label: 'Output modalities', value: ['text'] },
    ],
    variants: [
      {
        id: 'high-throughput',
        name: '高吞吐托管版',
        summary: '第三方 serverless 托管，适合批量与在线混合负载。',
        contextWindow: '128K',
        inputPrice: '$2.70 / 1M',
        outputPrice: '$2.70 / 1M',
        differences: ['高吞吐 serverless 托管', '价格随 provider 策略变动'],
        providers: [provider.together, provider.fireworks, provider.openrouter],
      },
      {
        id: 'private',
        name: '私有化部署参考',
        summary: '开放权重允许私有化部署，价格取决于硬件与利用率。',
        contextWindow: '128K',
        inputPrice: '自定义',
        outputPrice: '自定义',
        differences: ['数据边界可控', '需要自管容量、量化和推理栈'],
        providers: [],
      },
    ],
    benchmarks: [{ name: 'Open Weights', score: '405B', note: '开放权重旗舰规模' }],
  },
]

export function listModelDetails(): ModelDetail[] {
  return modelDetails
}

export function getModelDetail(tag: string): ModelDetail | undefined {
  return modelDetails.find((model) => model.tag === tag)
}

export function buildModelGallery(): ModelGallery {
  const models = modelDetails.map(toSummary).sort((a, b) => compareReleasedDescending(a.releasedAt, b.releasedAt) || a.name.localeCompare(b.name))
  const brandsWithModels = brands
    .map((brand) => ({
      ...brand,
      models: models.filter((model) => model.brand.slug === brand.slug),
    }))
    .filter((brand) => brand.models.length > 0)

  const providerCount = new Set(modelDetails.flatMap((model) => model.providerNames)).size
  const variantCount = modelDetails.reduce((sum, model) => sum + model.variants.length, 0)

  return {
    brands: brandsWithModels,
    models,
    stats: {
      modelCount: models.length,
      brandCount: brandsWithModels.length,
      providerCount,
      variantCount,
    },
  }
}

function compareReleasedDescending(a: string, b: string): number {
  return releaseSortValue(b).localeCompare(releaseSortValue(a))
}

function releaseSortValue(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '0000-00-00'
}

function toSummary(detail: ModelDetail): ModelSummary {
  return {
    tag: detail.tag,
    route: detail.route,
    name: detail.name,
    brand: detail.brand,
    description: detail.description,
    modalities: detail.modalities,
    contextWindow: detail.contextWindow,
    inputPrice: detail.inputPrice,
    outputPrice: detail.outputPrice,
    providerNames: detail.providerNames,
    variantCount: detail.variantCount,
    weeklyTokens: detail.weeklyTokens,
    releasedAt: detail.releasedAt,
  }
}
