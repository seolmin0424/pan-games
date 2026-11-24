import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle } from '../util.js';

const R = 9, C = 9, CS = 52, PAD = 8, TOTAL = 16;
const D = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // N E S W
const KINDS = { H: [1, 3], V: [0, 2], NE: [0, 1], ES: [1, 2], SW: [2, 3], WN: [3, 0] };
const KLIST = Object.keys(KINDS);
const inb = (r, c) => r >= 0 && c >= 0 && r < R && c < C;
const key = (r, c) => r + ',' + c;
const ports = k => KINDS[k];

// ---- structure analysis ----
function analyze(board) {
  // returns {dead, ends:[{r,c,d,t:[tr,tc]}], complete}
  const ends = []; let dead = false;
  for (const k in board) {
    const [r, c] = k.split(',').map(Number);
    for (const d of ports(board[k].k)) {
      const x = r + D[d][0], y = c + D[d][1];
      if (!inb(x, y)) { dead = true; continue; }
      const nb = board[key(x, y)];
      if (nb) { if (!ports(nb.k).includes((d + 2) % 4)) dead = true; }
      else ends.push({ r, c, d, t: [x, y] });
    }
  }
  let complete = false;
  if (!dead && !ends.length) {
    // single cycle?
    const keys = Object.keys(board), seen = new Set([keys[0]]), st = [keys[0]];
    while (st.length) { const k = st.pop(); const [r, c] = k.split(',').map(Number); for (const d of ports(board[k].k)) { const nk = key(r + D[d][0], c + D[d][1]); if (!seen.has(nk)) { seen.add(nk); st.push(nk); } } }
    complete = seen.size === keys.length;
    if (!complete) dead = true; // closed sub-loop can never be joined
  }
  return { dead, ends, complete };
}

// can tile kind k be placed at (r,c) consistently with neighbours?
function fits(board, r, c, k) {
  if (!inb(r, c) || board[key(r, c)]) return false;
  const ps = ports(k);
  for (let d = 0; d < 4; d++) {
    const x = r + D[d][0], y = c + D[d][1];
    const nb = inb(x, y) && board[key(x, y)];
    const wants = nb && ports(nb.k).includes((d + 2) % 4);
    if (ps.includes(d)) { if (!inb(x, y)) return false; if (nb && !wants) return false; }
    else if (wants) return false;
  }
  return true;
}

// DFS completion search. returns list of placements or null. limit nodes.
function solve(board, budget, opts = {}) {
  const b = { ...board };
  let nodes = 0; const LIM = opts.limit || 40000;
  const placed = [];
  const all = opts.all ? [] : null;
  function rec(budget) {
    if (++nodes > LIM) throw 'limit';
    const a = analyze(b);
    if (a.dead) return false;
    if (a.complete) { if (all) { all.push(placed.slice()); return false; } return true; }
    if (!budget) return false;
    // choose end: the one whose target has fewest options
    const targets = a.ends;
    // lower bound: pair ends by nearest
    let lbMax = 0;
    for (const e of targets) { let m = 99; for (const f of targets) { if (f === e) continue; const dd = Math.abs(e.t[0] - f.t[0]) + Math.abs(e.t[1] - f.t[1]) + 1; if (e.t[0] === f.t[0] && e.t[1] === f.t[1]) m = Math.min(m, 1); else m = Math.min(m, dd); } lbMax = Math.max(lbMax, m); }
    if (lbMax > budget || Math.ceil(targets.length / 2) > budget) return false;
    let pickE = null, opt = null;
    for (const e of targets) { const o = KLIST.filter(k => fits(b, e.t[0], e.t[1], k)); if (!pickE || o.length < opt.length) { pickE = e; opt = o; } if (!o.length) return false; }
    for (const k of opt) {
      const kk = key(pickE.t[0], pickE.t[1]);
      b[kk] = { k }; placed.push({ r: pickE.t[0], c: pickE.t[1], k });
      if (rec(budget - 1)) return true;
      placed.pop(); delete b[kk];
    }
    return false;
  }
  try {
    const ok = rec(budget);
    if (all) return all;
    if (!ok) return null;
    return placed;
  } catch (e) { return opts.all ? all : 'unknown'; }
}

