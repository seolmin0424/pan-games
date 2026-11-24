import { esc, rint, rand, act, ui, pc, nm, hud, fx, range, shuffle, bar, sum } from '../util.js';

const RULES = [
  ['다섯 수의 합', v => sum(v)],
  ['위 세 수의 합 − 아래 두 수의 합', ([a, b, c, d, e]) => a + b + e - c - d],
  ['가장 큰 수 × 가장 작은 수', v => Math.max(...v) * Math.min(...v)],
  ['꼭대기 × 아래 두 수의 합', ([a, b, c, d, e]) => a * (c + d)],
  ['홀수만 더하기', v => sum(v.filter(x => x % 2))],
  ['가장 큰 수 − 가장 작은 수', v => Math.max(...v) - Math.min(...v)],
  ['양 날개의 곱 + 아래 두 수의 곱', ([a, b, c, d, e]) => b * e + c * d],
  ['가장 큰 두 수의 합', v => { const s = [...v].sort((x, y) => y - x); return s[0] + s[1]; }],
  ['이웃한 두 수의 곱을 모두 더하기', ([a, b, c, d, e]) => a * b + b * c + c * d + d * e + e * a],
  ['꼭대기 + 오른쪽 두 수 − 왼쪽 두 수', ([a, b, c, d, e]) => a + b + c - d - e],
  ['짝수 개수 × 10 + 꼭대기', v => v.filter(x => x % 2 === 0).length * 10 + v[0]],
  ['서로 다른 수의 개수 × 가장 큰 수', v => new Set(v).size * Math.max(...v)],
  ['꼭대기 × 2 + 나머지의 합', ([a, b, c, d, e]) => a * 2 + b + c + d + e],
];
const roll = () => 1 + rint(6);
const PTS = range(5).map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [Math.cos(a), Math.sin(a)]; });

function star(vals, center, owners, opts = {}) {
  const S = opts.size || 220, R = S * .38, c = S / 2;
  const P = PTS.map(([x, y]) => [c + x * R, c + y * R]);
  let g = `<svg viewBox="0 0 ${S} ${S}" style="width:100%;max-width:${S}px;display:block" role="img" aria-label="별">`;
  g += `<path d="${[0, 2, 4, 1, 3, 0].map((k, i) => (i ? 'L' : 'M') + P[k][0] + ' ' + P[k][1]).join('')}" fill="none" stroke="var(--line-2)" stroke-width="1.5"/>`;
  P.forEach(([x, y], i) => {
    const own = owners ? owners[i] : -1, v = vals[i];
    g += `<g class="${opts.anim ? 'pop' : ''}" style="transform-box:fill-box;transform-origin:center;animation-delay:${i * 70}ms"><circle cx="${x}" cy="${y}" r="${S * .085}" fill="var(--raise)" stroke="${own >= 0 ? pc(own) : 'var(--line-2)'}" stroke-width="${own >= 0 ? 3 : 1.5}"/>
      <text x="${x}" y="${y + S * .03}" text-anchor="middle" font-family="var(--font-num)" font-size="${S * .085}" font-weight="600" fill="var(--ink)">${v ?? ''}</text></g>`;
  });
  g += `<text x="${c}" y="${c + S * .055}" text-anchor="middle" font-family="var(--font-num)" font-size="${S * .14}" font-weight="600" fill="${opts.hot ? 'var(--seg)' : 'var(--ink)'}">${center}</text></svg>`;
  return g;
}

