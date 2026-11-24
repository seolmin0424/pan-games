import { esc, rint, rand, clamp, act, ui, pc, nm, hud, fx, range } from '../util.js';
import * as LLM from '../llm.js';

const PROF = 'pan-bw2-prof';
const loadProf = () => { try { return JSON.parse(localStorage.getItem(PROF) || '[]'); } catch { return []; } };
const CK = { b: '흑(0~9)', w: '백(10~99)' };

// what `me` can deduce about the opponent's bids each round
function deduce(s, me) {
  const op = 1 - me; let lo = 0, hi = 0; const rows = [];
  let base = 99;
  s.hist.forEach(h => {
    if (h.ext && h.ext !== (rows.length && rows[rows.length - 1].ext)) { /* new extension: points reset */ }
    const mine = h.b[me], c = h.c[op];
    let a = c === 'b' ? 0 : 10, b = c === 'b' ? 9 : 99;
    if (h.w === me) b = Math.min(b, mine - 1); else if (h.w === op) a = Math.max(a, mine + 1); else { a = b = mine; }
    rows.push({ r: h.r, ext: h.ext, first: h.f === me ? '나' : '상대', mine, col: c, res: h.w === me ? '승' : h.w === op ? '패' : '무', a, b });
  });
  // spending bounds only for the current points pool
  rows.filter(x => x.ext === s.ext).forEach(x => { lo += x.a; hi += x.b; });
  base = s.ext ? 33 : 99;
  if (s.step === 1 && s.first === op) { const c = colOf(s.bid[op]); lo += c === 'b' ? 0 : 10; hi += c === 'b' ? 9 : 99; }
  const L = lamps(s.pts[op]);
  const remHi = Math.min(base - lo, L * 20 - 1), remLo = Math.max(0, base - hi, (L - 1) * 20);
  return { rows, remLo, remHi: Math.max(remLo, remHi), L };
}

function brief(s, me) { return `흑과 백 II ${s.ext ? '연장 ' : ''}${s.round}/${s.last}라운드, 승점 나 ${s.sc[me]} : 상대 ${s.sc[1 - me]}.`; }

async function llmMove(s, me, ctx) {
  const op = 1 - me, d = deduce(s, me), names = ctx.names;
  const second = s.step === 1;
  const prof = loadProf().slice(-40).map(p => `${p.pos}${p.seen ? `, 상대 ${CK[p.seen]} 확인 후` : ''}, ${p.round}R, 승점차 ${p.diff >= 0 ? '+' : ''}${p.diff}, 남은 ${p.before}점에서 ${p.bid} 걸음`).join('\n');
  const prompt = `너는 두뇌 서바이벌 예능 "흑과 백 II"의 플레이어 "${names[me]}", 상대는 "${names[op]}"(사람)다. ${LLM.personaLine(ctx.persona)}

[규칙] 둘 다 99점으로 시작, 9라운드. 매 라운드 선이 먼저 점수를 걸고 후가 건다. 후는 선이 건 점수의 색만 본다: 0~9는 흑, 10~99는 백. 더 많이 건 쪽이 승점 1을 얻고 다음 라운드 선. 같으면 무승부, 선 유지. 건 점수는 사라진다. 남은 점수는 램프 5칸(0~19:1칸, 20~39:2칸, …, 80~99:5칸)으로만 공개되고, 걸자마자 램프가 갱신되어 상대가 바로 본다. 승점 5를 먼저 얻으면 즉시 승리. 9라운드 후 동점이면 각자 33점으로 3라운드 연장.

[현재] ${s.ext ? `연장 ${s.ext}회차, ` : ''}${s.round}/${s.last}라운드. 승점: 너 ${s.sc[me]}, 상대 ${s.sc[op]}.
너의 남은 점수: ${s.pts[me]}. 상대 램프: ${d.L}칸. 추론한 상대 남은 점수: ${d.remLo}~${d.remHi}.
${second ? `너는 후. 상대는 이미 ${CK[colOf(s.bid[op])]}을 걸었다.` : '너는 선. 먼저 건다. 네가 건 점수의 색과 램프 변화를 상대가 보고 대응한다.'}

[라운드 기록 (너의 시점)]
${d.rows.length ? d.rows.map(x => `${x.ext ? '연장 ' : ''}${x.r}R 선:${x.first}, 너 ${x.mine} 걸음, 상대 ${CK[x.col]}, ${x.res} → 상대는 ${x.a === x.b ? x.a : `${x.a}~${x.b}`} 걸었음`).join('\n') : '없음'}

[이 사람이 과거 게임에서 실제로 건 기록]
${prof || '아직 없음'}

[대화]
${LLM.chatLog(s, names)}

[참고] 계산 엔진의 무난한 추천: ${ctx.fallback.bid}. 흑을 본 후라면 10이면 반드시 이긴다. 질 판은 0으로 버리는 것도 전략이다. 상대 습관과 대화를 읽고, 필요하면 블러핑해라. 남은 라운드와 승점 차를 고려해 점수를 배분해라.

JSON으로만 답해라:
{"bid": 0~${s.pts[me]} 사이 정수, "say": "지금 상대에게 던지는 한 마디. 40자 이내, 캐릭터 말투, 이모지 금지. 네가 건 정확한 숫자는 밝히지 말 것(허세·거짓말 가능)", "note": "실제 의도를 한 문장으로 (게임 끝나고 공개됨)"}`;
  const r = await LLM.json(prompt, { timeout: 15000 });
  const bid = clamp(Math.round(+r.bid), 0, s.pts[me]);
  if (!Number.isFinite(bid)) return null;
  return { a: { bid }, say: r.say, note: r.note ? `${s.ext ? '연장 ' : ''}${s.round}R ${bid}: ${r.note}` : '' };
}

