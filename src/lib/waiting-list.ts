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

export type WaitingListAuth = {
  username: string
  password: string
}

export function renderWaitingListPage(candidates: WaitingListCandidate[], auth: WaitingListAuth): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Waiting List · mddb.dev</title><style>${css}</style></head><body><main class="wrap"><section id="waitingLogin" class="login" data-admin-user="${escapeHtml(auth.username)}" data-admin-pass="${escapeHtml(auth.password)}"><div><p class="eyebrow">Admin only</p><h1>models.dev 候选审核</h1><p class="muted">输入写死管理员账密后，在本机浏览器中审核 models.dev-only 候选。审核状态保存在浏览器 localStorage；真正入库仍需后续生成代码改动。</p><label>账号<input id="waitingUser" autocomplete="username"></label><label>密码<input id="waitingPass" type="password" autocomplete="current-password"></label><button id="waitingSubmit" type="button">登录</button><p id="waitingError" class="error" hidden>账号或密码不正确。</p></div></section><section id="waitingApp" hidden><div class="head"><div><p class="eyebrow">Waiting List</p><h1>models.dev 候选审核</h1><p class="muted">${candidates.length} 个候选。这里只做审核标记，不直接污染 OpenRouter canonical 主库。</p></div><button id="waitingLogout" type="button">退出</button></div><div class="cards">${candidates.map(renderCandidate).join('')}</div></section></main><script>${script()}</script></body></html>`
}

function renderCandidate(candidate: WaitingListCandidate): string {
  return `<article class="card" data-candidate="${escapeHtml(candidate.tag)}"><div class="row"><div><h2>${escapeHtml(candidate.name)}</h2><code>${escapeHtml(candidate.tag)}</code></div><span class="badge" data-status>待审核</span></div><p><strong>Source</strong> ${escapeHtml(candidate.source ?? 'models.dev')} · ${escapeHtml(candidate.action ?? 'review')}${candidate.targetTag ? ` → <code>${escapeHtml(candidate.targetTag)}</code>` : ''}</p><p><strong>厂牌</strong> ${escapeHtml(candidate.brand)}</p><p><strong>Providers</strong> ${escapeHtml(candidate.providers.join(' · ') || '—')}</p><p><strong>Source IDs</strong> ${escapeHtml(candidate.sourceIds.join(' · ') || '—')}</p><p class="muted">${escapeHtml(candidate.reason)}</p><div class="actions"><button type="button" data-action="approve">入库</button><button type="button" data-action="reject">拒绝</button><button type="button" data-action="reset">重置</button></div></article>`
}

function script(): string {
  return String.raw`(function(){
const login=document.getElementById('waitingLogin');
const app=document.getElementById('waitingApp');
const user=document.getElementById('waitingUser');
const pass=document.getElementById('waitingPass');
const error=document.getElementById('waitingError');
function authed(){return localStorage.getItem('mddb.waitinglist.auth')==='ok'}
function show(){if(authed()){login.hidden=true;app.hidden=false}else{login.hidden=false;app.hidden=true}}
document.getElementById('waitingSubmit').addEventListener('click',()=>{
  if(user.value===login.dataset.adminUser&&pass.value===login.dataset.adminPass){localStorage.setItem('mddb.waitinglist.auth','ok');show();return}
  error.hidden=false
});
document.getElementById('waitingLogout').addEventListener('click',()=>{localStorage.removeItem('mddb.waitinglist.auth');show()});
document.querySelectorAll('[data-candidate]').forEach(card=>{
  const tag=card.dataset.candidate;
  const badge=card.querySelector('[data-status]');
  function paint(){const status=localStorage.getItem('mddb.waitinglist.'+tag)||'pending';badge.textContent=status==='approve'?'已标记入库':status==='reject'?'已拒绝':'待审核';card.dataset.status=status}
  card.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{const action=btn.dataset.action;if(action==='reset')localStorage.removeItem('mddb.waitinglist.'+tag);else localStorage.setItem('mddb.waitinglist.'+tag,action);paint()}));
  paint();
});
show();
})();`
}

const css = `body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#171717;background:#fafafa}.wrap{max-width:1100px;margin:0 auto;padding:48px 24px}.eyebrow{text-transform:uppercase;letter-spacing:.08em;color:#777;font-size:12px;font-weight:600}h1{font-size:42px;letter-spacing:-1.4px;margin:8px 0}h2{margin:0 0 6px}.muted{color:#666}.login{min-height:70vh;display:grid;place-items:center}.login>div,.card{background:#fff;border:1px solid #eaeaea;border-radius:16px;box-shadow:rgba(0,0,0,.04) 0 10px 30px;padding:24px}.login label{display:block;margin:14px 0;color:#555}.login input{display:block;width:320px;max-width:100%;height:38px;border:1px solid #ddd;border-radius:8px;padding:0 10px;margin-top:6px}.error{color:#b42318}.head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.row{display:flex;justify-content:space-between;gap:12px}.badge{background:#f5f5f5;border-radius:999px;padding:4px 9px;font-size:12px;height:max-content}.actions{display:flex;gap:8px;margin-top:16px}button{height:36px;border:1px solid #ddd;background:#fff;border-radius:8px;padding:0 12px;font-weight:600;cursor:pointer}code{background:#f5f5f5;border:1px solid #eee;border-radius:6px;padding:2px 6px}`

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
