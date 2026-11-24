import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle, pick } from '../util.js';

const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const W = 64, H = 116;
const SEG = { a: [[0, 0], [W, 0]], b: [[W, 0], [W, H / 2]], c: [[W, H / 2], [W, H]], d: [[0, H], [W, H]], e: [[0, H / 2], [0, H]], f: [[0, 0], [0, H / 2]], g: [[0, H / 2], [W, H / 2]] };
function halves(n) {
  const ds = String(n).padStart(2, ' ').split('');
  const out = [];
  ds.forEach((d, p) => { if (d === ' ') return; for (const sg of DIG[+d]) out.push(`${p}${sg}0`, `${p}${sg}1`); });
  return out;
}
function split3(ids) {
  for (;;) { const f = [[], [], []]; ids.forEach(id => f[rint(3)].push(id)); if (f.every(x => x.length)) return f; }
}
function digitsSVG(ids, opts = {}) {
  const gap = 5, ox = [24, 24 + W + 46];
  let g = `<svg viewBox="0 0 ${W * 2 + 46 + 48} ${H + 48}" style="width:100%;max-width:420px;display:block;margin-inline:auto" role="img" aria-label="표시판">`;
  ox.forEach(x => { g += `<rect x="${x - 12}" y="12" width="${W + 24}" height="${H + 24}" rx="10" fill="none" stroke="var(--line)" stroke-dasharray="3 5"/>`; });
  ids.forEach(id => {
    const p = +id[0], sg = id[1], h = +id[2];
    const [[x1, y1], [x2, y2]] = SEG[sg];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    let A = h ? [mx, my] : [x1, y1], B = h ? [x2, y2] : [mx, my];
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    A = [A[0] + ux * gap, A[1] + uy * gap]; B = [B[0] - ux * gap, B[1] - uy * gap];
    g += `<line x1="${ox[p] + A[0]}" y1="${24 + A[1]}" x2="${ox[p] + B[0]}" y2="${24 + B[1]}" stroke="${opts.col || 'var(--seg)'}" stroke-width="9" stroke-linecap="round" style="filter:drop-shadow(0 0 6px ${opts.col || 'var(--seg)'})"/>`;
  });
  return g + '</svg>';
}

