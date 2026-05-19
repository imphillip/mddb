import { describe, expect, it } from 'vitest'
import { renderWaitingListPage, type WaitingListCandidate } from './waiting-list.js'

describe('renderWaitingListPage', () => {
  it('renders a public static review helper without embedded credentials', () => {
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

    const html = renderWaitingListPage(candidates)

    expect(html).toContain('<title>Waiting List · mddb.dev</title>')
    expect(html).toContain('候选模型审核队列')
    expect(html).toContain('不是后台管理系统')
    expect(html).toContain('localStorage')
    expect(html).toContain('lfm-40b')
    expect(html).toContain('Liquid AI')
    expect(html).toContain('建议入库')
    expect(html).toContain('建议拒绝')
    expect(html).toContain('导出本机审核标记')
    expect(html).not.toContain('data-admin-user')
    expect(html).not.toContain('data-admin-pass')
    expect(html).not.toContain('mddb-admin')
    expect(html).not.toContain('password')
  })
})