const collinearRun = ts => {
  if (ts.length <= 1) return true;
  const rows = new Set(ts.map(t => t.r)), cols = new Set(ts.map(t => t.c));
  if (rows.size === 1) { const cs = ts.map(t => t.c).sort((a, b) => a - b); return cs.every((v, i) => !i || v === cs[i - 1] + 1); }
  if (cols.size === 1) { const rs = ts.map(t => t.r).sort((a, b) => a - b); return rs.every((v, i) => !i || v === rs[i - 1] + 1); }
  return false;
};
function adjacentOK(board, ts) {
  const have = new Set(Object.keys(board)); const left = ts.slice(); let prog = true;
  while (left.length && prog) { prog = false; for (let i = 0; i < left.length; i++) { const t = left[i]; if (D.some(([dr, dc]) => have.has(key(t.r + dr, t.c + dc)))) { have.add(key(t.r, t.c)); left.splice(i, 1); prog = true; i--; } } }
  return !left.length;
}

const game = {
  id: 'monorail', title: '모노레일', src: '더 지니어스', players: [2, 2], def: 2,
  glyph: `<svg viewBox="0 0 44 44"><path d="M8 30V18a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v6a6 6 0 0 1-6 6H8" fill="none" stroke="var(--ink)" stroke-width="3"/><rect x="14" y="26" width="16" height="8" rx="2" fill="var(--accent)"/></svg>`,
  rules: [
    '가운데 역 2개가 놓인 채 시작. 철로 타일 16장, 놓을 때 직선이나 ㄱ자 곡선을 고른다.',
    '자기 턴에 1~3장. 여러 장이면 한 줄로 나란히. 새 타일은 이미 놓인 타일과 변이 닿아야 한다.',
    '놓을 때 이어지지 않아도 되지만, 결국 놓인 모든 철로가 하나의 순환선이 되어야 한다.',
    '역에서 출발해 역으로 돌아오는 순환선을 완성한 사람이 승리.',
    '내 턴 시작에 <b>불가능</b> 선언 가능. 상대가 남은 타일로 완성하면 상대 승, 못 하면 선언자 승.',
  ],
  setup() {
    const board = {}; board[key(4, 3)] = { k: 'H', st: 1 }; board[key(4, 4)] = { k: 'H', st: 1 };
    return { board, left: TOTAL, turn: rint(2), phase: 'play', decl: -1, last: [], over: null, moves: 0 };
  },
  waiting(s) { if (s.over) return []; return [s.phase === 'play' ? s.turn : 1 - s.decl]; },
  act(s, seat, a) {
    const who = this.waiting(s)[0];
    if (seat !== who) return 'turn';
    if (a.declare) {
      if (s.phase !== 'play') return 'no';
      s.phase = 'complete'; s.decl = seat; fx(s, 'declare');
      if (!s.left) finish(s, seat, '남은 타일이 없음');
      return;
    }
    if (a.giveup) { if (s.phase !== 'complete') return 'no'; return finish(s, s.decl, '완성 포기'); }
    const ts = a.tiles;
    if (!Array.isArray(ts) || !ts.length || ts.length > s.left) return 'count';
    if (s.phase === 'play' && (ts.length > 3 || !collinearRun(ts))) return 'line';
    if (ts.some(t => !inb(t.r, t.c) || s.board[key(t.r, t.c)] || !KINDS[t.k])) return 'cell';
    if (new Set(ts.map(t => key(t.r, t.c))).size !== ts.length) return 'dup';
    if (!adjacentOK(s.board, ts)) return 'adj';
    ts.forEach(t => s.board[key(t.r, t.c)] = { k: t.k });
    s.left -= ts.length; s.last = ts.map(t => key(t.r, t.c)); s.moves++;
    fx(s, 'place');
    const an = analyze(s.board);
    if (an.complete) return finish(s, seat, '순환선 완성');
    if (s.phase === 'complete') { if (!s.left) finish(s, s.decl, '완성 실패'); return; }
    if (!s.left) return finish(s, 1 - seat, '타일 소진');
    s.turn = 1 - s.turn;
  },
  ai(s, me, now, lv) {
    if (s.over || this.waiting(s)[0] !== me) return null;
    const d = rand(1100, 2200);
    if (s.phase === 'complete') {
      const sol = solve(s.board, s.left, { limit: 120000 });
      if (Array.isArray(sol) && sol.length) return { a: { tiles: sol }, d };
      return { a: { giveup: true }, d };
    }
    const feas = solve(s.board, s.left, { limit: lv === 0 ? 4000 : 60000 });
    if (feas === null && (lv > 0 || Math.random() < .5)) return { a: { declare: true }, d };
    // immediate win
    const wins = solve(s.board, Math.min(3, s.left), { all: true, limit: 20000 }) || [];
    const w = wins.find(ts => ts.length <= 3 && collinearRun(ts));
    if (w) return { a: { tiles: w }, d };
    // candidate moves
    const cands = candidates(s.board, s.left);
    shuffle(cands);
    let best = null, bv = -1e9;
    const budget = lv === 0 ? 6 : lv === 1 ? 30 : 80;
    for (const ts of cands.slice(0, budget)) {
      const nb = { ...s.board }; ts.forEach(t => nb[key(t.r, t.c)] = { k: t.k });
      const left = s.left - ts.length;
      if (!left) continue;
      let v = Math.random();
      const f2 = solve(nb, left, { limit: 15000 });
      if (f2 === null) v -= 100;
      else {
        const ow = solve(nb, Math.min(3, left), { all: true, limit: 8000 }) || [];
        if (ow.some(x => x.length <= 3 && collinearRun(x))) v -= 50;
        if (lv === 2 && Array.isArray(f2)) { const need = f2.length; v += (need >= 4 && need <= 6) ? 2 : 0; }
      }
      if (v > bv) { bv = v; best = ts; }
    }
    if (!best || (bv < -40 && feas !== 'unknown' && lv > 0 && Math.random() < .3)) {
      if (!best) return { a: { declare: true }, d };
    }
    return { a: { tiles: best }, d };
  },
  onUi(k, v, ctx) {
    const u = ctx.ui; u.pend = u.pend || [];
    if (k === 'kind') u.kind = v;
    if (k === 'cell') {
      const i = u.pend.findIndex(t => t.r === v[0] && t.c === v[1]);
      if (i >= 0) { if (u.pend[i].k === (u.kind || 'H')) u.pend.splice(i, 1); else u.pend[i].k = u.kind || 'H'; }
      else u.pend.push({ r: v[0], c: v[1], k: u.kind || 'H' });
    }
    if (k === 'clear') u.pend = [];
    if (k === 'send') { const s = ctx.state; ctx.send(this.waiting(s)[0], { tiles: u.pend }); u.pend = []; }
  },
  onKey(k, ctx) { const m = { 1: 'H', 2: 'V', 3: 'NE', 4: 'ES', 5: 'SW', 6: 'WN' }; if (m[k]) { ctx.ui.kind = m[k]; return true; } return false; },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, u = ctx.ui, f = ctx.fresh();
    u.pend = u.pend || [];
    const who = this.waiting(s)[0];
    const myTurn = !s.over && ctx.actors.includes(who);
    if (!myTurn) u.pend = [];
    const W = C * CS + PAD * 2, H = R * CS + PAD * 2, X = c => PAD + c * CS, Y = r => PAD + r * CS;
    const pend = u.pend;
    let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:560px;display:block" role="img" aria-label="모노레일 판">`;
    svg += `<rect x="${PAD - 4}" y="${PAD - 4}" width="${C * CS + 8}" height="${R * CS + 8}" rx="10" fill="var(--felt)"/>`;
    const near = new Set(); Object.keys(s.board).concat(pend.map(t => key(t.r, t.c))).forEach(k => { const [r, c] = k.split(',').map(Number); D.forEach(([dr, dc]) => near.add(key(r + dr, c + dc))); });
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = key(r, c), clickable = myTurn && !s.board[k] && (near.has(k) || pend.some(t => t.r === r && t.c === c));
      svg += `<rect x="${X(c) + 1}" y="${Y(r) + 1}" width="${CS - 2}" height="${CS - 2}" rx="4" fill="var(--ink)" fill-opacity="${clickable ? .06 : .02}" ${clickable ? `${ui('cell', [r, c])} style="cursor:pointer"` : ''}/>`;
    }
    const tileSVG = (r, c, k, opts = {}) => {
      const cx = X(c) + CS / 2, cy = Y(r) + CS / 2, h = CS / 2;
      const pt = d => [cx + D[d][1] * h, cy + D[d][0] * h];
      const [a, b] = ports(k);
      let d;
      if ((a + 2) % 4 === b) { const p = pt(a), q = pt(b); d = `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`; }
      else { const p = pt(a), q = pt(b); const corner = [cx + (D[a][1] + D[b][1]) * h, cy + (D[a][0] + D[b][0]) * h]; d = `M${p[0]} ${p[1]}A${h} ${h} 0 0 ${(b - a + 4) % 4 === 1 ? 0 : 1} ${q[0]} ${q[1]}`; void corner; }
      const col = opts.st ? 'var(--accent)' : opts.pend ? 'var(--seg)' : 'var(--ink)';
      return `<g class="${opts.anim ? 'pop' : ''}" style="transform-box:fill-box;transform-origin:center;${opts.pend ? 'cursor:pointer' : ''}" ${opts.click || ''}>
        <rect x="${X(c) + 2}" y="${Y(r) + 2}" width="${CS - 4}" height="${CS - 4}" rx="5" fill="${opts.st ? 'var(--raise)' : 'var(--surface)'}" ${opts.pend ? 'stroke="var(--seg)" stroke-dasharray="4 3"' : ''}/>
        <path d="${d}" fill="none" stroke="${col}" stroke-width="12" stroke-opacity=".18"/>
        <path d="${d}" fill="none" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>
        ${opts.st ? `<rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" rx="2" fill="var(--accent)"/>` : ''}</g>`;
    };
    Object.entries(s.board).forEach(([k, t]) => { const [r, c] = k.split(',').map(Number); svg += tileSVG(r, c, t.k, { st: t.st, anim: f && f.kind === 'place' && s.last.includes(k) }); });
    pend.forEach(t => { svg += tileSVG(t.r, t.c, t.k, { pend: true, click: ui('cell', [t.r, t.c]) }); });
    if (s.over && s.over.loop) svg += `<rect x="${PAD - 4}" y="${PAD - 4}" width="${C * CS + 8}" height="${R * CS + 8}" rx="10" fill="none" stroke="var(--seg)" stroke-width="3" style="animation:glow 1.4s 3"/>`;
    svg += '</svg>';
    const kindBtn = k => { const p = ports(k); const pt = d => [16 + D[d][1] * 12, 16 + D[d][0] * 12]; const [a, b] = p; const P = pt(a), Q = pt(b); const dd = (a + 2) % 4 === b ? `M${P[0]} ${P[1]}L${Q[0]} ${Q[1]}` : `M${P[0]} ${P[1]}A12 12 0 0 ${(b - a + 4) % 4 === 1 ? 0 : 1} ${Q[0]} ${Q[1]}`; return `<button class="btn ${(u.kind || 'H') === k ? 'on' : ''}" style="padding:0 8px" ${ui('kind', k)} aria-label="${k}"><svg viewBox="0 0 32 32" width="28" height="28"><path d="${dd}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>`; };
    const valid = pend.length && pend.length <= s.left && (s.phase === 'complete' || (pend.length <= 3 && collinearRun(pend))) && adjacentOK(s.board, pend);
    const panel = myTurn ? `<div class="panel"><h3>${s.phase === 'complete' ? '남은 타일로 완성하기' : '타일 놓기'}</h3>
      <div class="row" style="gap:6px">${KLIST.map(kindBtn).join('')}</div>
      <p class="note mt">모양 고르고 칸을 누르기. 같은 칸을 다시 누르면 모양 변경 또는 취소.</p>
      <div class="row mt"><button class="btn primary" ${valid ? ui('send') : 'disabled'}>${pend.length || ''}장 놓기</button><button class="btn ghost" ${pend.length ? ui('clear') : 'disabled'}>지우기</button></div>
      ${s.phase === 'play' && !pend.length ? `<button class="btn mt" style="width:100%" ${act(who, { declare: true })}>불가능 선언</button>` : ''}
      ${s.phase === 'complete' ? `<button class="btn mt" style="width:100%" ${act(who, { giveup: true })}>포기</button>` : ''}</div>` : '';
    const st = s.over ? s.over.note : s.phase === 'complete' ? `${esc(ctx.names[s.decl])} 불가능 선언 — ${esc(ctx.names[who])} 완성 시도` : `${esc(ctx.names[who])} 차례`;
    return `${hud(ctx, [0, 1].map(i => ({ i, turn: !s.over && who === i })))}
      <div class="status ${f && f.kind === 'declare' ? 'pop' : ''}">${st}</div>
      <div class="board-wrap"><div>${svg}</div><div class="side">${panel}<div class="panel spread"><span class="muted">남은 타일</span><span class="big-num" style="font-size:40px">${s.left - (myTurn ? pend.length : 0)}</span></div></div></div>`;
  },
};