const game = {
  id: 'mixmatch', title: '믹스 앤 매치', src: '피의 게임 3', players: [1, 4], def: 4,
  glyph: `<svg viewBox="0 0 44 44"><path d="M10 8h10M8 10v10M22 10v10M10 22h10M8 24v10M10 36h10" stroke="var(--seg)" stroke-width="3" stroke-linecap="round" opacity=".9"/><path d="M26 8h10M38 10v10M38 24v10M26 36h10" stroke="var(--seg)" stroke-width="3" stroke-linecap="round" opacity=".45"/></svg>`,
  rules: [
    '노란 선 화면 6장이 3초 간격으로 한 장씩 지나간다. 지난 화면은 다시 볼 수 없다.',
    '1·3·5번째를 겹치면 숫자 하나, 2·4·6번째를 겹치면 또 하나. 각각 두 자리 이하.',
    '두 수의 합을 먼저 맞히면 1점. 틀리면 10초 동안 답할 수 없다.',
    '5라운드 후 최다 득점자 승리. 역전이 불가능해지면 콜드게임.',
  ],
  options: [{ k: 'iv', label: '화면 간격', ch: [[2000, '2초'], [3000, '3초'], [4000, '4초']], d: 3000 }],
  setup(n, o, now) { const s = { n, iv: o.iv || 3000, round: 0, rounds: 5, sc: Array(n).fill(0), over: null }; newRound(s, now); return s; },
  waiting() { return []; },
  tick(s, now) {
    if (s.phase === 'show') {
      const t = now - s.start; let vis = -1;
      if (t >= 0) { const i = Math.floor(t / s.iv); if (i < 6 && t - i * s.iv < s.iv * .82) vis = i; }
      const done = t >= 6 * s.iv;
      let ch = false;
      if (vis !== s.vis) { s.vis = vis; ch = true; }
      if (done && !s.done) { s.done = true; ch = true; }
      const lk = s.lock.map(t => now < t).join();
      if (lk !== s.lk) { s.lk = lk; ch = true; }
      if (now >= s.until) { s.phase = 'reveal'; s.got = -1; s.until = now + 5000; ch = true; }
      return ch;
    }
    if (s.phase === 'reveal' && now >= s.until) {
      const left = s.rounds - s.round, ord = range(s.n).sort((a, b) => s.sc[b] - s.sc[a]);
      const lead = s.sc[ord[0]] - (s.n > 1 ? s.sc[ord[1]] : -99);
      if (s.round >= s.rounds || (s.n > 1 && lead > left)) {
        s.over = { winners: ord.filter(i => s.sc[i] === s.sc[ord[0]]), note: s.round < s.rounds ? '콜드게임' : '', rows: ord.map(i => ({ i, v: `${s.sc[i]}점` })) };
      } else newRound(s, now);
      return true;
    }
    return false;
  },
  act(s, seat, a, now) {
    if (s.phase !== 'show' || now < s.start) return 'no';
    if (now < s.lock[seat]) return 'locked';
    const v = Math.floor(+a.answer);
    if (!Number.isFinite(v)) return 'nan';
    if (v === s.A + s.B) { s.sc[seat]++; s.got = seat; s.phase = 'reveal'; s.until = now + 5500; fx(s, 'right', { seat }); return; }
    s.lock[seat] = now + 10000; s.wrongs.push({ seat, v }); fx(s, 'wrong', { seat });
  },
  ai(s, me, now, lv) {
    if (s.phase !== 'show') return null;
    s.aip = s.aip || {};
    let p = s.aip[me];
    if (!p || p.r !== s.round || (p.used && now >= s.lock[me])) {
      const base = s.start + 6 * s.iv;
      const [lo, hi] = [[6000, 14000], [3000, 8000], [1200, 3800]][lv];
      const retry = p && p.r === s.round;
      const right = Math.random() < ([.5, .72, .9][lv] + (retry ? .15 : 0));
      const v = right ? s.A + s.B : s.A + s.B + pick([1, -1, 2, -2, 10, -10, 9, 11]);
      p = s.aip[me] = { r: s.round, t: Math.max(base, now) + rand(lo, hi) + (retry ? rand(500, 2500) : 0), v, used: false };
    }
    if (p.used || now < p.t || now < s.lock[me]) return null;
    p.used = true;
    return { a: { answer: p.v }, d: 0 };
  },
  onForm(fd, ctx, f, sub) {
    const seat = sub && sub.value !== '' ? +sub.value : ctx.actors[0];
    ctx.send(seat, { answer: +fd.get('ans') });
    f.reset();
  },
  render(ctx) {
    const s = ctx.state, f = ctx.fresh(), now = ctx.now();
    let screen;
    if (s.phase === 'reveal') {
      screen = `<div class="${f ? 'pop' : ''}" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${[s.A, s.B].map(v => `<div>${digitsSVG(halves(v))}</div>`).join('')}</div>
        <p style="text-align:center;font-family:var(--font-display);font-size:34px;margin-top:12px">${s.A} + ${s.B} = <span style="color:var(--seg)">${s.A + s.B}</span></p>`;
    } else {
      const ids = s.vis >= 0 ? s.frames[s.vis] : [];
      screen = `<div class="panel" style="background:var(--sunk);padding:28px 16px">${digitsSVG(ids)}
        <div class="row" style="justify-content:center;gap:8px;margin-top:18px">${range(6).map(i => `<span style="width:28px;height:4px;border-radius:2px;background:${i === s.vis ? 'var(--seg)' : i < s.vis || s.done ? 'var(--line-2)' : 'var(--line)'}"></span>`).join('')}</div>
        ${now < s.start ? `<p class="muted" style="text-align:center;margin-top:10px">곧 시작 <span class="timer" data-until="${s.start}"></span></p>` : ''}</div>`;
    }
    const actors = ctx.actors;
    let panel = '';
    if (s.phase === 'show' && actors.length) {
      panel = `<form class="panel" data-form="game"><h3>두 수의 합</h3><input id="mmans" data-keep="${s.round}" name="ans" type="number" inputmode="numeric" required style="width:100%;font-family:var(--font-num);font-size:26px" ${actors.length === 1 ? 'data-autofocus' : ''} aria-label="답">
        <div class="row mt">${actors.map(i => { const locked = now < s.lock[i]; return `<button class="btn ${actors.length === 1 ? 'primary' : ''}" type="submit" value="${i}" ${locked ? 'disabled' : ''} style="${actors.length > 1 ? `border-color:${pc(i)}` : ''}">${actors.length > 1 ? esc(ctx.names[i]) : '제출'}${locked ? ` <span class="timer" data-until="${s.lock[i]}"></span>` : ''}</button>`; }).join('')}</div></form>`;
    } else if (s.phase === 'reveal') panel = `<div class="panel" ${f && f.kind === 'right' ? 'data-burst=""' : ''}><h3>${s.got >= 0 ? `${esc(ctx.names[s.got])} 정답` : '정답자 없음'}</h3><p class="note">다음 라운드 <span class="timer" data-until="${s.until}"></span></p></div>`;
    const wr = s.wrongs.length ? `<div class="panel"><h3>오답</h3><div class="log">${s.wrongs.slice().reverse().map(w => `<div>${nm(ctx, w.seat)} ${w.v}</div>`).join('')}</div></div>` : '';
    return `${hud(ctx, range(s.n).map(i => ({ i, v: s.sc[i], x: now < s.lock[i] ? '잠김' : '' })))}
      <div class="status ${f && f.kind === 'wrong' ? 'shake' : ''}">${s.round} / ${s.rounds} 라운드</div>
      <div class="board-wrap"><div>${screen}</div><div class="side">${panel}${wr}</div></div>`;
  },
};

function newRound(s, now) {
  s.round++;
  const A = 1 + rint(99), B = 1 + rint(99);
  const fa = split3(halves(A)), fb = split3(halves(B));
  Object.assign(s, { A, B, frames: [fa[0], fb[0], fa[1], fb[1], fa[2], fb[2]], start: now + 3000, vis: -1, done: false, phase: 'show', until: now + 3000 + 6 * s.iv + 30000, lock: Array(s.n).fill(0), wrongs: [], got: -1 });
}

export default game;
Object.assign(game, {
  brief: (s, me) => `믹스 앤 매치 ${s.round}/${s.rounds}라운드. 점수: 너 ${s.sc[me]}, 최다 ${Math.max(...s.sc)}.`,
  summary: (s, names) => `최종 점수: ${range(s.n).map(i => `${names[i]} ${s.sc[i]}`).join(', ')}.`,
  eventText: (s, f, me, names) => f.kind === 'right' ? `${f.seat === me ? '네가' : names[f.seat] + '이(가)'} 정답(${s.A}+${s.B}=${s.A + s.B})을 맞혔다` : f.kind === 'wrong' ? `${f.seat === me ? '네가' : names[f.seat] + '이(가)'} 오답을 내서 10초 잠겼다` : null,
});
