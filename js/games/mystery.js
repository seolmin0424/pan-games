import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle, bar, pick } from '../util.js';

const gcd = (a, b) => b ? gcd(b, a % b) : a;
const ds = v => String(Math.abs(v)).split('').reduce((x, y) => x + +y, 0);
const mx = Math.max, mn = Math.min;
export const RULES = [
  ['두 수의 합', (a, b) => a + b],
  ['두 수의 곱', (a, b) => a * b],
  ['두 수의 차', (a, b) => Math.abs(a - b)],
  ['큰 수 + 두 수의 차', (a, b) => mx(a, b) + Math.abs(a - b)],
  ['큰 수를 작은 수로 나눈 나머지', (a, b) => mx(a, b) % mn(a, b)],
  ['큰 수를 작은 수로 나눈 몫', (a, b) => Math.floor(mx(a, b) / mn(a, b))],
  ['곱 − 합', (a, b) => a * b - a - b],
  ['합 × 2', (a, b) => (a + b) * 2],
  ['앞 수 × 2 + 뒤 수', (a, b) => 2 * a + b],
  ['앞 수 − 뒤 수', (a, b) => a - b],
  ['두 수를 이어 붙이기', (a, b) => +(`${a}${b}`)],
  ['모든 자릿수의 합', (a, b) => ds(a) + ds(b)],
  ['곱의 일의 자리', (a, b) => (a * b) % 10],
  ['합의 일의 자리', (a, b) => (a + b) % 10],
  ['최대공약수', (a, b) => gcd(a, b)],
  ['최소공배수', (a, b) => a * b / gcd(a, b)],
  ['합 + 곱', (a, b) => a + b + a * b],
  ['앞 수의 제곱 − 뒤 수', (a, b) => a * a - b],
  ['작은 수 × 2', (a, b) => mn(a, b) * 2],
  ['평균 (소수점 버림)', (a, b) => Math.floor((a + b) / 2)],
  ['큰 수 × 2 − 작은 수 × 3', (a, b) => mx(a, b) * 2 - mn(a, b) * 3],
  ['앞 수 × 뒤 수의 일의 자리', (a, b) => a * (b % 10)],
];
const ITEMS = { D: 'DOUBLE', S: 'SECRET', F: '무감점' };