const colOf = v => (v < 10 ? 'b' : 'w');
const lamps = p => clamp(Math.floor(p / 20) + 1, 1, 5);
const lampRow = p => `<div class="row" style="gap:6px">${range(5).map(k => `<span class="lamp ${k < lamps(p) ? 'on' : ''}"></span>`).join('')}</div>`;
const chip = (c, big) => `<span style="display:inline-block;width:${big ? 46 : 18}px;height:${big ? 46 : 18}px;border-radius:${big ? 10 : 4}px;background:var(${c === 'b' ? '--black-tile' : '--white-tile'});border:1px solid var(--line-2);vertical-align:middle"></span>`;

export default {
  id: 'bw2', title: '흑과 백 II', src: '더 지니어스', players: [2, 2], def: 2, private: true,
  glyph: `<svg viewBox="0 0 44 44"><rect x="4" y="10" width="17" height="24" rx="3" fill="var(--black-tile)" stroke="var(--line-2)"/><rect x="23" y="10" width="17" height="24" rx="3" fill="var(--white-tile)"/></svg>`,
  rules: [
    '각자 99점을 들고 9라운드. 매 라운드 원하는 만큼 점수를 건다.',
    '선이 먼저 걸고, 후는 선이 건 점수의 색만 본다. 한 자릿수는 <b>흑</b>, 두 자릿수는 <b>백</b>.',
    '더 많이 건 쪽이 승점 1, 다음 라운드 선. 같으면 승점 없이 선 유지.',
    '쓴 점수는 사라진다. 남은 점수는 20점 단위 램프 5칸으로만 공개.',
    '승점 5 먼저 따면 즉시 승리. 9라운드 후 동점이면 각자 33점으로 3라운드 연장.',
  ],
  llm: llmMove,
  brief,
  summary: (s, names) => `최종 승점 ${names[0]} ${s.sc[0]} : ${names[1]} ${s.sc[1]}\n${s.hist.map(h => `${h.ext ? '연장 ' : ''}${h.r}R 선 ${names[h.f]}: ${names[0]} ${h.b[0]} vs ${names[1]} ${h.b[1]} → ${h.w < 0 ? '무' : names[h.w] + ' 승'}`).join('\n')}`,
  learn(s, seats) {
    const prof = loadProf();
    let pts = [99, 99], ext = 0, sc = [0, 0];
    s.hist.forEach(h => {
      if (h.ext !== ext) { ext = h.ext; pts = [33, 33]; }
      [0, 1].forEach(i => {
        if (seats[i].type === 'ai') return;
        const second = h.f !== i;
        prof.push({ pos: second ? '후' : '선', seen: second ? h.c[1 - i] : null, round: h.r, diff: sc[i] - sc[1 - i], before: pts[i], bid: h.b[i] });
      });
      pts = pts.map((p, i) => p - h.b[i]);
      if (h.w >= 0) sc[h.w]++;
    });
    try { localStorage.setItem(PROF, JSON.stringify(prof.slice(-120))); } catch { }
  },
  async postgame(s, me, ctx) {
    const names = ctx.names, op = 1 - me;
    const won = s.over.winners.includes(me);
    const rows = s.hist.map(h => `${h.ext ? '연장 ' : ''}${h.r}R 너 ${h.b[me]} vs 상대 ${h.b[op]} → ${h.w === me ? '승' : h.w === op ? '패' : '무'}`).join('\n');
    const r = await LLM.json(`너는 "흑과 백 II"를 방금 끝낸 "${names[me]}"다. ${LLM.personaLine(ctx.persona)}
결과: ${won ? '네가 이겼다' : '네가 졌다'} (${s.sc[me]}:${s.sc[op]}). 이제 모든 숫자가 공개됐다.
${rows}
상대 "${names[op]}"에게 캐릭터 말투로 소감 한 마디와, 상대 베팅 습관에 대한 날카로운 분석 한 줄을 합쳐 100자 이내로 말해라. 이모지 금지.
JSON: {"say": "..."}`, { timeout: 15000 });
    return String(r.say || '').slice(0, 160);
  },
  setup() { return { pts: [99, 99], sc: [0, 0], round: 1, last: 9, first: rint(2), step: 0, bid: [null, null], hist: [], ext: 0, over: null }; },
  waiting(s) { if (s.over) return []; return [s.step === 0 ? s.first : 1 - s.first]; },
  act(s, seat, a) {
    const turn = s.step === 0 ? s.first : 1 - s.first;
    if (seat !== turn || a.bid == null) return 'turn';
    const v = Math.floor(+a.bid);
    if (!(v >= 0 && v <= s.pts[seat])) return 'range';
    s.bid[seat] = v; s.pts[seat] -= v;
    if (s.step === 0) { s.step = 1; fx(s, 'bid', { seat }); return; }
    const f = s.first, o = 1 - f;
    const w = s.bid[f] > s.bid[o] ? f : s.bid[o] > s.bid[f] ? o : -1;
    s.hist.push({ r: s.round, f, c: [colOf(s.bid[0]), colOf(s.bid[1])], b: [...s.bid], w, ext: s.ext });
    if (w >= 0) { s.sc[w]++; s.first = w; }
    s.bid = [null, null]; s.step = 0;
    fx(s, 'round', { w });
    if (w >= 0 && s.sc[w] >= 5) return end(s);
    s.round++;
    if (s.round > s.last) {
      if (s.sc[0] !== s.sc[1]) return end(s);
      s.ext++; s.pts = [33, 33]; s.last += 3;
    }
  },
  ai(s, me, now, lv) {
    if (s.over || this.waiting(s)[0] !== me) return null;
    const op = 1 - me, my = s.pts[me];
    const L = lamps(s.pts[op]), hi = Math.min(s.ext ? 33 : 99, L * 20 - 1);
    const need = 5 - s.sc[me], left = s.last - s.round + 1;
    const urgent = need >= left;
    let b;
    if (s.step === 1) {
      const c = colOf(s.bid[op]);
      if (c === 'b') b = my >= 10 && (urgent || Math.random() < (lv === 0 ? .5 : .8)) ? 10 : (Math.random() < .5 ? 0 : Math.min(my, rint(9)));
      else if (my > hi && hi + 1 <= Math.max(my * .7, urgent ? my : 0)) b = hi + 1;
      else if (!urgent && Math.random() < (lv === 2 ? .55 : .35)) b = 0;
      else b = Math.min(my, Math.round(rand(10, Math.max(12, Math.min(hi, my * .6)))));
    } else {
      const avg = my / Math.max(1, Math.min(left, need * 1.4));
      if (!urgent && Math.random() < (lv === 0 ? .15 : .3)) b = rint(6);
      else b = Math.round(avg * rand(.7, lv === 0 ? 2 : 1.5));
      if (lv > 0 && b >= 8 && b <= 10 && Math.random() < .6) b = 9;
    }
    return { a: { bid: clamp(b, 0, my) }, d: rand(900, 2000) };
  },
  onUi(k, v, ctx) {
    const s = ctx.state, me = ctx.seat;
    const cur = ctx.ui.v ?? 0;
    if (k === 'd') ctx.ui.v = clamp(cur + v, 0, s.pts[me]);
    if (k === 'set') ctx.ui.v = clamp(v, 0, s.pts[me]);
  },
  onForm(fd, ctx) { ctx.send(ctx.seat, { bid: +fd.get('v') }); ctx.ui.v = 0; },
  after(el, ctx) {
    const r = el.querySelector('#bwr'), n = el.querySelector('#bwn');
    if (r && n) { r.addEventListener('input', () => { n.value = r.value; ctx.ui.v = +r.value; }); n.addEventListener('input', () => { r.value = n.value; ctx.ui.v = +n.value; }); }
  },
  render(ctx) {
    const s = ctx.state, me = ctx.seat, view = me >= 0 ? me : 0, op = 1 - view;
    const turn = s.over ? -1 : this.waiting(s)[0];
    const last = s.hist[s.hist.length - 1];
    const f = ctx.fresh('round');
    let banner = '';
    if (last) {
      const res = last.w < 0 ? '무승부' : me < 0 ? `${esc(ctx.names[last.w])} 승` : last.w === me ? '이겼다' : '졌다';
      banner = `<div class="${f ? 'pop' : ''}" style="font-family:var(--font-display);font-size:22px;color:${last.w < 0 ? 'var(--muted)' : last.w === me ? 'var(--seg)' : me < 0 ? pc(last.w) : 'var(--ink-2)'}">${last.ext ? '연장 ' : ''}${last.r}라운드 ${res}</div>`;
    }
    const panel = (i, mine) => `<div class="panel" ${f && f.w === i ? `data-burst=""` : ''}>
      <div class="spread"><span style="color:${pc(i)};font-weight:600">${esc(ctx.names[i])}${mine && ctx.names[i] !== '나' ? ' (나)' : ''}</span><span class="big-num" style="font-size:40px">${s.sc[i]}<span class="muted" style="font-size:18px"> 승</span></span></div>
      <div class="spread mt">${lampRow(s.pts[i])}${mine ? `<span class="big-num" style="font-size:28px">${s.pts[i]}<span class="muted" style="font-size:15px">점</span></span>` : '<span class="muted small">남은 점수 ?</span>'}</div>
      ${s.thinking === i ? '<p class="note mt think">생각 중</p>' : ''}
      ${(() => { const c = (s.chat || []).filter(x => x.i === i).slice(-1)[0]; return c && Date.now() - c.at < 20000 && ctx.state.thinking !== i ? `<div class="bubble mt ${ctx.newChat && ctx.newChat.i === i ? 'pop' : ''}">${esc(c.t)}</div>` : ''; })()}
      ${s.step === 1 && s.first === i ? `<div class="row mt drop"><span class="muted small">이번 라운드</span>${chip(colOf(s.bid[i]))}<b>${colOf(s.bid[i]) === 'b' ? '흑' : '백'}</b></div>` : ''}
    </div>`;
    let action = '';
    if (me >= 0 && turn === me) {
      const v = clamp(ctx.ui.v ?? 0, 0, s.pts[me]);
      const opc = s.step === 1 ? colOf(s.bid[1 - me]) : null;
      action = `<form class="panel" data-form="game">
        <div class="spread"><h3 style="margin:0">${s.step === 0 ? '선 — 먼저 걸기' : `후 — 상대는 ${opc === 'b' ? '흑' : '백'}`}</h3>${chip(v < 10 ? 'b' : 'w', true)}</div>
        <div class="row mt"><button type="button" class="btn sm" ${ui('d', -1)}>−</button><input id="bwn" name="v" type="number" min="0" max="${s.pts[me]}" value="${v}" style="width:96px;font-family:var(--font-num);font-size:20px;text-align:center"><button type="button" class="btn sm" ${ui('d', 1)}>+</button>
        <span class="muted small">/ ${s.pts[me]}</span></div>
        <input id="bwr" type="range" min="0" max="${s.pts[me]}" value="${v}" class="mt" aria-label="걸 점수">
        <button class="btn primary lg mt" style="width:100%" type="submit">걸기</button>
      </form>`;
    } else if (!s.over) action = `<div class="panel"><p class="muted">${esc(ctx.names[turn])} 차례</p></div>`;
    const histRow = `<div class="panel"><h3>기록</h3><div class="col" style="gap:6px">${s.hist.length ? s.hist.map(h => `<div class="spread small"><span class="muted">${h.ext ? '연장 ' : ''}${h.r}R</span><span class="row" style="gap:6px">${nm(ctx, 0)} ${chip(h.c[0])} ${chip(h.c[1])} ${nm(ctx, 1)}</span><span>${h.w < 0 ? '무' : esc(ctx.names[h.w])}${s.over ? ` <span class="muted">${h.b[0]}:${h.b[1]}</span>` : ''}</span></div>`).join('') : '<span class="muted small">아직 없음</span>'}</div></div>`;
    return `<div class="status">${s.ext ? `연장 ${s.ext}` : ''} ${s.over ? '종료' : `${s.round} / ${s.last} 라운드`}<small>선 ${esc(ctx.names[s.first])}</small></div>
      <div class="board-wrap"><div class="col" style="gap:16px">${banner}<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">${panel(op, false)}${panel(view, me >= 0)}</div>${action}</div>
      <div class="side">${histRow}</div></div>`;
  },
};

function end(s) {
  const w = s.sc[0] > s.sc[1] ? 0 : 1;
  s.over = { winners: [w], rows: [w, 1 - w].map(i => ({ i, v: `${s.sc[i]}승` })) };
}
