import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle } from '../util.js';

const N = 7, CS = 62, PAD = 8;
const D = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;
export const ek = (r1, c1, r2, c2) => r1 === r2 ? `v${r1}_${Math.min(c1, c2)}` : `h${Math.min(r1, r2)}_${c1}`;
const occ = (s, r, c, skip) => s.pcs.some((p, i) => i !== skip && p.r === r && p.c === c);

function movesOf(s, pi, allowBreak) {
  const p = s.pcs[pi], out = new Map();
  const add = (r, c, brk) => { const k = r + ',' + c; const prev = out.get(k); if (!prev || (prev.brk && !brk)) out.set(k, { r, c, brk }); };
  const step = (r, c, d, brk) => {
    const nr = r + D[d][0], nc = c + D[d][1];
    if (!inb(nr, nc) || occ(s, nr, nc, pi)) return null;
    const e = ek(r, c, nr, nc);
    if (s.walls[e]) { if (!allowBreak || brk) return null; return { r: nr, c: nc, brk: e }; }
    return { r: nr, c: nc, brk };
  };
  for (let d = 0; d < 4; d++) {
    const a = step(p.r, p.c, d, null);
    if (!a) continue;
    add(a.r, a.c, a.brk);
    if (p.k === 'sq') { const b = step(a.r, a.c, d, a.brk); if (b) add(b.r, b.c, b.brk); }
    else for (const t of [(d + 1) % 4, (d + 3) % 4]) { const b = step(a.r, a.c, t, a.brk); if (b) add(b.r, b.c, b.brk); }
  }
  return [...out.values()];
}
function wallSlots(s, r, c) { return range(4).map(d => [r + D[d][0], c + D[d][1]]).filter(([a, b]) => inb(a, b)).map(([a, b]) => ek(r, c, a, b)).filter(e => !s.walls[e]); }

export function regions(s) {
  const id = Array.from({ length: N }, () => Array(N).fill(-1)); const regs = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (id[r][c] >= 0) continue;
    const q = [[r, c]], cells = []; id[r][c] = regs.length;
    while (q.length) {
      const [a, b] = q.pop(); cells.push([a, b]);
      for (const [dr, dc] of D) { const x = a + dr, y = b + dc; if (inb(x, y) && id[x][y] < 0 && !s.walls[ek(a, b, x, y)]) { id[x][y] = regs.length; q.push([x, y]); } }
    }
    const owners = [...new Set(s.pcs.filter(p => p.r >= 0 && id[p.r][p.c] === regs.length).map(p => p.o))];
    regs.push({ cells, owners });
  }
  return { id, regs };
}
function scores(s, R = regions(s)) {
  const sc = Array(s.n).fill(0), closed = Array(s.n).fill(0);
  const live = s.phase === 'move';
  R.regs.forEach(g => g.owners.forEach(o => { sc[o] += g.cells.length; if (live && g.owners.length === 1) closed[o] += g.cells.length; }));
  return { sc, closed, done: live && R.regs.every(g => g.owners.length <= 1) };
}

function voronoi(s, me) {
  const dist = Array.from({ length: s.n }, () => Array.from({ length: N }, () => Array(N).fill(99)));
  for (let o = 0; o < s.n; o++) {
    const q = [];
    s.pcs.forEach(p => { if (p.o === o && p.r >= 0) { dist[o][p.r][p.c] = 0; q.push([p.r, p.c]); } });
    for (let h = 0; h < q.length; h++) { const [a, b] = q[h]; for (const [dr, dc] of D) { const x = a + dr, y = b + dc; if (inb(x, y) && dist[o][x][y] === 99 && !s.walls[ek(a, b, x, y)]) { dist[o][x][y] = dist[o][a][b] + 1; q.push([x, y]); } } }
  }
  const own = Array(s.n).fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let best = 99, who = -1, tie = false;
    for (let o = 0; o < s.n; o++) { const d = dist[o][r][c]; if (d < best) { best = d; who = o; tie = false; } else if (d === best) tie = true; }
    if (who >= 0 && !tie && best < 99) own[who]++;
  }
  return own;
}
function evalFor(s, me) {
  const R = regions(s), { sc, closed, done } = scores(s, R);
  const others = range(s.n).filter(o => o !== me);
  if (done) return 1000 + (sc[me] - Math.max(...others.map(o => sc[o]))) * 10;
  const v = voronoi(s, me);
  return (v[me] - Math.max(...others.map(o => v[o]))) + closed[me] * .6 - Math.max(...others.map(o => closed[o])) * .3;
}