export default {
  id: 'mystery', title: '미스터리 사인', src: '더 지니어스: 그랜드 파이널', players: [2, 4], def: 2,
  glyph: `<svg viewBox="0 0 44 44"><text x="22" y="30" text-anchor="middle" font-size="24" font-family="serif" font-weight="700" fill="var(--accent)">?</text><circle cx="22" cy="22" r="16" fill="none" stroke="var(--line-2)" stroke-width="2"/></svg>`,
  rules: [
    '문제 <b>X ? Y</b>의 ?는 숨겨진 연산. 정답은 X ? Y의 값.',
    '힌트: 두 사람이 숫자를 하나씩 내면(먼저 낸 수가 앞) 같은 연산의 결과가 공개된다. 문제의 두 수를 함께 쓸 수는 없다.',
    '힌트가 나올 때마다 버저를 눌러 답할 수 있다. 정답 +1, 오답 −1 그리고 기회는 상대에게.',
    '힌트 16개까지. 아이템은 게임당 한 번씩, 라운드 시작 전에: DOUBLE(점수 2배), SECRET(첫 힌트에서 내 숫자 비공개), 무감점(오답 감점 없음).',
  ],
  options: [
    { k: 'rounds', label: '라운드', ch: [[5, '5'], [7, '7'], [11, '11']], d: 7 },
    { k: 'win', label: '버저 시간', ch: [[15, '15초'], [30, '30초'], [60, '60초']], d: 30 },
  ],
  setup(n, o, now) {
    const s = { n, rounds: o.rounds || 7, win: o.win || 30, round: 0, sc: Array(n).fill(0), items: range(n).map(() => ({ D: 1, S: 1, F: 1 })), starter: rint(n), ruleBag: shuffle(range(RULES.length)), over: null };
    newRound(s, now); return s;
  },
  waiting(s) {
    if (s.over) return [];
    if (s.phase === 'items') return range(s.n).filter(i => !s.use[i]);
    if (s.phase === 'h1') return [s.giver[0]];
    if (s.phase === 'h2') return [s.giver[1]];
    if (s.phase === 'answer') return [s.ans];
    return [];
  },
  isPrivate: s => s.phase === 'items',
  tick(s, now) {
    if (s.phase === 'buzz' && now >= s.until) { nextHint(s, now); return true; }
    if (s.phase === 'answer' && now >= s.until) { wrong(s, s.ans, now); return true; }
    if (s.phase === 'reveal' && now >= s.until) { s.round >= s.rounds ? end(s) : newRound(s, now); return true; }
    return false;
  },
  act(s, seat, a, now) {
    if (s.phase === 'items') {
      if (s.use[seat]) return 'done';
      const u = {}; for (const k of 'DSF') if (a.items && a.items[k] && s.items[seat][k]) { u[k] = 1; s.items[seat][k] = 0; }
      s.use[seat] = u;
      if (s.use.every(Boolean)) { s.phase = 'h1'; fx(s, 'start'); }
      return;
    }
    if (s.phase === 'h1' || s.phase === 'h2') {
      const st = s.phase === 'h1' ? 0 : 1;
      if (seat !== s.giver[st]) return 'turn';
      const v = Math.floor(+a.num);
      if (!(v >= 1 && v <= 99)) return 'range';
      if (st === 0) { s.pend = v; s.phase = 'h2'; fx(s, 'h1'); return; }
      const A = s.pend, B = v;
      if ((A === s.X && B === s.Y) || (A === s.Y && B === s.X)) return 'pair';
      const k = s.hints.length;
      const hid = k === 0 ? s.giver.filter(g => s.use[g] && s.use[g].S) : [];
      s.hints.push({ a: A, b: B, r: RULES[s.rule][1](A, B), by: [...s.giver], hid });
      s.phase = 'buzz'; s.until = now + s.win * 1000; s.from = now; s.excl = []; s.passed = [];
      fx(s, 'hint');
      return;
    }
    if (s.phase === 'buzz') {
      if (s.excl.includes(seat)) return 'locked';
      if (a.buzz) { s.phase = 'answer'; s.ans = seat; s.from = now; s.until = now + 20000; fx(s, 'buzz', { seat }); return; }
      if (a.pass) {
        if (!s.passed.includes(seat)) s.passed.push(seat);
        if (range(s.n).every(i => s.excl.includes(i) || s.passed.includes(i))) nextHint(s, now);
        return;
      }
      return 'no';
    }
    if (s.phase === 'answer') {
      if (seat !== s.ans) return 'turn';
      if (+a.answer === s.answer) {
        const g = s.use[seat].D ? 2 : 1; s.sc[seat] += g;
        s.got = seat; s.phase = 'reveal'; s.from = now; s.until = now + 7000;
        fx(s, 'right', { seat }); return;
      }
      s.lastWrong = { seat, v: +a.answer };
      wrong(s, seat, now); return;
    }
    return 'no';
  },
  ai(s, me, now, lv) {
    if (s.over) return null;
    s.aik = s.aik || {};
    if (!s.aik[me]) s.aik[me] = range(RULES.length).filter(() => Math.random() < [.6, .85, 1][lv]);
    const known = s.aik[me];
    if (s.phase === 'items' && !s.use[me]) {
      const left = s.rounds - s.round + 1, it = s.items[me], beh = Math.max(...s.sc) - s.sc[me];
      const pickIt = k => it[k] && (left <= 1 || Math.random() < 1 / left + (k === 'D' && beh > 0 ? .2 : 0));
      return { a: { items: { D: pickIt('D'), S: pickIt('S'), F: pickIt('F') } }, d: rand(600, 1500) };
    }
    const cons = known.filter(i => s.hints.every(h => (h.hid.length && h.hid.some(x => x !== me)) || RULES[i][1](h.a, h.b) === h.r));
    const answers = cons.map(i => RULES[i][1](s.X, s.Y));
    const uniq = [...new Set(answers)];
    if ((s.phase === 'h1' || s.phase === 'h2') && this.waiting(s)[0] === me) {
      if (s.phase === 'h1') { let v; do v = 2 + rint(lv === 2 ? 25 : 40); while (v === s.X || v === s.Y); return { a: { num: v }, d: rand(900, 1800) }; }
      const A = s.pend, hidA = s.hints.length === 0 && s.use[s.giver[0]].S;
      let best = 1 + rint(30), bv = -1;
      if (!hidA) for (let v = 1; v <= 40; v++) { if ((A === s.X && v === s.Y) || (A === s.Y && v === s.X)) continue; const g = new Set(cons.map(i => RULES[i][1](A, v))).size + Math.random() * .5; if (g > bv) { bv = g; best = v; } }
      if ((A === s.X && best === s.Y) || (A === s.Y && best === s.X)) best = best + 1;
      return { a: { num: best }, d: rand(900, 1800) };
    }
    if (s.phase === 'buzz' && !s.excl.includes(me) && !s.passed.includes(me)) {
      const sure = uniq.length === 1 && cons.length > 0;
      const gamble = lv === 2 && uniq.length === 2 && s.hints.length >= 4 && Math.random() < .5;
      const delay = [[6000, 11000], [3000, 7000], [1500, 3500]][lv];
      if (sure || gamble) return { a: { buzz: true }, d: rand(...delay) };
      return { a: { pass: true }, d: rand(2500, 4500) };
    }
    if (s.phase === 'answer' && s.ans === me) {
      const cnt = {}; answers.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
      const v = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      return { a: { answer: v != null ? +v : rint(50) }, d: rand(1200, 2500) };
    }
    return null;
  },
  onUi(k, v, ctx) { if (k === 'it') { ctx.ui.it = ctx.ui.it || {}; ctx.ui.it[v] = !ctx.ui.it[v]; } },
  onForm(fd, ctx) {
    const seat = +fd.get('s');
    if (fd.has('num')) ctx.send(seat, { num: +fd.get('num') });
    if (fd.has('ans')) ctx.send(seat, { answer: +fd.get('ans') });
  },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, f = ctx.fresh();
    const view = me;
    const hv = (h, side) => (h.hid.includes(h.by[side]) && view !== h.by[side] && !s.over && s.phase !== 'reveal') ? '?' : (side ? h.b : h.a);
    const tags = i => s.use[i] ? Object.keys(s.use[i]).map(k => ITEMS[k]).join(' ') : '';
    let actHTML = '';
    const actors = ctx.actors;
    const numForm = (seat, label) => `<form class="panel" data-form="game"><h3>${label}</h3><input type="hidden" name="s" value="${seat}"><div class="row"><input id="mnum${seat}" data-keep="${s.round}-${s.hints.length}-${s.phase}" name="num" type="number" min="1" max="99" required style="width:120px;font-family:var(--font-num);font-size:22px" data-autofocus><button class="btn primary" type="submit">내기</button></div></form>`;
    if (s.phase === 'items') {
      const mine = me >= 0 && !s.use[me];
      if (mine) { const it = ctx.ui.it || {}; actHTML = `<div class="panel"><h3>이번 라운드 아이템</h3><div class="row">${'DSF'.split('').map(k => `<button class="btn ${it[k] ? 'on' : ''}" ${s.items[me][k] ? ui('it', k) : 'disabled'}>${ITEMS[k]}</button>`).join('')}</div><button class="btn primary mt" ${act(me, { items: it })}>확인</button></div>`; }
      else actHTML = `<div class="panel"><p class="muted">아이템 선택 중</p></div>`;
    } else if (s.phase === 'h1' || s.phase === 'h2') {
      const g = s.giver[s.phase === 'h1' ? 0 : 1];
      if (actors.includes(g)) actHTML = numForm(g, s.phase === 'h1' ? '앞 숫자' : `뒤 숫자 — 앞은 ${s.hints.length === 0 && s.use[s.giver[0]].S && g !== s.giver[0] ? '?' : s.pend}`);
      else actHTML = `<div class="panel"><p class="muted">${esc(ctx.names[g])} 숫자 고르는 중</p></div>`;
    } else if (s.phase === 'buzz') {
      const can = actors.filter(i => !s.excl.includes(i));
      actHTML = `<div class="panel"><div class="spread"><h3 style="margin:0">버저</h3><span class="timer" data-until="${s.until}"></span></div><div class="mt">${bar(s.from, s.until)}</div>
        <div class="row mt">${can.map(i => `<button class="btn primary lg" ${act(i, { buzz: true })}>${actors.length > 1 ? esc(ctx.names[i]) + ' ' : ''}정답!</button>`).join('')}
        ${can.filter(i => !s.passed.includes(i)).map(i => `<button class="btn" ${act(i, { pass: true })}>${actors.length > 1 ? esc(ctx.names[i]) + ' ' : ''}다음 힌트</button>`).join('')}</div>
        ${s.lastWrong && s.excl.length ? `<p class="note mt">${esc(ctx.names[s.lastWrong.seat])} 오답 ${s.lastWrong.v}</p>` : ''}</div>`;
    } else if (s.phase === 'answer') {
      if (actors.includes(s.ans)) actHTML = `<form class="panel" data-form="game"><div class="spread"><h3 style="margin:0">정답은?</h3><span class="timer" data-until="${s.until}"></span></div><input type="hidden" name="s" value="${s.ans}"><div class="row mt"><input id="mans" data-keep="${s.round}-${s.hints.length}-${s.ans}" name="ans" type="number" required style="width:140px;font-family:var(--font-num);font-size:22px" data-autofocus><button class="btn primary" type="submit">제출</button></div></form>`;
      else actHTML = `<div class="panel"><p><span style="color:${pc(s.ans)}">${esc(ctx.names[s.ans])}</span> 답하는 중</p></div>`;
    } else if (s.phase === 'reveal') {
      actHTML = `<div class="panel ${f ? 'pop' : ''}" ${f && f.kind === 'right' ? 'data-burst=""' : ''}><h3>${s.got >= 0 ? `${esc(ctx.names[s.got])} 정답` : '정답자 없음'}</h3><p style="font-family:var(--font-display);font-size:22px">${esc(RULES[s.rule][0])}</p><p class="muted small mt">다음 라운드 <span class="timer" data-until="${s.until}"></span></p></div>`;
    }
    const problem = `<div style="font-family:var(--font-display);font-size:clamp(44px,8vw,84px);line-height:1;display:flex;gap:.3em;align-items:baseline;flex-wrap:wrap">
      <span>${s.X}</span><span style="color:var(--accent)">?</span><span>${s.Y}</span><span class="muted">=</span><span class="${f && f.kind === 'right' ? 'pop' : ''}" style="color:${s.phase === 'reveal' ? 'var(--seg)' : 'var(--line-2)'}">${s.phase === 'reveal' || s.over ? s.answer : '□'}</span></div>`;
    const hintList = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${s.hints.map((h, i) => `<div class="panel ${f && f.kind === 'hint' && i === s.hints.length - 1 ? 'drop' : ''}" style="padding:10px 14px;font-family:var(--font-num);font-size:18px"><span class="muted small">${i + 1}</span> ${hv(h, 0)} <span style="color:var(--accent)">?</span> ${hv(h, 1)} = <b>${h.r}</b></div>`).join('')}
      ${s.phase === 'h2' ? `<div class="panel" style="padding:10px 14px;font-family:var(--font-num);font-size:18px;border-style:dashed"><span class="muted small">${s.hints.length + 1}</span> ${s.hints.length === 0 && s.use[s.giver[0]].S && view !== s.giver[0] ? '?' : s.pend} <span style="color:var(--accent)">?</span> …</div>` : ''}</div>`;
    return `${hud(ctx, range(s.n).map(i => ({ i, v: s.sc[i], x: tags(i), turn: this.waiting(s).includes(i) })))}
      <div class="status">${s.round} / ${s.rounds} 라운드<small>힌트 ${s.hints.length}/16</small></div>
      <div class="board-wrap"><div class="col" style="gap:22px">${problem}${hintList}</div><div class="side">${actHTML}</div></div>`;
  },
};

function newRound(s, now) {
  s.round++;
  if (!s.ruleBag.length) s.ruleBag = shuffle(range(RULES.length));
  s.rule = s.ruleBag.pop();
  let X, Y, A;
  do { X = 2 + rint(38); Y = 2 + rint(38); A = RULES[s.rule][1](X, Y); } while (X === Y || !Number.isFinite(A));
  Object.assign(s, { X, Y, answer: A, hints: [], phase: 'items', use: Array(s.n).fill(null), excl: [], passed: [], got: -1, lastWrong: null });
  s.starter = (s.starter + 1) % s.n;
  setGivers(s);
}
function setGivers(s) { const p = (s.starter + s.hints.length) % s.n; s.giver = [p, (p + 1) % s.n]; }
function nextHint(s, now) {
  if (s.hints.length >= 16) { s.phase = 'reveal'; s.got = -1; s.from = now; s.until = now + 7000; return; }
  s.phase = 'h1'; setGivers(s);
}
function wrong(s, seat, now) {
  if (!s.use[seat].F) s.sc[seat] -= 1;
  s.excl.push(seat); s.passed = [];
  fx(s, 'wrong', { seat });
  if (range(s.n).every(i => s.excl.includes(i))) return nextHint(s, now);
  s.phase = 'buzz'; s.from = now; s.until = now + s.win * 1000;
}
function end(s) {
  const ord = range(s.n).sort((a, b) => s.sc[b] - s.sc[a]);
  s.over = { winners: ord.filter(i => s.sc[i] === s.sc[ord[0]]), rows: ord.map(i => ({ i, v: `${s.sc[i]}점` })) };
}
