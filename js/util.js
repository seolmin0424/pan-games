export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rint = n => Math.floor(Math.random() * n);
export const pick = a => a[rint(a.length)];
export const rand = (a, b) => a + Math.random() * (b - a);
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export const range = n => Array.from({ length: n }, (_, i) => i);
export const sum = a => a.reduce((x, y) => x + y, 0);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// data-act attribute: seat + action
export const act = (seat, a) => `data-act="${esc(JSON.stringify({ s: seat, a }))}"`;
export const ui = (k, v) => `data-ui="${esc(k)}" data-v="${esc(JSON.stringify(v ?? null))}"`;
export const pc = i => `var(--p${i % 7})`;
export const nm = (ctx, i) => `<span style="color:${pc(i)}">${esc(ctx.names[i])}</span>`;
export const until = (t, label = '') => `<span class="timer" data-until="${t}">${label}</span>`;
export const bar = (from, to) => `<div class="bar"><i data-from="${from}" data-to="${to}"></i></div>`;

// standard HUD
export function hud(ctx, items) {
  return `<div class="hud">${items.map(it => `<div class="pchip${it.turn ? ' turn' : ''}"><span class="swatch" style="background:${pc(it.i)}"></span><span class="nm">${esc(ctx.names[it.i])}${ctx.seat === it.i && ctx.names[it.i] !== '나' ? ' (나)' : ''}</span>${it.v !== undefined ? `<b>${it.v}</b>` : ''}${it.x ? `<span class="muted">${it.x}</span>` : ''}</div>`).join('')}</div>`;
}

// ranking helper: returns seats sorted by score desc
export const rankBy = (n, f) => range(n).sort((a, b) => f(b) - f(a));

// one-shot effect events kept in state: state.fx = {id, kind, ...}
export function fx(state, kind, data = {}) { state.fxid = (state.fxid || 0) + 1; state.fx = { id: state.fxid, kind, ...data }; }