const game = {
  id: 'wallgo', title: '벽바둑 2', src: '데블스 플랜: 데드 어게인', players: [2, 4], def: 3,
  glyph: `<svg viewBox="0 0 44 44"><rect x="5" y="5" width="34" height="34" rx="3" fill="none" stroke="var(--line-2)"/><path d="M5 20h16M21 20v19" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><rect x="9" y="25" width="8" height="8" rx="2" fill="var(--p0)"/><circle cx="31" cy="13" r="4.5" fill="var(--p1)"/></svg>`,
  rules: [
    '7×7 판. 사각 말은 한 방향으로 1~2칸, 원형 말은 1칸 간 뒤 좌우로 꺾어 1칸 더 갈 수 있다.',
    '말이 있는 칸, 벽은 지나갈 수 없다. 이동한 말의 상하좌우 한 면에 반드시 벽을 세운다.',
    '배치는 선부터 한 개씩, 두 번째 말은 역순.',
    '모든 플레이어의 말이 벽으로 서로 분리되면 종료. 내 말이 있는 영역 칸 수가 가장 넓은 사람이 승리.',
    '기본 룰: 말 사각1·원형1, 한 판에 한 번 벽 부수기. 2인 룰: 사각2·원형2, 원형은 고정 위치, 벽 부수기 없음.',
  ],
  options: [{ k: 'kit', label: '룰', ch: [['r1', '기본'], ['r2', '2인 룰']], d: 'r1' }],
  setup(n, o) {
    const kit = o.kit === 'r2' && n === 2 ? 'r2' : 'r1';
    const first = rint(n), ord = range(n).map(i => (first + i) % n);
    const pcs = [];
    if (kit === 'r1') range(n).forEach(i => { pcs.push({ o: i, k: 'sq', r: -1, c: -1 }, { o: i, k: 'ro', r: -1, c: -1 }); });
    else {
      const pre = [[[1, 1], [5, 5]], [[1, 5], [5, 1]]];
      range(2).forEach(i => { pcs.push({ o: i, k: 'ro', r: pre[i][0][0], c: pre[i][0][1] }, { o: i, k: 'ro', r: pre[i][1][0], c: pre[i][1][1] }, { o: i, k: 'sq', r: -1, c: -1 }, { o: i, k: 'sq', r: -1, c: -1 }); });
    }
    return { n, kit, walls: {}, pcs, phase: 'place', placeQ: [...ord, ...ord.slice().reverse()], first, turn: first, brk: Array(n).fill(kit === 'r2'), turns: 0, last: null, over: null };
  },
  waiting(s) { if (s.over) return []; return [s.phase === 'place' ? s.placeQ[0] : s.turn]; },
  act(s, seat, a) {
    if (s.phase === 'place') {
      if (s.placeQ[0] !== seat || !a.place) return 'turn';
      const { k, r, c } = a.place;
      const pi = s.pcs.findIndex(p => p.o === seat && p.k === k && p.r < 0);
      if (pi < 0 || !inb(r, c) || occ(s, r, c, -1)) return 'bad';
      Object.assign(s.pcs[pi], { r, c });
      s.placeQ.shift();
      s.last = { pi, place: true };
      if (!s.placeQ.length) { s.phase = 'move'; s.turn = s.first; }
      fx(s, 'place', { pi });
      return;
    }
    if (s.turn !== seat) return 'turn';
    const pi = a.pi, p = s.pcs[pi];
    if (!p || p.o !== seat) return 'piece';
    const anyMove = s.pcs.some((q, i) => q.o === seat && movesOf(s, i, !s.brk[seat]).length);
    let dest;
    if (a.stay) { if (anyMove) return 'must move'; dest = { r: p.r, c: p.c, brk: null }; }
    else {
      dest = movesOf(s, pi, !s.brk[seat] && a.br).find(m => m.r === a.to[0] && m.c === a.to[1] && (!!m.brk === !!a.br || !m.brk));
      if (!dest) return 'move';
    }
    const from = [p.r, p.c];
    if (dest.brk) { delete s.walls[dest.brk]; s.brk[seat] = true; }
    p.r = dest.r; p.c = dest.c;
    const slots = wallSlots(s, p.r, p.c);
    if (slots.length) { if (!slots.includes(a.wall)) { p.r = from[0]; p.c = from[1]; if (dest.brk) { s.walls[dest.brk] = 1; s.brk[seat] = false; } return 'wall'; } s.walls[a.wall] = 1; }
    s.last = { pi, from, wall: slots.length ? a.wall : null, brk: dest.brk };
    s.turns++;
    fx(s, 'move', { pi, wall: s.last.wall, brk: dest.brk });
    const { sc, done } = scores(s);
    if (done || s.turns >= 80 * s.n) {
      const ord = range(s.n).sort((x, y) => sc[y] - sc[x]);
      s.over = { winners: ord.filter(i => sc[i] === sc[ord[0]]), rows: ord.map(i => ({ i, v: `${sc[i]}칸` })) };
      return;
    }
    s.turn = (s.turn + 1) % s.n;
  },
  ai(s, me, now, lv) {
    if (s.over || this.waiting(s)[0] !== me) return null;
    if (s.phase === 'place') {
      const k = s.pcs.find(p => p.o === me && p.r < 0).k;
      let best = null, bv = -1e9;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (occ(s, r, c, -1)) continue;
        const pi = s.pcs.findIndex(p => p.o === me && p.k === k && p.r < 0);
        s.pcs[pi].r = r; s.pcs[pi].c = c;
        const v = voronoi(s, me)[me] + Math.random() * (lv === 0 ? 8 : 1.5) - (Math.abs(r - 3) + Math.abs(c - 3)) * .3;
        s.pcs[pi].r = -1; s.pcs[pi].c = -1;
        if (v > bv) { bv = v; best = { k, r, c }; }
      }
      return { a: { place: best }, d: rand(700, 1400) };
    }
    const cands = [];
    s.pcs.forEach((p, pi) => {
      if (p.o !== me) return;
      const ms = movesOf(s, pi, false);
      const useBreak = !s.brk[me] && lv === 2 ? movesOf(s, pi, true).filter(m => m.brk) : [];
      [...ms, ...useBreak].forEach(m => cands.push({ pi, m }));
    });
    if (!cands.length) {
      const pi = s.pcs.findIndex(p => p.o === me);
      const slots = wallSlots(s, s.pcs[pi].r, s.pcs[pi].c);
      return { a: { pi, stay: true, wall: slots[0] }, d: 800 };
    }
    let best = null, bv = -1e9;
    for (const { pi, m } of cands) {
      const p = s.pcs[pi], fr = p.r, fc = p.c;
      if (m.brk) delete s.walls[m.brk];
      p.r = m.r; p.c = m.c;
      const slots = wallSlots(s, m.r, m.c);
      for (const w of (slots.length ? slots : [null])) {
        if (w) s.walls[w] = 1;
        const v = evalFor(s, me) + Math.random() * (lv === 0 ? 4 : lv === 1 ? 1 : .2) - (m.brk ? 2 : 0);
        if (w) delete s.walls[w];
        if (v > bv) { bv = v; best = { pi, to: [m.r, m.c], wall: w, br: !!m.brk }; }
      }
      p.r = fr; p.c = fc;
      if (m.brk) s.walls[m.brk] = 1;
    }
    return { a: best, d: rand(800, 1600) };
  },
  onUi(k, v, ctx) {
    const u = ctx.ui;
    if (k === 'kind') u.kind = v;
    if (k === 'pc') { u.sel = u.sel === v ? null : v; u.dest = null; }
    if (k === 'dest') u.dest = v;
    if (k === 'brk') { u.brk = !u.brk; u.dest = null; }
  },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, u = ctx.ui, f = ctx.fresh();
    const myTurn = me >= 0 && this.waiting(s)[0] === me;
    if (!myTurn) { u.sel = null; u.dest = null; }
    const R = regions(s), { sc, closed } = scores(s, R);
    const W = N * CS + PAD * 2, X = c => PAD + c * CS, Y = r => PAD + r * CS;
    let svg = `<svg viewBox="0 0 ${W} ${W}" style="width:100%;max-width:560px;display:block;touch-action:manipulation" role="img" aria-label="벽바둑 판">`;
    svg += `<rect x="${PAD - 4}" y="${PAD - 4}" width="${N * CS + 8}" height="${N * CS + 8}" rx="10" fill="var(--sunk)" stroke="var(--line-2)"/>`;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const g = R.regs[R.id[r][c]];
      const tint = s.phase === 'move' && g.owners.length === 1 ?`fill:${pc(g.owners[0])};fill-opacity:.16` : 'fill:var(--raise)';
      svg += `<rect x="${X(c) + 3}" y="${Y(r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="6" style="${tint}"/>`;
    }
    // walls
    Object.keys(s.walls).forEach(e => {
      const [t, rr, cc] = [e[0], ...e.slice(1).split('_').map(Number)];
      const isNew = f && f.wall === e;
      const line = t === 'v' ? [X(cc + 1), Y(rr) + 2, X(cc + 1), Y(rr + 1) - 2] : [X(cc) + 2, Y(rr + 1), X(cc + 1) - 2, Y(rr + 1)];
      svg += `<line class="${isNew ? 'pop' : ''}" style="transform-box:fill-box;transform-origin:center" x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}" stroke="var(--ink)" stroke-width="6" stroke-linecap="round"/>`;
    });
    // last move trail
    if (s.last && s.last.from) { const p = s.pcs[s.last.pi]; svg += `<line x1="${X(s.last.from[1]) + CS / 2}" y1="${Y(s.last.from[0]) + CS / 2}" x2="${X(p.c) + CS / 2}" y2="${Y(p.r) + CS / 2}" stroke="${pc(p.o)}" stroke-opacity=".35" stroke-width="3" stroke-dasharray="4 6"/>`; }
    // move targets
    let dests = [];
    if (myTurn && s.phase === 'move' && u.sel != null) dests = movesOf(s, u.sel, !s.brk[me] && !!u.brk).filter(m => !!m.brk === !!u.brk);
    dests.forEach(m => { const on = u.dest && u.dest.r === m.r && u.dest.c === m.c; svg += `<g ${ui('dest', m)} style="cursor:pointer"><rect x="${X(m.c) + 3}" y="${Y(m.r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="6" fill="transparent"/><circle cx="${X(m.c) + CS / 2}" cy="${Y(m.r) + CS / 2}" r="${on ? 9 : 6}" fill="${m.brk ? 'var(--bad)' : 'var(--ink)'}" fill-opacity="${on ? 1 : .5}"/></g>`; });
    // pieces
    s.pcs.forEach((p, i) => {
      if (p.r < 0) return;
      let pr = p.r, pcc = p.c;
      const sel = u.sel === i, ghost = sel && u.dest;
      const cx = X(pcc) + CS / 2, cy = Y(pr) + CS / 2, col = pc(p.o);
      const isNew = f && f.pi === i;
      const clickable = myTurn && s.phase === 'move' && p.o === me;
      const shape = p.k === 'sq' ? `<rect x="${cx - 17}" y="${cy - 17}" width="34" height="34" rx="6" fill="${col}"/>` : `<circle cx="${cx}" cy="${cy}" r="18" fill="${col}"/>`;
      svg += `<g ${clickable ? ui('pc', i) : ''} class="${isNew ? 'pop' : ''}" style="transform-box:fill-box;transform-origin:center;${clickable ? 'cursor:pointer' : ''};opacity:${ghost ? .4 : 1}">${isNew ? `<circle class="ripple" cx="${cx}" cy="${cy}" r="22" fill="none" stroke="${col}" stroke-width="2"/>` : ''}${shape}${sel ? `<circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="var(--ink)" stroke-width="2"/>` : ''}</g>`;
    });
    // ghost piece + wall slots
    if (myTurn && s.phase === 'move' && u.sel != null && u.dest) {
      const p = s.pcs[u.sel], { r, c } = u.dest, cx = X(c) + CS / 2, cy = Y(r) + CS / 2, col = pc(p.o);
      svg += p.k === 'sq' ? `<rect x="${cx - 17}" y="${cy - 17}" width="34" height="34" rx="6" fill="${col}"/>` : `<circle cx="${cx}" cy="${cy}" r="18" fill="${col}"/>`;
      const tmp = { ...s, walls: { ...s.walls } }; if (u.dest.brk) delete tmp.walls[u.dest.brk];
      const slots = wallSlots(tmp, r, c);
      range(4).forEach(d => {
        const nr = r + D[d][0], nc = c + D[d][1]; if (!inb(nr, nc)) return;
        const e = ek(r, c, nr, nc); if (!slots.includes(e)) return;
        const L = d === 0 ? [X(c) + 6, Y(r), X(c + 1) - 6, Y(r)] : d === 2 ? [X(c) + 6, Y(r + 1), X(c + 1) - 6, Y(r + 1)] : d === 1 ? [X(c + 1), Y(r) + 6, X(c + 1), Y(r + 1) - 6] : [X(c), Y(r) + 6, X(c), Y(r + 1) - 6];
        svg += `<g ${act(me, { pi: u.sel, to: [r, c], wall: e, br: !!u.dest.brk })} style="cursor:pointer"><line x1="${L[0]}" y1="${L[1]}" x2="${L[2]}" y2="${L[3]}" stroke="transparent" stroke-width="22"/><line x1="${L[0]}" y1="${L[1]}" x2="${L[2]}" y2="${L[3]}" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" style="animation:glow 1.2s infinite"/></g>`;
      });
      if (!slots.length) svg += `<g ${act(me, { pi: u.sel, to: [r, c], wall: null, br: !!u.dest.brk })}><circle cx="${cx}" cy="${cy}" r="26" fill="none" stroke="var(--accent)" stroke-width="3"/></g>`;
    }
    // placement targets
    if (myTurn && s.phase === 'place') {
      const avail = [...new Set(s.pcs.filter(p => p.o === me && p.r < 0).map(p => p.k))];
      const kind = avail.includes(u.kind) ? u.kind : avail[0];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!occ(s, r, c, -1)) svg += `<rect ${act(me, { place: { k: kind, r, c } })} x="${X(c) + 3}" y="${Y(r) + 3}" width="${CS - 6}" height="${CS - 6}" rx="6" fill="var(--ink)" fill-opacity="0" style="cursor:pointer" onmouseover="this.setAttribute('fill-opacity','.08')" onmouseout="this.setAttribute('fill-opacity','0')"/>`;
    }
    svg += '</svg>';

    let panel = '';
    if (myTurn && s.phase === 'place') {
      const avail = [...new Set(s.pcs.filter(p => p.o === me && p.r < 0).map(p => p.k))];
      const kind = avail.includes(u.kind) ? u.kind : avail[0];
      panel = `<div class="panel"><h3>놓을 말</h3><div class="row">${avail.map(k => `<button class="btn ${kind === k ? 'on' : ''}" ${ui('kind', k)}>${k === 'sq' ? '사각' : '원형'}</button>`).join('')}</div><p class="note mt">빈 칸을 누르세요</p></div>`;
    } else if (myTurn) {
      const stuck = !s.pcs.some((q, i) => q.o === me && movesOf(s, i, !s.brk[me]).length);
      panel = `<div class="panel"><h3>${u.sel == null ? '말 선택' : u.dest ? '벽 세울 면 선택' : '이동할 칸 선택'}</h3>
        ${!s.brk[me] ? `<button class="btn ${u.brk ? 'on' : ''}" ${ui('brk')}>벽 부수기 ${u.brk ? '켜짐' : ''}</button>` : s.kit === 'r1' ? '<p class="note">벽 부수기 사용함</p>' : ''}
        ${stuck ? `<p class="note mt">움직일 수 있는 말이 없어요. 말을 골라 제자리에서 벽만 세우세요.</p>${s.pcs.map((q, i) => q.o === me ? `<div class="row mt"><span class="small">${q.k === 'sq' ? '사각' : '원형'}</span>${range(4).filter(d => inb(q.r + D[d][0], q.c + D[d][1]) && !s.walls[ek(q.r, q.c, q.r + D[d][0], q.c + D[d][1])]).map(d => `<button class="btn sm" ${act(me, { pi: i, stay: true, wall: ek(q.r, q.c, q.r + D[d][0], q.c + D[d][1]) })}>${['위', '오른쪽', '아래', '왼쪽'][d]}</button>`).join('')}</div>` : '').join('')}` : ''}</div>`;
    }
    const who = this.waiting(s)[0];
    const status = s.over ? '종료' : s.phase === 'place' ? `${esc(ctx.names[who])} 배치` : `${esc(ctx.names[who])} 차례`;
    return `${hud(ctx, range(s.n).map(i => ({ i, v: closed[i], x: '확보', turn: !s.over && who === i })))}
      <div class="status">${status}</div>
      <div class="board-wrap"><div>${svg}</div><div class="side">${panel}<div class="panel"><h3>영역</h3>${range(s.n).map(i => `<div class="spread small"><span>${nm(ctx, i)}</span><span style="font-family:var(--font-num)">확보 ${closed[i]}칸</span></div>`).join('')}</div></div></div>`;
  },
};

export default game;
Object.assign(game, {
  brief: (s, me) => { const { closed } = scores(s); return `벽바둑 2 (7x7). ${s.phase === 'place' ? '말 배치 중' : `${s.turns}번째 수`}. 확보한 칸: 너 ${closed[me]}, 상대 최대 ${Math.max(...closed.filter((_, i) => i !== me))}.`; },
  summary: (s, names) => { const { sc } = scores(s); return `총 ${s.turns}수. 최종 영역: ${range(s.n).map(i => `${names[i]} ${sc[i]}칸`).join(', ')}. 벽 ${Object.keys(s.walls).length}개.`; },
  myEvent: (s, i) => { const { closed } = scores(s); return `네가 말을 옮기고 벽을 세웠다. 지금 확보 ${closed[i]}칸`; },
});