export default {
  id: 'hidden', title: '히든 코드', src: '피의 게임 3', players: [2, 4], def: 3,
  isPrivate: s => s.phase === 'pick',
  glyph: `<svg viewBox="0 0 44 44"><path d="M22 5l5 12h12l-10 8 4 13-11-8-11 8 4-13-10-8h12z" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/><text x="22" y="28" text-anchor="middle" font-size="9" fill="var(--ink)" font-family="monospace">?</text></svg>`,
  rules: [
    '별 모양 꼭짓점 5개에 숫자를 넣으면 숨겨진 규칙으로 가운데 값이 나온다. 꼭짓점 위치가 중요할 수 있다.',
    '매번 집사가 주사위를 굴려 남는 꼭짓점을 채우고, 각자 자기 꼭짓점에 1~6 중 하나를 몰래 고른다.',
    '다섯 수와 결괏값이 공개되면 버저. 문제 별의 결괏값을 맞히면 +1, 틀리면 감점 없이 기회가 다른 사람에게.',
    '3점 먼저 따거나 5라운드 후 최다 득점자 승리. 동점이면 연장.',
  ],
  options: [{ k: 'win', label: '버저 시간', ch: [[15, '15초'], [25, '25초'], [40, '40초']], d: 25 }],
  setup(n, o, now) { const s = { n, win: o.win || 25, round: 0, sc: Array(n).fill(0), bag: shuffle(range(RULES.length)), over: null }; newRound(s, now); return s; },
  waiting(s) {
    if (s.over) return [];
    if (s.phase === 'pick') return range(s.n).filter(i => s.pick[i] == null);
    if (s.phase === 'answer') return [s.ans];
    return [];
  },
  tick(s, now) {
    if (s.phase === 'buzz' && now >= s.until) { nextDraw(s, now); return true; }
    if (s.phase === 'answer' && now >= s.until) { wrong(s, s.ans, now); return true; }
    if (s.phase === 'reveal' && now >= s.until) { afterRound(s, now); return true; }
    return false;
  },
  act(s, seat, a, now) {
    if (s.phase === 'pick') {
      if (s.pick[seat] != null) return 'done';
      const v = +a.num; if (!(v >= 1 && v <= 6)) return 'range';
      s.pick[seat] = v;
      if (s.pick.every(x => x != null)) {
        const vals = range(5).map(i => i < s.n ? s.pick[i] : s.dice[i - s.n]);
        s.draws.push({ v: vals, r: RULES[s.rule][1](vals) });
        s.phase = 'buzz'; s.from = now; s.until = now + s.win * 1000; s.excl = []; s.passed = [];
        fx(s, 'draw');
      }
      return;
    }
    if (s.phase === 'buzz') {
      if (s.excl.includes(seat)) return 'locked';
      if (a.buzz) { s.phase = 'answer'; s.ans = seat; s.from = now; s.until = now + 15000; return; }
      if (a.pass) { if (!s.passed.includes(seat)) s.passed.push(seat); if (range(s.n).every(i => s.excl.includes(i) || s.passed.includes(i))) nextDraw(s, now); return; }
    }
    if (s.phase === 'answer') {
      if (seat !== s.ans) return 'turn';
      if (+a.answer === s.answer) { s.sc[seat]++; s.got = seat; s.phase = 'reveal'; s.from = now; s.until = now + 6500; fx(s, 'right', { seat }); return; }
      s.lastWrong = { seat, v: +a.answer }; wrong(s, seat, now); return;
    }
    return 'no';
  },
  ai(s, me, now, lv) {
    if (s.over) return null;
    s.aik = s.aik || {};
    if (!s.aik[me]) s.aik[me] = range(RULES.length).filter(() => Math.random() < [.6, .85, 1][lv]);
    if (s.phase === 'pick' && s.pick[me] == null) return { a: { num: roll() }, d: rand(700, 1800) };
    const cons = s.aik[me].filter(i => RULES[i][1](s.ex.v) === s.ex.r && s.draws.every(d => RULES[i][1](d.v) === d.r));
    const ans = [...new Set(cons.map(i => RULES[i][1](s.target)))];
    if (s.phase === 'buzz' && !s.excl.includes(me) && !s.passed.includes(me)) {
      if (ans.length === 1 && cons.length) return { a: { buzz: true }, d: rand(...[[6000, 12000], [3000, 7000], [1500, 3500]][lv]) };
      return { a: { pass: true }, d: rand(2500, 4500) };
    }
    if (s.phase === 'answer' && s.ans === me) return { a: { answer: ans.length ? ans[0] : rint(30) }, d: rand(1000, 2000) };
    return null;
  },
  onForm(fd, ctx) { ctx.send(+fd.get('s'), { answer: +fd.get('ans') }); },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, f = ctx.fresh(), actors = ctx.actors;
    const owners = range(5).map(i => i < s.n ? i : -1);
    const last = s.draws[s.draws.length - 1];
    let panel = '';
    if (s.phase === 'pick') {
      if (me >= 0 && s.pick[me] == null) panel = `<div class="panel"><h3>내 꼭짓점 숫자</h3><div class="numgrid" style="grid-template-columns:repeat(6,minmax(0,1fr))">${range(6).map(k => `<button class="tile" ${act(me, { num: k + 1 })}>${k + 1}</button>`).join('')}</div></div>`;
      else panel = `<div class="panel"><p class="muted">고르는 중: ${range(s.n).filter(i => s.pick[i] == null).map(i => esc(ctx.names[i])).join(', ')}</p></div>`;
    } else if (s.phase === 'buzz') {
      const can = actors.filter(i => !s.excl.includes(i));
      panel = `<div class="panel"><div class="spread"><h3 style="margin:0">버저</h3><span class="timer" data-until="${s.until}"></span></div><div class="mt">${bar(s.from, s.until)}</div>
        <div class="row mt">${can.map(i => `<button class="btn primary lg" ${act(i, { buzz: true })}>${actors.length > 1 ? esc(ctx.names[i]) + ' ' : ''}정답!</button>`).join('')}${can.filter(i => !s.passed.includes(i)).map(i => `<button class="btn" ${act(i, { pass: true })}>${actors.length > 1 ? esc(ctx.names[i]) + ' ' : ''}다시 굴리기</button>`).join('')}</div>
        ${s.lastWrong && s.excl.length ? `<p class="note mt">${esc(ctx.names[s.lastWrong.seat])} 오답 ${s.lastWrong.v}</p>` : ''}</div>`;
    } else if (s.phase === 'answer') {
      panel = actors.includes(s.ans) ? `<form class="panel" data-form="game"><div class="spread"><h3 style="margin:0">문제 별의 값은?</h3><span class="timer" data-until="${s.until}"></span></div><input type="hidden" name="s" value="${s.ans}"><div class="row mt"><input id="hans" data-keep="${s.round}-${s.draws.length}-${s.ans}" name="ans" type="number" required style="width:140px;font-family:var(--font-num);font-size:22px" data-autofocus><button class="btn primary" type="submit">제출</button></div></form>`
        : `<div class="panel"><p><span style="color:${pc(s.ans)}">${esc(ctx.names[s.ans])}</span> 답하는 중</p></div>`;
    } else if (s.phase === 'reveal') {
      panel = `<div class="panel ${f ? 'pop' : ''}" ${f && f.kind === 'right' ? 'data-burst=""' : ''}><h3>${s.got >= 0 ? `${esc(ctx.names[s.got])} 정답` : '정답자 없음'}</h3><p style="font-family:var(--font-display);font-size:21px">${esc(RULES[s.rule][0])}</p></div>`;
    }
    const dice = s.phase === 'pick' ? `<div class="panel"><h3>집사 주사위</h3><div class="row">${s.dice.map(d => `<span class="tile ${f && f.kind === 'roll' ? 'pop' : ''}" style="width:48px;aspect-ratio:1">${d}</span>`).join('')}</div></div>` : '';
    const reveal = s.phase === 'reveal' || s.over;
    return `${hud(ctx, range(s.n).map(i => ({ i, v: s.sc[i], x: s.phase === 'pick' ? (s.pick[i] != null ? '선택 완료' : '') : '' })))}
      <div class="status">${s.round}라운드${s.round > 5 ? ' (연장)' : ''}<small>${s.draws.length}번째 숫자 / 최대 8</small></div>
      <div class="board-wrap"><div class="col" style="gap:20px">
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
          <div class="panel"><h3>문제</h3>${star(s.target, reveal ? s.answer : '?', null, { hot: reveal })}</div>
          <div class="panel"><h3>${last ? '방금 나온 숫자' : '예시'}</h3>${last ? star(last.v, last.r, owners, { anim: f && f.kind === 'draw' }) : star(s.ex.v, s.ex.r, null)}</div>
        </div>
        <div class="panel"><h3>기록</h3><div class="col small" style="gap:4px;font-family:var(--font-num)"><div class="spread"><span class="muted">예시</span><span>${s.ex.v.join(' ')}</span><b>${s.ex.r}</b></div>${s.draws.map((d, i) => `<div class="spread"><span class="muted">${i + 1}</span><span>${d.v.map((x, k) => k < s.n ? `<span style="color:${pc(k)}">${x}</span>` : x).join(' ')}</span><b>${d.r}</b></div>`).join('')}</div></div>
      </div><div class="side">${dice}${panel}<div class="panel"><h3>꼭짓점</h3>${range(5).map(i => `<div class="spread small"><span>${['꼭대기', '오른쪽 위', '오른쪽 아래', '왼쪽 아래', '왼쪽 위'][i]}</span><span>${i < s.n ? nm(ctx, i) : '<span class="muted">집사</span>'}</span></div>`).join('')}</div></div></div>`;
  },
};

