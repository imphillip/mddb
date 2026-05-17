import { describe, expect, it } from 'vitest'
import { normalizeOrganization, normalizeProviderVariant, organizationRolesForNode } from './organization-normalization.mjs'

describe('organization normalization', () => {
  it('normalizes enterprise aliases across source ids and display names', () => {
    expect(normalizeOrganization('xai')).toMatchObject({ id: 'xai', name: 'xAI' })
    expect(normalizeOrganization('x-ai')).toMatchObject({ id: 'xai', name: 'xAI' })
    expect(normalizeOrganization('X Ai')).toMatchObject({ id: 'xai', name: 'xAI' })
    expect(normalizeOrganization('XAI')).toMatchObject({ id: 'xai', name: 'xAI' })
    expect(normalizeOrganization('Bytedance')).toMatchObject({ id: 'bytedance', name: 'ByteDance' })
    expect(normalizeOrganization('ByteDance Seed')).toMatchObject({ id: 'bytedance', name: 'ByteDance', teamName: 'ByteDance Seed' })
    expect(normalizeOrganization('Seed')).toMatchObject({ id: 'bytedance', name: 'ByteDance', teamName: 'ByteDance Seed' })
    expect(normalizeProviderVariant('together-fp4')).toBe('together')
  })

  it('assigns author and deployment provider roles separately for the same canonical organization', () => {
    const sourceNode = {
      nodeKind: 'source_model',
      provider: 'x-ai',
      providerName: 'X Ai',
      derived: { author: 'x-ai' },
    }
    const endpointNode = {
      nodeKind: 'endpoint_deployment',
      provider: 'xai',
      providerName: 'xAI',
      derived: { author: 'x-ai' },
    }

    expect(organizationRolesForNode(sourceNode)).toEqual([
      { role: 'author', organizationId: 'xai', sourceValue: 'x-ai' },
    ])
    expect(organizationRolesForNode(endpointNode)).toEqual([
      { role: 'author', organizationId: 'xai', sourceValue: 'x-ai' },
      { role: 'deployment_provider', organizationId: 'xai', sourceValue: 'xai' },
    ])
  })
})
