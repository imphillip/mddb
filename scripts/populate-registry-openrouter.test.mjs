import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')

function row(id, endpointProviderNames = [], overrides = {}) {
  return {
    id,
    canonical_slug: id,
    name: id.split('/').at(-1),
    architecture: { modality: 'text->text', tokenizer: 'Other', instruct_type: null },
    pricing: { prompt: '0.000001', completion: '0.000002' },
    supported_parameters: ['tools'],
    context_length: 4096,
    top_provider: { max_completion_tokens: 1024 },
    openrouter_endpoint_details: {
      endpoints: endpointProviderNames.map((providerName) => ({
        provider_name: providerName,
        tag: `${id}:${providerName}`,
        pricing: { prompt: '0.000001', completion: '0.000002' },
        context_length: 4096,
        max_completion_tokens: 1024,
        supported_parameters: ['tools'],
        status: 'active',
      })),
    },
    links: { endpoints: `https://openrouter.ai/api/v1/models/${id}/endpoints` },
    ...overrides,
  }
}

function populate(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'mddb-openrouter-populate-'))
  const rawPath = join(dir, 'openrouter.raw.json')
  const outDir = join(dir, 'data')
  execFileSync(process.execPath, ['-e', `require('node:fs').writeFileSync(${JSON.stringify(rawPath)}, ${JSON.stringify(JSON.stringify({ data: rows }))})`])
  execFileSync(process.execPath, ['scripts/populate-registry-openrouter.mjs'], {
    cwd: ROOT,
    env: { ...process.env, OPENROUTER_RAW_PATH: rawPath, MDDB_REGISTRY_DIR: outDir },
    stdio: 'pipe',
  })
  return {
    models: JSON.parse(readFileSync(join(outDir, 'models.json'), 'utf8')).models,
    provider(id) {
      return JSON.parse(readFileSync(join(outDir, 'providers', `${id}.json`), 'utf8'))
    },
    providerExists(id) {
      try {
        readFileSync(join(outDir, 'providers', `${id}.json`), 'utf8')
        return true
      } catch {
        return false
      }
    },
  }
}

describe('OpenRouter registry population provider normalization', () => {
  it('merges known organization aliases across authors and endpoint provider names at import time', () => {
    const catalog = populate([
      row('aion-labs/aion-1.0', ['AionLabs']),
      row('amazon/nova-lite-v1', ['Amazon Bedrock']),
      row('bytedance-seed/seed-1.6', []),
      row('google/gemini-2.5-pro', ['Google AI Studio']),
      row('mancer/weaver', ['Mancer 2']),
      row('mistralai/mistral-large', ['Mistral']),
      row('moonshotai/kimi-k2', ['Moonshot AI']),
      row('x-ai/grok-4', ['xAI']),
      row('z-ai/glm-4.5', ['Z.AI']),
    ])

    expect(catalog.models.map((model) => [model.id, model.author])).toEqual(expect.arrayContaining([
      ['aion-1.0', 'aion-labs'],
      ['nova-lite-v1', 'amazon'],
      ['seed-1.6', 'bytedance'],
      ['gemini-2.5-pro', 'google'],
      ['weaver', 'mancer'],
      ['mistral-large', 'mistral'],
      ['kimi-k2', 'moonshot-ai'],
      ['grok-4', 'xai'],
      ['glm-4.5', 'z-ai'],
    ]))

    expect(catalog.provider('aion-labs').offers).toHaveLength(1)
    expect(catalog.provider('amazon').offers).toHaveLength(1)
    expect(catalog.provider('google').offers).toHaveLength(1)
    expect(catalog.provider('mancer').offers).toHaveLength(1)
    expect(catalog.provider('mistral').offers).toHaveLength(1)
    expect(catalog.provider('moonshot-ai').offers).toHaveLength(1)
    expect(catalog.provider('xai').offers).toHaveLength(1)
    expect(catalog.provider('z-ai').offers).toHaveLength(1)

    for (const duplicate of ['aionlabs', 'amazon-bedrock', 'bytedance-seed', 'google-ai-studio', 'mancer-2', 'mistralai', 'moonshotai', 'x-ai', 'z.ai']) {
      expect(catalog.providerExists(duplicate), duplicate).toBe(false)
    }
  })

  it('stores model names without OpenRouter author prefixes so pages can compose titles from author plus model', () => {
    const catalog = populate([
      row('anthropic/claude-opus-4.7-fast', [], { name: 'Anthropic: Claude Opus 4.7 (Fast)' }),
      row('~anthropic/claude-haiku-latest', [], { name: 'Anthropic Claude Haiku Latest' }),
      row('moonshotai/kimi-k2', [], { name: 'MoonshotAI: Kimi K2' }),
      row('~moonshotai/kimi-latest', [], { name: 'MoonshotAI Kimi Latest' }),
      row('openrouter/owl-alpha', [], { name: 'Owl Alpha' }),
      row('meta-llama/llama-4-scout', [], { name: 'Meta: Llama 4 Scout' }),
      row('nousresearch/hermes-4-70b', [], { name: 'Nous: Hermes 4 70B' }),
      row('baidu/cobuddy:free', [], { name: 'Baidu Qianfan: CoBuddy (free)' }),
    ])

    expect(catalog.models.map((model) => [model.id, model.author, model.model])).toEqual(expect.arrayContaining([
      ['claude-opus-4.7-fast', 'anthropic', 'Claude Opus 4.7 (Fast)'],
      ['claude-haiku-latest', 'anthropic', 'Claude Haiku Latest'],
      ['kimi-k2', 'moonshot-ai', 'Kimi K2'],
      ['kimi-latest', 'moonshot-ai', 'Kimi Latest'],
      ['owl-alpha', 'openrouter', 'Owl Alpha'],
      ['llama-4-scout', 'meta-llama', 'Llama 4 Scout'],
      ['hermes-4-70b', 'nousresearch', 'Hermes 4 70B'],
      ['cobuddy', 'baidu', 'CoBuddy (free)'],
    ]))
  })
})
