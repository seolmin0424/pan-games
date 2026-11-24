import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle, bar } from '../util.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RN = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const rn = r => RN[r] || String(r);
const HN = ['하이카드', '원페어', '투페어', '트리플', '스트레이트', '플러시', '풀하우스', '포카드', '스트레이트 플러시'];

export function evalHand(cards) {
  const rs = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  const cnt = {}; rs.forEach(r => cnt[r] = (cnt[r] || 0) + 1);
  const groups = Object.entries(cnt).map(([r, c]) => [c, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const uniq = [...new Set(rs)];
  let straight = 0;
  if (uniq.length === 5) { if (uniq[0] - uniq[4] === 4) straight = uniq[0]; else if (uniq.join() === '14,5,4,3,2') straight = 5; }
  let cat;
  if (straight && flush) cat = 8; else if (groups[0][0] === 4) cat = 7; else if (groups[0][0] === 3 && groups[1][0] === 2) cat = 6;
  else if (flush) cat = 5; else if (straight) cat = 4; else if (groups[0][0] === 3) cat = 3; else if (groups[0][0] === 2 && groups[1][0] === 2) cat = 2;
  else if (groups[0][0] === 2) cat = 1; else cat = 0;
  const key = straight ? [straight] : groups.map(g => g[1]);
  return [cat, ...key];
}
export const cmp = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; };

export const cardHTML = (c, cls = '') => `<div class="pcard ${c.s === 1 || c.s === 2 ? 'red' : ''} ${cls}"><span>${rn(c.r)}</span><span class="s">${SUITS[c.s]}&#xFE0E;</span></div>`;

export default {
  id: 'mempoker', title: '기억 포커', src: '데블스 플랜: 데드 어게인', players: [2, 4], def: 2,
  isPrivate: s => s.phase === 'pick',
  glyph: `<svg viewBox="0 0 44 44"><rect x="6" y="9" width="18" height="25" rx="3" fill="var(--card)" transform="rotate(-10 15 21)"/><rect x="20" y="9" width="18" height="25" rx="3" fill="var(--raise)" stroke="var(--line-2)" transform="rotate(8 29 21)"/><text x="10" y="24" font-size="11" fill="var(--card-red)" font-family="serif" transform="rotate(-10 15 21)">A</text></svg>`,
  rules: [
    '카드 16장이 잠깐 공개된 뒤 뒤집힌다. 위치를 외운다.',
    '공유 카드 3장이 공개되면, 16장 중 2장을 골라 5장 족보를 만든다.',
    '다 고르면 동시에 공개. 텍사스 홀덤 족보로 높은 쪽이 승점 1. 문양은 비교하지 않는다.',
  ],
  options: [
    { k: 'memo', label: '암기 시간', ch: [[10, '10초'], [20, '20초'], [30, '30초']], d: 20 },
    { k: 'goal', label: '목표 승점', ch: [[2, '2'], [3, '3'], [5, '5']], d: 3 },
  ],
  setup(n, o, now) { const s = { n, memo: o.memo || 20, goal: o.goal || 3, wins: Array(n).fill(0), round: 0, over: null }; deal(s, now); return s; },
  waiting(s) { return !s.over && s.phase === 'pick' ? range(s.n).filter(i => !s.picks[i]) : []; },
  tick(s, now) {
    if (s.phase === 'memo' && now >= s.until) { s.phase = 'pick'; s.mem = null; fx(s, 'flip'); return true; }
    if (s.phase === 'reveal' && now >= s.until) {
      const top = Math.max(...s.wins);
      if (top >= s.goal) {
        const ord = range(s.n).sort((a, b) => s.wins[b] - s.wins[a]);
        s.over = { winners: ord.filter(i => s.wins[i] === top), rows: ord.map(i => ({ i, v: `${s.wins[i]}승` })) };
      } else deal(s, now);
      return true;
    }
    return false;
  },
  act(s, seat, a, now) {
    if (s.phase !== 'pick' || s.picks[seat]) return 'no';
    const p = a.pick;
    if (!Array.isArray(p) || p.length !== 2 || p[0] === p[1] || !p.every(x => x >= 0 && x < 16)) return 'bad';
    s.picks[seat] = p;
    if (s.picks.every(Boolean)) {
      s.hands = s.picks.map(pp => evalHand([s.grid[pp[0]], s.grid[pp[1]], ...s.comm]));
      let best = [0]; range(s.n).forEach(i => { const c = cmp(s.hands[i], s.hands[best[0]]); if (i && c > 0) best = [i]; else if (i && c === 0) best.push(i); });
      s.rwin = best.length === s.n ? [] : best;
      s.rwin.forEach(i => s.wins[i]++);
      s.phase = 'reveal'; s.until = now + 6500;
      fx(s, 'reveal', { w: s.rwin });
    } else fx(s, 'picked', { seat });
  },
  ai(s, me, now, lv) {
    if (s.phase !== 'pick' || s.picks[me]) return null;
    const p = [.45, .7, .92][lv];
    s.aimem = s.aimem || {};
    const key = s.round + ':' + me;
    if (!s.aimem[key]) s.aimem[key] = range(16).filter(() => Math.random() < p);
    const known = s.aimem[key];
    let best = null, bv = null;
    for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) {
      const v = evalHand([s.grid[known[i]], s.grid[known[j]], ...s.comm]);
      if (!bv || cmp(v, bv) > 0) { bv = v; best = [known[i], known[j]]; }
    }
    if (!best) { const r = shuffle(range(16)); best = known.length ? [known[0], r.find(x => x !== known[0])] : r.slice(0, 2); }
    return { a: { pick: best }, d: rand(2500, 6000) };
  },
  onUi(k, v, ctx) {
    if (k !== 'c') return;
    const sel = ctx.ui.sel || [];
    ctx.ui.sel = sel.includes(v) ? sel.filter(x => x !== v) : sel.length >= 2 ? [sel[1], v] : [...sel, v];
  },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, now = ctx.now();
    if (ctx.ui.r !== s.round) { ctx.ui.r = s.round; ctx.ui.sel = []; }
    const sel = ctx.ui.sel || [];
    const f = ctx.fresh();
    const head = hud(ctx, range(s.n).map(i => ({ i, v: s.wins[i], x: s.phase === 'pick' ? (s.picks[i] ? '선택 완료' : '고르는 중') : '' })));
    let status = '', body = '';
    const gridWrap = inner => `<div style="display:grid;grid-template-columns:repeat(4,auto);gap:10px;justify-content:start">${inner}</div>`;
    if (s.phase === 'memo') {
      status = `외우세요 ${`<small>${'<span class="timer" data-until="' + s.until + '"></span>'}</small>`}`;
      body = `${bar(s.start, s.until)}<div class="mt">${gridWrap(s.grid.map((c, i) => `<div class="${f && f.kind === 'deal' ? 'pop' : ''}" style="animation-delay:${i * 30}ms">${cardHTML(c, 'lg')}</div>`).join(''))}</div>`;
    } else if (s.phase === 'pick') {
      const mine = me >= 0 && !s.picks[me];
      status = mine ? `2장을 고르세요<small>${sel.length}/2</small>` : '다른 사람이 고르는 중';
      body = `${gridWrap(range(16).map(i => `<button class="pcard back lg ${f && f.kind === 'flip' ? 'pop' : ''}" style="${sel.includes(i) ? 'background:var(--ink);color:var(--bg);border-color:var(--ink);transform:translateY(-4px)' : ''};animation-delay:${i * 20}ms" ${mine ? ui('c', i) : 'disabled'} aria-label="${i + 1}번">${i + 1}</button>`).join(''))}
        ${mine ? `<button class="btn primary lg mt" ${sel.length === 2 ? act(me, { pick: sel }) : 'disabled'}>확정</button>` : ''}`;
    } else {
      const winTxt = s.rwin.length ? s.rwin.map(i => esc(ctx.names[i])).join(', ') + ' 승' : '무승부';
      status = `${winTxt}<small>다음 판 <span class="timer" data-until="${s.until}"></span></small>`;
      body = `${gridWrap(s.grid.map((c, i) => { const who = range(s.n).filter(k => s.picks[k].includes(i)); return `<div style="position:relative;${who.length ? '' : 'opacity:.35'}">${cardHTML(c, 'lg')}${who.length ? `<div class="row" style="gap:3px;position:absolute;bottom:-8px;left:4px">${who.map(k => `<span class="swatch" style="background:${pc(k)};width:14px;height:14px;border:2px solid var(--bg)"></span>`).join('')}</div>` : ''}</div>`; }).join(''))}
        <div class="col mt2">${range(s.n).map(i => `<div class="panel spread ${f && s.rwin.includes(i) ? 'pop' : ''}" style="padding:12px 16px;${s.rwin.includes(i) ? 'border-color:var(--seg)' : ''}" ${f && s.rwin.includes(i) ? 'data-burst=""' : ''}><span>${nm(ctx, i)}</span><span class="row">${s.picks[i].map(k => cardHTML(s.grid[k])).join('')}</span><b>${HN[s.hands[i][0]]}</b></div>`).join('')}</div>`;
    }
    const comm = s.phase === 'memo' ? '<div class="row">' + range(3).map(() => '<div class="pcard back lg">?</div>').join('') + '</div>' : `<div class="row">${s.comm.map(c => `<div class="${f && f.kind === 'flip' ? 'drop' : ''}">${cardHTML(c, 'lg')}</div>`).join('')}</div>`;
    return `${head}<div class="status">${status}</div><div class="board-wrap"><div>${body}</div><div class="side"><div class="panel"><h3>공유 카드</h3>${comm}</div><div class="panel"><h3>${s.round}번째 판</h3><p class="note">목표 ${s.goal}승</p></div></div></div>`;
  },
};

function deal(s, now) {
  const deck = shuffle(range(52).map(i => ({ r: 2 + (i % 13), s: Math.floor(i / 13) })));
  s.grid = deck.slice(0, 16); s.comm = deck.slice(16, 19);
  s.picks = Array(s.n).fill(null); s.hands = null; s.rwin = [];
  s.phase = 'memo'; s.start = now; s.until = now + s.memo * 1000; s.round++;
  fx(s, 'deal');
}
