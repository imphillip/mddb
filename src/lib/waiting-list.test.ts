import { describe, expect, it } from 'vitest'
import { renderWaitingListPage, type WaitingListCandidate } from './waiting-list.js'

describe('renderWaitingListPage', () => {
  it('renders a static admin login gate with candidate review data', () => {
    const candidates: WaitingListCandidate[] = [
      {
        tag: 'lfm-40b',
        name: 'LFM 40B',
        brand: 'Liquid AI',
        providers: ['Liquid AI'],
        sourceIds: ['lfm-40b'],
        reason: 'distinct models.dev brand',
      },
    ]

    const html = renderWaitingListPage(candidates, { username: 'admin', password: 'mddb-admin-2026' })

    expect(html).toContain('<title>Waiting List · mddb.dev</title>')
    expect(html).toContain('id="waitingLogin"')
    expect(html).toContain('data-admin-user="admin"')
    expect(html).toContain('data-admin-pass="mddb-admin-2026"')
    expect(html).toContain('models.dev 候选审核')
    expect(html).toContain('lfm-40b')
    expect(html).toContain('Liquid AI')
    expect(html).toContain('入库')
    expect(html).toContain('拒绝')
    expect(html).toContain('localStorage.setItem')
  })
})