function newRound(s, now) {
  s.round++;
  if (!s.bag.length) s.bag = shuffle(range(RULES.length));
  s.rule = s.bag.pop();
  const ev = range(5).map(roll); s.ex = { v: ev, r: RULES[s.rule][1](ev) };
  let t; do t = range(5).map(roll); while (t.join() === ev.join());
  s.target = t; s.answer = RULES[s.rule][1](t);
  s.draws = []; s.got = -1; s.lastWrong = null;
  nextDraw(s, now, true);
}
function nextDraw(s, now, first) {
  if (!first && s.draws.length >= 8) { s.phase = 'reveal'; s.got = -1; s.from = now; s.until = now + 6500; return; }
  s.phase = 'pick'; s.pick = Array(s.n).fill(null); s.dice = range(5 - s.n).map(roll); s.excl = []; s.passed = [];
  fx(s, 'roll');
}
function wrong(s, seat, now) {
  s.excl.push(seat); s.passed = [];
  if (range(s.n).every(i => s.excl.includes(i))) return nextDraw(s, now);
  s.phase = 'buzz'; s.from = now; s.until = now + s.win * 1000;
}
function afterRound(s, now) {
  const top = Math.max(...s.sc), lead = range(s.n).filter(i => s.sc[i] === top);
  if (top >= 3 || (s.round >= 5 && lead.length === 1)) {
    const ord = range(s.n).sort((a, b) => s.sc[b] - s.sc[a]);
    s.over = { winners: lead, rows: ord.map(i => ({ i, v: `${s.sc[i]}점` })) };
    return;
  }
  newRound(s, now);
}
