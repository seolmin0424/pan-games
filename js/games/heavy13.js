import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, sum } from '../util.js';

const COLS = ['R', 'G', 'B'];
const CNAME = { R: '빨강', G: '초록', B: '파랑', W: '레인보우' };
const CVAR = { R: 'var(--red)', G: 'var(--green)', B: 'var(--blue)' };
const RAINBOW = 'conic-gradient(var(--red), var(--p2), var(--green), var(--blue), var(--p5), var(--red))';
const chipBg = c => c === 'W' ? RAINBOW : CVAR[c];
const freshSet = () => ({ cards: [0, 1, 2, 3, 4, 5, 6], chips: { R: 2, G: 2, B: 2, W: 1 } });

export default {
  id: 'heavy13', title: '무거운 13', src: '데블스 플랜: 데드 어게인', players: [3, 7], def: 5, private: true,
  glyph: `<svg viewBox="0 0 44 44"><rect x="6" y="28" width="9" height="9" rx="2" fill="var(--red)"/><rect x="6" y="18" width="9" height="9" rx="2" fill="var(--red)" opacity=".7"/><rect x="18" y="28" width="9" height="9" rx="2" fill="var(--green)"/><rect x="30" y="28" width="9" height="9" rx="2" fill="var(--blue)"/><rect x="30" y="18" width="9" height="9" rx="2" fill="var(--blue)" opacity=".7"/><rect x="30" y="8" width="9" height="9" rx="2" fill="var(--blue)" opacity=".45"/></svg>`,
  rules: [
    '빨강·초록·파랑 받침대 3개. 받침대 합이 <b>13 이상</b>이 되게 만든 사람이 그 위 큐브 개수만큼 벌점, 큐브는 다 걷히고 내 큐브만 남는다.',
    '매 라운드 바위 카드(0~6) 1장과 색 칩(빨2 초2 파2 레인보우1) 1개를 비공개로 동시에 낸다.',
    '놓는 순서: 레인보우 먼저, 그다음 숫자 큰 순, 같으면 선부터 시계 방향.',
    '레인보우는 놓을 때 받침대를 고른다. 라운드마다 한 번 패스 가능, 패스한 큐브는 맨 끝에 패스 역순으로.',
    '7라운드마다 카드·칩 리필, 받침대는 유지. 14라운드 후 벌점 적은 순. 동점이면 최근에 벌점 받은 쪽이 아래.',
  ],
  options: [{ k: 'rounds', label: '라운드', ch: [[7, '7'], [14, '14']], d: 14 }],
  isPrivate: s => s.phase === 'submit',
  setup(n, o) {
    return { n, rounds: o.rounds || 14, round: 1, start: rint(n), stands: { R: [], G: [], B: [] }, pen: Array(n).fill(0), penAt: Array(n).fill(-1), seq: 0, lastPen: -1,
      hands: range(n).map(freshSet), subs: Array(n).fill(null), phase: 'submit', queue: [], passed: [], late: false, log: [], over: null };
  },
  waiting(s) {
    if (s.over) return [];
    if (s.phase === 'submit') return range(s.n).filter(i => !s.subs[i]);
    if (s.phase === 'place') return [s.queue[0]];
    return [];
  },
  act(s, seat, a) {
    if (s.phase === 'submit') {
      if (s.subs[seat] || a.card == null) return 'no';
      const h = s.hands[seat];
      if (!h.cards.includes(a.card) || !(h.chips[a.chip] > 0)) return 'bad';
      s.subs[seat] = { card: a.card, chip: a.chip };
      if (s.subs.every(Boolean)) beginPlace(s);
      else fx(s, 'sub', { seat });
      return;
    }
    if (s.phase !== 'place' || s.queue[0] !== seat) return 'turn';
    const sub = s.subs[seat];
    if (a.pass) {
      if (s.late || s.passed.includes(seat)) return 'no';
      s.passed.push(seat); s.queue.shift();
      s.log.unshift(`${s.round}R  ${tag(s, seat)} 패스`);
      afterStep(s); fx(s, 'pass', { seat }); return;
    }
    const col = sub.chip === 'W' ? a.col : sub.chip;
    if (!COLS.includes(col)) return 'col';
    const st = s.stands[col];
    const total = sum(st) + sub.card;
    let hit = 0;
    if (total >= 13) {
      hit = st.length; s.pen[seat] += hit; s.penAt[seat] = ++s.seq; s.lastPen = seat;
      s.stands[col] = [sub.card];
      s.log.unshift(`${s.round}R  ${tag(s, seat)} ${CNAME[col]} ${sub.card} → 합 ${total}, 벌점 ${hit}`);
    } else {
      st.push(sub.card);
      s.log.unshift(`${s.round}R  ${tag(s, seat)} ${CNAME[col]}에 ${sub.card} (합 ${total})`);
    }
    s.queue.shift();
    fx(s, 'place', { seat, col, hit, total });
    afterStep(s);
  },
  ai(s, me, now, lv) {
    if (s.over) return null;
    if (s.phase === 'submit' && !s.subs[me]) return { a: aiSubmit(s, me, lv), d: rand(700, 2200) };
    if (s.phase === 'place' && s.queue[0] === me) {
      const sub = s.subs[me];
      const sums = Object.fromEntries(COLS.map(c => [c, sum(s.stands[c])]));
      let col = sub.chip;
      if (col === 'W') {
        const safe = COLS.filter(c => sums[c] + sub.card < 13);
        col = safe.length ? safe.sort((a, b) => (lv ? sums[b] - sums[a] : sums[a] - sums[b]))[0] : COLS.slice().sort((a, b) => s.stands[a].length - s.stands[b].length)[0];
      }
      const bust = sums[col] + sub.card >= 13;
      const others = s.queue.length - 1;
      if (bust && !s.late && !s.passed.includes(me) && (others > 0 || s.passed.length === 0) && s.stands[col].length > 1) return { a: { pass: true }, d: rand(600, 1300) };
      return { a: { col }, d: rand(600, 1300) };
    }
    return null;
  },
  onUi(k, v, ctx) { ctx.ui[k] = ctx.ui[k] === v ? null : v; },
  render(ctx) {
    const s = ctx.state, me = ctx.seat;
    const f = ctx.fresh();
    if (me >= 0 && s.subs[me]) { ctx.ui.card = null; ctx.ui.chip = null; }
    const nameLog = l => esc(l).replace(/§(\d+)§/g, (_, i) => nm(ctx, +i));
    const stands = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px">${COLS.map(c => {
      const st = s.stands[c], t = sum(st), hot = f && f.kind === 'place' && f.col === c;
      return `<div class="panel ${hot && f.hit ? 'shake' : ''}" style="padding:16px;border-color:${t >= 10 ? CVAR[c] : 'var(--line)'}" ${hot ? `data-burst="${f.hit ? 'var(--bad)' : ''}"` : ''}>
        <div class="spread"><span style="color:${CVAR[c]};font-weight:600">${CNAME[c]}</span><span class="big-num" style="font-size:32px;color:${t >= 10 ? CVAR[c] : 'var(--ink)'}">${t}<span class="muted" style="font-size:15px"> / 13</span></span></div>
        <div style="display:flex;flex-direction:column-reverse;gap:5px;margin-top:14px;min-height:150px;justify-content:flex-start">${st.map((v, k) => `<div class="${hot && k === st.length - 1 ? 'drop' : ''}" style="height:${18 + v * 4}px;border-radius:5px;background:${CVAR[c]};opacity:${.55 + v * .07};display:grid;place-items:center;font-family:var(--font-num);font-weight:600;color:var(--accent-ink)">${v}</div>`).join('')}</div>
        <div class="bar mt"><i style="transform:scaleX(${Math.min(1, t / 13)});background:${CVAR[c]}"></i></div>
      </div>`;
    }).join('')}</div>`;

    let action = '';
    if (s.phase === 'submit' && me >= 0 && !s.subs[me] && !s.over) {
      const h = s.hands[me], card = ctx.ui.card, chip = ctx.ui.chip;
      action = `<div class="panel"><h3>카드</h3><div class="numgrid">${range(7).map(v => `<button class="tile ${card === v ? 'sel' : ''}" ${h.cards.includes(v) ? ui('card', v) : 'disabled'}>${v}</button>`).join('')}</div>
        <h3 class="mt">칩</h3><div class="row">${['R', 'G', 'B', 'W'].map(c => `<button class="btn ${chip === c ? 'on' : ''}" ${h.chips[c] ? ui('chip', c) : 'disabled'}><span class="swatch" style="background:${chipBg(c)};border-radius:50%;width:14px;height:14px"></span>${CNAME[c]} <span class="muted">${h.chips[c]}</span></button>`).join('')}</div>
        <button class="btn primary lg mt" style="width:100%" ${card != null && chip ? act(me, { card, chip }) : 'disabled'}>제출</button></div>`;
    } else if (s.phase === 'place' && !s.over) {
      const cur = s.queue[0], sub = s.subs[cur];
      if (me === cur) {
        action = `<div class="panel"><h3>내 차례 — 카드 ${sub.card}, ${CNAME[sub.chip]}</h3><div class="row">${(sub.chip === 'W' ? COLS : [sub.chip]).map(c => `<button class="btn primary" style="background:${CVAR[c]};border-color:${CVAR[c]}" ${act(me, { col: c })}>${CNAME[c]}에 놓기 <span style="opacity:.75">→ ${sum(s.stands[c]) + sub.card}</span></button>`).join('')}
          ${!s.late && !s.passed.includes(me) ? `<button class="btn" ${act(me, { pass: true })}>패스</button>` : ''}</div></div>`;
      } else action = `<div class="panel"><p class="muted">${esc(ctx.names[cur])} 놓는 중</p></div>`;
    } else if (s.phase === 'submit' && !s.over) {
      action = `<div class="panel"><p class="muted">제출 대기: ${range(s.n).filter(i => !s.subs[i]).map(i => esc(ctx.names[i])).join(', ')}</p></div>`;
    }

    const order = s.phase === 'place' ? `<div class="panel"><h3>이번 라운드</h3><div class="col" style="gap:6px">${s.order.map(i => { const sb = s.subs[i]; const done = !s.queue.includes(i) && !s.passed.includes(i) || (s.late && !s.queue.includes(i)); return `<div class="spread small" style="opacity:${done ? .45 : 1}"><span>${nm(ctx, i)}${s.queue[0] === i ? ' ←' : ''}${s.passed.includes(i) ? ' <span class="muted">패스</span>' : ''}</span><span class="row" style="gap:6px"><span class="swatch" style="background:${chipBg(sb.chip)};border-radius:50%"></span><b style="font-family:var(--font-num)">${sb.card}</b></span></div>`; }).join('')}</div></div>` : '';

    const table = `<div class="panel"><h3>플레이어</h3><div class="col" style="gap:8px">${range(s.n).map(i => { const h = s.hands[i]; return `<div class="spread small"><span>${nm(ctx, i)}${i === s.start ? ' <span class="muted">선</span>' : ''}${i === me && ctx.names[i] !== '나' ? ' (나)' : ''}</span><span class="row" style="gap:3px">${range(7).map(v => `<span style="font-family:var(--font-num);font-size:12px;color:${h.cards.includes(v) ? 'var(--ink-2)' : 'var(--line-2)'}">${v}</span>`).join('')}</span><b style="font-family:var(--font-num);color:${s.pen[i] ? 'var(--bad)' : 'var(--muted)'}">${s.pen[i]}</b></div>`; }).join('')}</div></div>`;

    return `<div class="status">${s.round} / ${s.rounds} 라운드<small>${s.phase === 'submit' ? '카드와 칩 제출' : '배치'}</small></div>
      <div class="board-wrap"><div class="col" style="gap:16px">${stands}${action}</div>
      <div class="side">${order}${table}<div class="panel"><h3>기록</h3><div class="log">${s.log.slice(0, 30).map(l => `<div>${nameLog(l)}</div>`).join('') || '<span class="muted">-</span>'}</div></div></div></div>`;
  },
};

const tag = (s, i) => `§${i}§`;

function beginPlace(s) {
  const n = s.n, rel = i => (i - s.start + n) % n;
  const ord = range(n).sort((a, b) => {
    const A = s.subs[a], B = s.subs[b];
    if ((A.chip === 'W') !== (B.chip === 'W')) return A.chip === 'W' ? -1 : 1;
    if (A.card !== B.card) return B.card - A.card;
    return rel(a) - rel(b);
  });
  s.order = ord; s.queue = ord.slice(); s.passed = []; s.late = false; s.phase = 'place';
  range(n).forEach(i => { const h = s.hands[i], sb = s.subs[i]; h.cards = h.cards.filter(c => c !== sb.card); h.chips[sb.chip]--; });
  fx(s, 'reveal');
}

function afterStep(s) {
  if (s.queue.length) return;
  if (!s.late && s.passed.length) { s.late = true; s.queue = s.passed.slice().reverse(); return; }
  // round end
  if (s.lastPen >= 0) s.start = s.lastPen;
  s.round++; s.subs = Array(s.n).fill(null); s.phase = 'submit'; s.passed = []; s.late = false;
  if (s.round > s.rounds) {
    const ord = range(s.n).sort((a, b) => s.pen[a] - s.pen[b] || s.penAt[a] - s.penAt[b]);
    const best = ord.filter(i => s.pen[i] === s.pen[ord[0]] && s.penAt[i] === s.penAt[ord[0]]);
    s.over = { winners: best, rows: ord.map(i => ({ i, v: `벌점 ${s.pen[i]}` })) };
    return;
  }
  if ((s.round - 1) % 7 === 0) s.hands = range(s.n).map(freshSet);
}

function aiSubmit(s, me, lv) {
  const h = s.hands[me], n = s.n;
  const sums = Object.fromEntries(COLS.map(c => [c, sum(s.stands[c])]));
  let best = null, bs = Infinity;
  for (const card of h.cards) for (const chip of ['R', 'G', 'B', 'W']) {
    if (!h.chips[chip]) continue;
    const before = (n - 1) * ((6 - card) / 6) * (chip === 'W' ? .1 : 1);
    const per = before * 3 / 3;
    const cols = chip === 'W' ? COLS : [chip];
    let cost = Infinity;
    for (const c of cols) {
      const exp = sums[c] + per + card;
      const len = s.stands[c].length + before / 3;
      const risk = exp >= 13 ? len : exp >= 10 ? len * (exp - 9) / 4 : 0;
      cost = Math.min(cost, risk);
    }
    cost += (chip === 'W' ? 1.2 : 0) + (card === 0 ? .9 : 0) + (lv === 0 ? Math.random() * 3 : Math.random() * .6);
    if (cost < bs) { bs = cost; best = { card, chip }; }
  }
  return best;
}