function finish(s, w, why) { s.over = { winners: [w], note: why, loop: why === '순환선 완성', rows: [w, 1 - w].map(i => ({ i, v: i === w ? '승' : '패' })) }; }

function candidates(board, left) {
  const a = analyze(board); const out = []; const seen = new Set();
  const push = ts => { const k = ts.map(t => key(t.r, t.c) + t.k).sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push(ts); } };
  for (const e of a.ends) {
    const ext = (b, r, c, depth, acc) => {
      for (const k of KLIST) {
        if (!fits(b, r, c, k)) continue;
        const t = { r, c, k }, nacc = [...acc, t];
        if (collinearRun(nacc)) push(nacc);
        if (depth < Math.min(3, left)) {
          const nb = { ...b, [key(r, c)]: { k } };
          const back = (() => { for (const d of ports(k)) { const x = r + D[d][0], y = c + D[d][1]; if (inb(x, y) && !nb[key(x, y)]) return [x, y]; } return null; })();
          if (back) ext(nb, back[0], back[1], depth + 1, nacc);
        }
      }
    };
    ext(board, e.t[0], e.t[1], 1, []);
  }
  if (!out.length) for (const k in board) { const [r, c] = k.split(',').map(Number); D.forEach(([dr, dc]) => KLIST.forEach(kk => { if (inb(r + dr, c + dc) && !board[key(r + dr, c + dc)]) push([{ r: r + dr, c: c + dc, k: kk }]); })); }
  return out;
}

export default game;
Object.assign(game, {
  brief: (s, me) => `모노레일. 남은 타일 ${s.left}장. ${s.phase === 'complete' ? `${s.decl === me ? '네가' : '상대가'} 불가능을 선언해서 ${s.decl === me ? '상대가' : '네가'} 완성을 시도 중` : `${s.turn === me ? '네' : '상대'} 차례`}.`,
  summary: (s, names) => `${s.over ? s.over.note : ''}. 놓인 타일 ${16 - s.left}장, ${s.moves}수. 승자 ${s.over ? names[s.over.winners[0]] : '-'}.`,
  eventText: (s, f, me, names) => f.kind === 'declare' ? `${s.decl === me ? '네가' : names[s.decl] + '이(가)'} 불가능을 선언했다. 남은 타일 ${s.left}장` : null,
  myEvent: (s, i, a) => a.declare ? '네가 불가능을 선언했다' : `네가 타일 ${a.tiles ? a.tiles.length : 0}장을 놓았다. 남은 ${s.left}장`,
});
