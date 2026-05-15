export type WaitingListCandidate = {
  source?: 'models.dev' | 'basellm' | undefined
  action?: 'review' | 'alias' | 'variant' | 'reject' | undefined
  targetTag?: string | undefined
  tag: string
  name: string
  brand: string
  providers: string[]
  sourceIds: string[]
  reason: string
}

export function renderWaitingListPage(candidates: WaitingListCandidate[]): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Waiting List · mddb.dev</title><style>${css}</style></head><body><main class="wrap"><section class="head"><div><p class="eyebrow">Waiting List</p><h1>候选模型审核队列</h1><p class="muted">${candidates.length} 个候选。这个页面是静态审核辅助工具，只展示从公开数据源推导出的候选项；审核标记仅保存在当前浏览器 localStorage，不会写入仓库、服务器或 canonical 主库。</p></div></section><section class="notice"><strong>公开说明</strong><p>Waiting List 不是后台管理系统，也不包含任何管理员账号或密码。真正入库需要通过代码、数据文件和 Pull Request 审核完成。</p></section><div class="toolbar"><button id="waitingExport" type="button">导出本机审核标记</button><button id="waitingClear" type="button">清空本机标记</button></div><div class="cards">${candidates.map(renderCandidate).join('')}</div></main><script>${script()}</script></body></html>`
}

function renderCandidate(candidate: WaitingListCandidate): string {
  return `<article class="card" data-candidate="${escapeHtml(candidate.tag)}"><div class="row"><div><h2>${escapeHtml(candidate.name)}</h2><code>${escapeHtml(candidate.tag)}</code></div><span class="badge" data-status>待审核</span></div><p><strong>Source</strong> ${escapeHtml(candidate.source ?? 'models.dev')} · ${escapeHtml(candidate.action ?? 'review')}${candidate.targetTag ? ` → <code>${escapeHtml(candidate.targetTag)}</code>` : ''}</p><p><strong>厂牌</strong> ${escapeHtml(candidate.brand)}</p><p><strong>Providers</strong> ${escapeHtml(candidate.providers.join(' · ') || '—')}</p><p><strong>Source IDs</strong> ${escapeHtml(candidate.sourceIds.join(' · ') || '—')}</p><p class="muted">${escapeHtml(candidate.reason)}</p><div class="actions"><button type="button" data-action="approve">建议入库</button><button type="button" data-action="reject">建议拒绝</button><button type="button" data-action="reset">重置</button></div></article>`
}

function script(): string {
  return String.raw`(function(){
const cards=Array.from(document.querySelectorAll('[data-candidate]'));
function key(tag){return 'mddb.waitinglist.'+tag}
function paint(card){const tag=card.dataset.candidate;const badge=card.querySelector('[data-status]');const status=localStorage.getItem(key(tag))||'pending';badge.textContent=status==='approve'?'建议入库':status==='reject'?'建议拒绝':'待审核';card.dataset.status=status}
cards.forEach(card=>{
  card.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{const action=btn.dataset.action;const tag=card.dataset.candidate;if(action==='reset')localStorage.removeItem(key(tag));else localStorage.setItem(key(tag),action);paint(card)}));
  paint(card);
});
document.getElementById('waitingExport').addEventListener('click',async(event)=>{
  const rows=cards.map(card=>({tag:card.dataset.candidate,status:localStorage.getItem(key(card.dataset.candidate))||'pending'}));
  const text=JSON.stringify(rows,null,2);
  try{await navigator.clipboard.writeText(text);event.currentTarget.textContent='已复制 JSON'}catch(error){const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mddb-waitinglist-review.json';a.click();URL.revokeObjectURL(url)}
});
document.getElementById('waitingClear').addEventListener('click',()=>{cards.forEach(card=>localStorage.removeItem(key(card.dataset.candidate)));cards.forEach(paint)});
})();`
}

const css = `body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#171717;background:#fafafa}.wrap{max-width:1100px;margin:0 auto;padding:48px 24px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:#777;font-size:12px;font-weight:600}h1{font-size:42px;letter-spacing:-1.4px;margin:8px 0}h2{margin:0 0 6px}.muted{color:#666}.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:18px}.notice,.card{background:#fff;border:1px solid #eaeaea;border-radius:16px;box-shadow:rgba(0,0,0,.04) 0 10px 30px;padding:24px}.notice{margin-bottom:18px}.notice p{margin-bottom:0;color:#666}.toolbar{display:flex;gap:8px;margin:0 0 18px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.row{display:flex;justify-content:space-between;gap:12px}.badge{background:#f5f5f5;border-radius:999px;padding:4px 9px;font-size:12px;height:max-content}.actions{display:flex;gap:8px;margin-top:16px}button{height:36px;border:1px solid #ddd;background:#fff;border-radius:8px;padding:0 12px;font-weight:600;cursor:pointer}code{background:#f5f5f5;border:1px solid #eee;border-radius:6px;padding:2px 6px}[data-status="approve"]{border-color:#b7ebc6;background:#effcf3}[data-status="reject"]{border-color:#ffd0d0;background:#fff5f5}`

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
