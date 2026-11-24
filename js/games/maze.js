import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle } from '../util.js';

const N = 7, CS = 60, PAD = 10;
const D = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const DN = ['위', '오른쪽', '아래', '왼쪽'];
const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
const ek = (r1, c1, r2, c2) => r1 === r2 ? `v${r1}_${Math.min(c1, c2)}` : `h${Math.min(r1, r2)}_${c1}`;
const START = [[6, 0], [0, 0]], GOAL = [[0, 6], [6, 6]];

function allEdges() { const e = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (c < N - 1) e.push(ek(r, c, r, c + 1)); if (r < N - 1) e.push(ek(r, c, r + 1, c)); } return e; }
function path(walls, from, to, cost) {
  const dist = {}, prev = {}, key = (r, c) => r * N + c;
  const q = [[0, from[0], from[1]]]; dist[key(...from)] = 0;
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [d, r, c] = q.shift();
    if (d > dist[key(r, c)]) continue;
    if (r === to[0] && c === to[1]) break;
    for (let k = 0; k < 4; k++) {
      const x = r + D[k][0], y = c + D[k][1];
      if (!inb(x, y)) continue;
      const e = ek(r, c, x, y); if (walls[e]) continue;
      const nd = d + (cost ? cost(e) : 1);
      if (dist[key(x, y)] == null || nd < dist[key(x, y)]) { dist[key(x, y)] = nd; prev[key(x, y)] = [r, c, k]; q.push([nd, x, y]); }
    }
  }
  if (dist[key(...to)] == null) return null;
  const dirs = []; let cur = to;
  while (cur[0] !== from[0] || cur[1] !== from[1]) { const p = prev[key(...cur)]; dirs.unshift(p[2]); cur = [p[0], p[1]]; }
  return dirs;
}
function genMaze() {
  const E = allEdges();
  for (let t = 0; t < 4000; t++) {
    const walls = {}; shuffle(E.slice()).slice(0, 32).forEach(e => walls[e] = 1);
    const a = path(walls, START[0], GOAL[0]), b = path(walls, START[1], GOAL[1]);
    if (a && b && a.length === b.length && a.length >= 14 && a.length <= 20) return walls;
  }
  return {};
}

