import { esc, rint, rand, clamp, act, ui, pc, nm, hud, fx, range } from '../util.js';

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