export default {
  id: 'maze', title: '기억의 미로', src: '더 지니어스: 블랙 가넷', players: [2, 2], def: 2,
  glyph: `<svg viewBox="0 0 44 44"><rect x="5" y="5" width="34" height="34" rx="3" fill="none" stroke="var(--line-2)"/><path d="M5 16h12M17 16v12M28 5v14M28 28h11" stroke="var(--line-2)" stroke-width="2.5" stroke-dasharray="3 3"/><circle cx="11" cy="33" r="4" fill="var(--p0)"/><rect x="29" y="8" width="7" height="7" rx="1.5" fill="none" stroke="var(--p0)" stroke-width="2"/></svg>`,
  rules: [
    '7×7 미로에 보이지 않는 벽 32개. 서로 반대쪽 모서리에서 출발해 대각선 끝 도착점으로.',
    '번갈아 한 턴에 정확히 3칸, 상하좌우로만. 같은 칸에 함께 있어도 된다.',
    '벽에 부딪히면 즉시 출발점으로 돌아가고 턴이 끝난다. 벽은 끝날 때까지 공개되지 않는다.',
    '더블찬스 2회: 그 턴은 반드시 6칸.',
    '먼저 도착하면 승리. 두 출발점의 최단 거리는 같다.',
  ],
  options: [{ k: 'aid', label: '부딪힌 벽 표시', ch: [[false, '끔'], [true, '켬']], d: false }],
  setup(n, o) {
    return { walls: genMaze(), aid: !!o.aid, pos: START.map(p => [...p]), turn: rint(2), steps: 0, need: 3, dbl: [2, 2], trail: [], flash: null, hits: [], open: {}, over: null, moves: [0, 0] };
  },
  waiting(s) { return s.over ? [] : [s.turn]; },
  act(s, seat, a, now) {
    if (s.turn !== seat) return 'turn';
    if (a.dbl) { if (s.steps || !s.dbl[seat] || s.need !== 3) return 'no'; s.dbl[seat]--; s.need = 6; fx(s, 'dbl'); return; }
    const d = a.dir; if (!(d >= 0 && d < 4)) return 'dir';
    const [r, c] = s.pos[seat], x = r + D[d][0], y = c + D[d][1];
    if (!inb(x, y)) return 'edge';
    const e = ek(r, c, x, y);
    s.moves[seat]++;
    if (s.walls[e]) {
      s.hits.push({ e, seat }); s.flash = { e, at: now, seat, from: [r, c], d };
      s.pos[seat] = [...START[seat]];
      fx(s, 'hit', { seat });
      endTurn(s); return;
    }
    s.open[e] = 1;
    s.pos[seat] = [x, y]; s.steps++; s.trail.push([x, y]);
    fx(s, 'step', { seat });
    if (x === GOAL[seat][0] && y === GOAL[seat][1]) {
      s.over = { winners: [seat], rows: [seat, 1 - seat].map(i => ({ i, v: i === seat ? '도착' : `${s.moves[i]}걸음` })) };
      return;
    }
    if (s.steps >= s.need) endTurn(s);
  },
  ai(s, me, now, lv) {
    if (s.over || s.turn !== me) return null;
    s.aim = s.aim || {}; const m = s.aim[me] = s.aim[me] || { seen: 0, w: {} };
    const keep = [.6, .85, 1][lv];
    for (; m.seen < s.hits.length; m.seen++) if (s.hits[m.seen].seat === me ? Math.random() < Math.min(1, keep + .15) : Math.random() < keep) m.w[s.hits[m.seen].e] = 1;
    const cost = lv === 2 ? e => (s.open[e] ? 1 : 1.3) : null;
    let dirs = path(m.w, s.pos[me], GOAL[me], cost);
    if (!dirs) { m.w = {}; dirs = path({}, s.pos[me], GOAL[me]); }
    if (s.steps === 0 && s.need === 3 && s.dbl[me] && lv > 0) {
      let cur = s.pos[me], ok = dirs.length >= 6;
      for (let i = 0; i < 6 && ok && i < dirs.length; i++) { const nx = [cur[0] + D[dirs[i]][0], cur[1] + D[dirs[i]][1]]; if (!s.open[ek(cur[0], cur[1], nx[0], nx[1])]) ok = false; cur = nx; }
      if (ok || (dirs.length <= 6 && dirs.length > 3 && Math.random() < .5)) return { a: { dbl: true }, d: 700 };
    }
    let d = dirs[0];
    if (lv === 0 && Math.random() < .15) d = rint(4);
    const [r, c] = s.pos[me];
    if (!inb(r + D[d][0], c + D[d][1])) d = dirs[0];
    return { a: { dir: d }, d: s.steps ? rand(420, 650) : rand(900, 1400) };
  },
  onKey(k, ctx) {
    const map = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
    if (!(k in map) || !ctx.actors.includes(ctx.state.turn)) return false;
    ctx.send(ctx.state.turn, { dir: map[k] }); return true;
  },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, now = ctx.now(), f = ctx.fresh();
    const myTurn = !s.over && ctx.actors.includes(s.turn);
    const W = N * CS + PAD * 2, X = c => PAD + c * CS, Y = r => PAD + r * CS;
    let svg = `<svg viewBox="0 0 ${W} ${W}" style="width:100%;max-width:520px;display:block" role="img" aria-label="미로">`;
    svg += `<rect x="${PAD - 4}" y="${PAD - 4}" width="${N * CS + 8}" height="${N * CS + 8}" rx="10" fill="var(--sunk)" stroke="var(--line-2)" stroke-width="2"/>`;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) svg += `<rect x="${X(c) + 2}" y="${Y(r) + 2}" width="${CS - 4}" height="${CS - 4}" rx="5" fill="var(--raise)"/>`;
    [0, 1].forEach(i => {
      const [gr, gc] = GOAL[i], [sr, sc] = START[i];
      svg += `<rect x="${X(gc) + 8}" y="${Y(gr) + 8}" width="${CS - 16}" height="${CS - 16}" rx="4" fill="none" stroke="${pc(i)}" stroke-width="3"/>`;
      svg += `<rect x="${X(sc) + 4}" y="${Y(sr) + 4}" width="${CS - 8}" height="${CS - 8}" rx="5" fill="${pc(i)}" fill-opacity=".1"/>`;
    });
    const showWalls = s.over ? Object.keys(s.walls) : s.aid ? [...new Set(s.hits.map(h => h.e))] : [];
    const wl = (e, extra) => { const [t, rr, cc] = [e[0], ...e.slice(1).split('_').map(Number)]; const L = t === 'v' ? [X(cc + 1), Y(rr) + 3, X(cc + 1), Y(rr + 1) - 3] : [X(cc) + 3, Y(rr + 1), X(cc + 1) - 3, Y(rr + 1)]; return `<line x1="${L[0]}" y1="${L[1]}" x2="${L[2]}" y2="${L[3]}" stroke-linecap="round" ${extra}/>`; };
    showWalls.forEach(e => { svg += wl(e, `stroke="var(--ink)" stroke-width="5" ${s.over ? 'class="pop" style="transform-box:fill-box;transform-origin:center"' : ''}`); });
    if (s.flash && now - s.flash.at < 1800) svg += wl(s.flash.e, `stroke="var(--bad)" stroke-width="7" style="animation:flash 1.8s both;animation-delay:-${now - s.flash.at}ms"`);
    s.trail.forEach(([r, c]) => { svg += `<circle cx="${X(c) + CS / 2}" cy="${Y(r) + CS / 2}" r="4" fill="${pc(s.turn)}" fill-opacity=".5"/>`; });
    [0, 1].forEach(i => {
      const [r, c] = s.pos[i], same = s.pos[0][0] === s.pos[1][0] && s.pos[0][1] === s.pos[1][1];
      const off = same ? (i ? 9 : -9) : 0, cx = X(c) + CS / 2 + off, cy = Y(r) + CS / 2;
      const isNew = f && f.seat === i;
      svg += `<g class="${isNew ? (f.kind === 'hit' ? 'pop' : '') : ''}" style="transform-box:fill-box;transform-origin:center">${isNew && f.kind === 'step' ? `<circle class="ripple" cx="${cx}" cy="${cy}" r="16" fill="none" stroke="${pc(i)}" stroke-width="2"/>` : ''}<circle cx="${cx}" cy="${cy}" r="15" fill="${pc(i)}" stroke="var(--bg)" stroke-width="3"/></g>`;
    });
    svg += '</svg>';
    const actor = s.turn;
    const pad = myTurn ? `<div class="panel"><h3>${s.need === 6 ? '더블찬스' : '이동'} <span class="muted">${s.steps}/${s.need}</span></h3>
      <div style="display:grid;grid-template-columns:repeat(3,56px);gap:6px;justify-content:center">
        <span></span><button class="btn" ${act(actor, { dir: 0 })} aria-label="위">↑</button><span></span>
        <button class="btn" ${act(actor, { dir: 3 })} aria-label="왼쪽">←</button><span></span><button class="btn" ${act(actor, { dir: 1 })} aria-label="오른쪽">→</button>
        <span></span><button class="btn" ${act(actor, { dir: 2 })} aria-label="아래">↓</button><span></span></div>
      <p class="note mt" style="text-align:center">방향키로도 움직여요</p>
      ${s.steps === 0 && s.need === 3 && s.dbl[actor] ? `<button class="btn mt" style="width:100%" ${act(actor, { dbl: true })}>더블찬스 쓰기 <span class="muted">${s.dbl[actor]}회 남음</span></button>` : ''}</div>` : '';
    const hitMsg = s.flash && now - s.flash.at < 2500 ? `<span style="color:var(--bad)">${esc(ctx.names[s.flash.seat])} 벽에 부딪힘</span>` : '';
    return `${hud(ctx, [0, 1].map(i => ({ i, v: s.dbl[i], x: '더블', turn: !s.over && s.turn === i })))}
      <div class="status ${f && f.kind === 'hit' ? 'shake' : ''}">${s.over ? '종료' : `${esc(ctx.names[s.turn])} 차례`}<small>${hitMsg}</small></div>
      <div class="board-wrap"><div>${svg}</div><div class="side">${pad}<div class="panel"><h3>걸음 수</h3>${[0, 1].map(i => `<div class="spread small"><span>${nm(ctx, i)}</span><span style="font-family:var(--font-num)">${s.moves[i]}</span></div>`).join('')}</div></div></div>`;
  },
};

function endTurn(s) { s.turn = 1 - s.turn; s.steps = 0; s.need = 3; s.trail = []; }
