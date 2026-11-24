import { GAMES } from './games/index.js';
import { esc, pc, range } from './util.js';
import { Engine, GEMINI } from './engine.js';
import * as net from './net.js';
import * as FX from './fx.js';
import * as LLM from './llm.js';

const root = document.getElementById('app');
const byId = id => GAMES.find(g => g.id === id);
const LEVELS = ['쉬움', '보통', '어려움'];
const AI_NAMES = ['도윤', '서아', '하준', '지우', '이안', '나은', '로운'];

let G = { screen: 'home' };
let uiStore = {};
let lastFx = 0, resultShownFor = null, curtainSeat = null, stageKey = '', lastChat = 0;

/* ---------- Gemini settings ---------- */
function openGemini() {
  const wrap = document.createElement('div');
  wrap.className = 'result';
  wrap.innerHTML = `<form class="card-r" style="text-align:left" data-gform>
    <h2 style="font-size:32px">Gemini</h2>
    <p class="note mt">키는 이 브라우저에만 저장돼요.</p>
    <label class="col mt" style="gap:6px"><span class="small">API 키</span><input type="password" name="k" value="${esc(LLM.key())}" autocomplete="off" placeholder="AIza…"></label>
    <label class="col mt" style="gap:6px"><span class="small">모델</span><select name="m"><option>${esc(LLM.model())}</option></select></label>
    <p class="note mt" data-gstat></p>
    <div class="row mt2"><button class="btn" type="button" data-gtest>키 확인</button><button class="btn primary" type="submit">저장</button><button class="btn ghost" type="button" data-gclose>닫기</button>${LLM.key() ? '<button class="btn ghost" type="button" data-gdel>키 삭제</button>' : ''}</div>
  </form>`;
  document.body.appendChild(wrap);
  const f = wrap.querySelector('form'), st = wrap.querySelector('[data-gstat]'), sel = f.m;
  const test = async () => {
    st.textContent = '확인 중';
    try {
      const names = await LLM.listModels(f.k.value.trim());
      const cur = LLM.model(), def = names.includes(cur) ? cur : LLM.pickDefault(names);
      sel.innerHTML = names.map(n => `<option ${n === def ? 'selected' : ''}>${esc(n)}</option>`).join('');
      st.textContent = `연결됨. 모델 ${names.length}개`;
    } catch (e) { st.textContent = e.message; }
  };
  wrap.querySelector('[data-gtest]').onclick = test;
  wrap.querySelector('[data-gclose]').onclick = () => wrap.remove();
  const del = wrap.querySelector('[data-gdel]'); if (del) del.onclick = () => { LLM.save('', ''); wrap.remove(); render(); };
  f.onsubmit = e => { e.preventDefault(); LLM.save(f.k.value, sel.value); wrap.remove(); render(); };
  if (LLM.key()) test();
}

/* ---------- chat ---------- */
function chatHTML(ctx) {
  const st = ctx.state;
  const show = (st.chat && st.chat.length) || G.engine?.seats.some((s, i) => G.engine.usesGemini(i)) || ctx.online;
  if (!show) return '';
  const sender = ctx.actors && ctx.actors.length ? ctx.actors[0] : (ctx.locals || [])[0];
  const notes = st.over && st.notes && st.notes.length ? `<div class="panel mt"><h3>${esc(ctx.names[st.notes[0].i])}의 속마음</h3><div class="log">${st.notes.map(n => `<div>${esc(n.t)}</div>`).join('')}</div></div>` : '';
  return `<div class="panel"><h3>대화</h3>
    <div class="log chatlog">${(st.chat || []).map(c => `<div><b style="color:${pc(c.i)};font-weight:600">${esc(ctx.names[c.i])}</b> ${esc(c.t)}</div>`).join('') || '<span class="muted">-</span>'}</div>
    ${sender != null ? `<form class="row mt" data-form="chat"><input type="hidden" name="s" value="${sender}"><input id="chatin" data-keep="chat" type="text" name="t" maxlength="80" placeholder="한 마디" style="flex:1;min-width:0" autocomplete="off"><button class="btn sm" type="submit">보내기</button></form>` : ''}
  </div>${notes}`;
}

let chatKey = '';
function renderChat(ctx) {
  const el = document.getElementById('chat'); if (!el) return;
  const st = ctx.state;
  const k = `${ctx.gid}|${st.chatId || 0}|${!!st.over}|${(st.notes || []).length}|${(ctx.actors || []).join()}`;
  if (k === chatKey) return; chatKey = k;
  const inp = el.querySelector('#chatin'); const v = inp ? inp.value : '', foc = inp && document.activeElement === inp;
  el.innerHTML = chatHTML(ctx);
  const ni = el.querySelector('#chatin'); if (ni) { ni.value = v; if (foc) ni.focus(); }
  const log = el.querySelector('.chatlog'); if (log) log.scrollTop = log.scrollHeight;
}

/* ---------- top-level render ---------- */
function render() {
  if (G.screen === 'home') return renderHome();
  if (G.screen === 'setup') return renderSetup();
  if (G.screen === 'guest') return renderGuest();
  if (G.screen === 'play') return renderPlayFrame();
}

const topbar = (right = '') => `<header class="wrap top"><button class="mark" data-go="home">판<span>.</span></button><div class="sp"></div>${right}${G.guest ? '' : `<button class="btn sm ghost" data-cmd="gemini">Gemini${LLM.ready() ? '' : ' 연결'}</button>`}</header>`;

function renderHome() {
  const code = (location.hash.match(/join=([A-Za-z0-9]+)/) || [])[1] || '';
  root.innerHTML = `${topbar()}
  <main class="wrap">
    <section class="hero">
      <div><h1>오늘의 판을 고르세요</h1><p>혼자 AI와, 한 화면에서 여럿이, 또는 방 코드로 친구와.</p></div>
      <form class="joinbox" data-form="join"><input type="text" name="code" maxlength="5" placeholder="방 코드" value="${esc(code)}" aria-label="방 코드" autocomplete="off"><button class="btn" type="submit">참가</button></form>
    </section>
    <section class="games">${GAMES.map((g, i) => `
      <button class="gtile" data-go="setup:${g.id}">
        <span class="no">${String(i + 1).padStart(2, '0')}</span>
        <span class="glyph" aria-hidden="true">${g.glyph}</span>
        <h2>${esc(g.title)}</h2>
        <p class="spread"><span>${esc(g.src)}</span><span>${g.players[0] === g.players[1] ? g.players[0] : g.players[0] + '–' + g.players[1]}인</span></p>
      </button>`).join('')}
    </section>
  </main>`;
  if (code) root.querySelector('input[name=code]').focus();
}

/* ---------- setup (host) ---------- */
function openSetup(id) {
  const g = byId(id);
  const prev = G.setup && G.setup.game === id ? G.setup : null;
  const n = prev ? prev.seats.length : g.def;
  const opts = prev ? prev.opts : Object.fromEntries((g.options || []).map(o => [o.k, o.d]));
  const seats = prev ? prev.seats : range(n).map(i => i === 0 ? { name: '나', type: 'human' } : { name: AI_NAMES[i - 1], type: 'ai', level: 1 });
  G.setup = { game: id, seats, opts };
  G.screen = 'setup';
  ensureRoom();
  render();
  pushLobby();
}

function seatName(s, i) { return s.type === 'remote' ? (s.conn ? s.name : '대기 중') : s.name; }

function renderSetup() {
  const g = byId(G.setup.game), S = G.setup;
  const hasRemote = S.seats.some(s => s.type === 'remote');
  const ready = S.seats.every(s => s.type !== 'remote' || s.conn) && (!hasRemote || G.room?.ready);
  const link = G.room ? `${location.origin}${location.pathname}#join=${G.room.code}` : '';
  root.innerHTML = `${topbar()}
  <main class="wrap setup">
    <div>
      <h1>${esc(g.title)}</h1>
      <p class="src">${esc(g.src)}</p>
      <ol class="rules">${g.rules.map(r => `<li>${r}</li>`).join('')}</ol>
    </div>
    <div>
      <div class="panel">
        <div class="spread"><h3>플레이어</h3>
          ${g.players[0] !== g.players[1] ? `<div class="seg">${range(g.players[1] - g.players[0] + 1).map(k => { const v = g.players[0] + k; return `<button data-cmd="n" data-v="${v}" class="${S.seats.length === v ? 'on' : ''}">${v}</button>`; }).join('')}</div>` : ''}
        </div>
        ${S.seats.map((s, i) => `
        <div class="seat">
          <span class="swatch" style="background:${pc(i)}"></span>
          ${s.type === 'remote' ? `<span class="${s.conn ? '' : 'muted'}">${esc(seatName(s, i))}</span>` : `<input type="text" value="${esc(s.name)}" maxlength="10" data-cmd="name" data-v="${i}" aria-label="이름">`}
          <select data-cmd="type" data-v="${i}" aria-label="종류">
            <option value="human" ${s.type === 'human' ? 'selected' : ''}>사람</option>
            <option value="ai" ${s.type === 'ai' ? 'selected' : ''}>AI</option>
            <option value="remote" ${s.type === 'remote' ? 'selected' : ''} ${i === 0 ? 'disabled' : ''}>온라인</option>
          </select>
          ${s.type === 'ai' ? `<select data-cmd="level" data-v="${i}" aria-label="AI 수준">${LEVELS.map((l, k) => `<option value="${k}" ${s.level === k ? 'selected' : ''}>${l}</option>`).join('')}${g.llm ? `<option value="${GEMINI}" ${s.level === GEMINI ? 'selected' : ''} ${LLM.ready() ? '' : 'disabled'}>Gemini${LLM.ready() ? '' : ' (키 필요)'}</option>` : ''}</select>` : '<span></span>'}
          ${s.type === 'ai' && s.level === GEMINI ? `<span></span><span class="muted small">성격</span><select data-cmd="persona" data-v="${i}" aria-label="성격">${Object.entries(LLM.PERSONAS).map(([k, p]) => `<option value="${k}" ${(s.persona || 'bluff') === k ? 'selected' : ''}>${p.name}</option>`).join('')}</select><span></span>` : ''}
        </div>`).join('')}
      </div>
      ${(g.options || []).length ? `<div class="panel"><h3>설정</h3>${g.options.map(o => `
        <div class="optrow"><span>${esc(o.label)}</span><div class="seg">${o.ch.map(([v, l]) => `<button data-cmd="opt" data-v="${esc(JSON.stringify([o.k, v]))}" class="${S.opts[o.k] === v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
      ${hasRemote ? `<div class="panel"><h3>온라인 방</h3>${G.room ? `
        <div class="roomline"><span class="code">${G.room.code}</span><button class="btn sm" data-cmd="copy" data-v="${esc(link)}">링크 복사</button></div>
        <p class="note mt">${G.room.ready ? '이 코드나 링크로 들어오면 빈 온라인 자리에 앉아요.' : (G.room.err ? esc(G.room.err) : '방 여는 중')}</p>` : '<p class="note">방 여는 중</p>'}</div>` : ''}
      <div class="row mt2"><button class="btn primary lg" data-cmd="start" ${ready ? '' : 'disabled'}>시작</button>${hasRemote && !ready ? '<span class="note">온라인 자리가 다 차면 시작할 수 있어요</span>' : ''}</div>
    </div>
  </main>`;
}

function ensureRoom() {
  if (G.room || !G.setup.seats.some(s => s.type === 'remote')) return;
  if (!window.Peer) { G.room = { code: '-----', err: '네트워크 모듈을 불러오지 못했어요. 새로고침해 주세요.' }; return; }
  const code = net.newCode();
  G.room = { code, ready: false };
  G.room.peer = net.host(code, {
    open: () => { G.room.ready = true; if (G.screen === 'setup') render(); },
    error: e => { if (e.type === 'unavailable-id') { G.room = null; ensureRoom(); } else { G.room.err = '연결 오류: ' + e.type; if (G.screen === 'setup') render(); } },
    join: conn => {
      const seats = G.setup.seats;
      const free = seats.findIndex(s => s.type === 'remote' && !s.conn);
      if (free < 0) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
      seats[free].conn = conn; seats[free].name = (conn.metadata && conn.metadata.name) || '손님';
      conn._seat = free;
      if (G.screen === 'setup') render();
      pushLobby();
      if (G.screen === 'play') broadcast();
    },
    data: (conn, d) => {
      if (d.t === 'hello') { const s = G.setup.seats[conn._seat]; if (s) { s.name = String(d.name || '손님').slice(0, 10); } if (G.screen === 'setup') render(); pushLobby(); if (G.screen === 'play') { renderStage(); broadcast(); } }
      if (d.t === 'act' && G.engine && conn._seat != null) G.engine.act(conn._seat, d.a);
    },
    leave: conn => {
      const s = G.setup.seats[conn._seat];
      if (!s || s.conn !== conn) return;
      s.conn = null;
      if (G.screen === 'play' && G.engine && !G.engine.state.over) { s.type = 'ai'; s.level = 1; s.name += ' (AI)'; }
      else s.name = '대기 중';
      render(); pushLobby();
    },
  });
}

function pushLobby() {
  if (!G.room || !G.setup) return;
  const g = byId(G.setup.game);
  G.setup.seats.forEach((s, i) => {
    if (s.type === 'remote' && s.conn && s.conn.open) s.conn.send({ t: 'lobby', game: g.id, you: i, opts: G.setup.opts, seats: G.setup.seats.map((x, k) => ({ name: seatName(x, k), type: x.type })) });
  });
}

function startGame() {
  const S = G.setup, g = byId(S.game);
  if (G.engine) G.engine.stop();
  uiStore = {}; lastFx = 0; resultShownFor = null; curtainSeat = null;
  G.engine = new Engine(g, S.seats, S.opts, () => { if (G.screen === 'play') scheduleStage(); broadcast(); });
  G.engineId = Math.random();
  G.screen = 'play';
  render();
  broadcast();
}

function names() { return G.setup.seats.map((s, i) => seatName(s, i)); }

function broadcast() {
  if (!G.room || !G.engine) return;
  const msg = { t: 'state', game: G.setup.game, state: G.engine.state, now: Date.now(), names: names(), gid: G.engineId };
  G.setup.seats.forEach((s, i) => { if (s.type === 'remote' && s.conn && s.conn.open) s.conn.send({ ...msg, you: i }); });
}

/* ---------- play frame ---------- */
function renderPlayFrame() {
  const isGuest = !!G.guest;
  const g = byId(isGuest ? G.guest.game : G.setup.game);
  const code = isGuest ? G.guest.code : G.room?.code;
  root.innerHTML = `${topbar(`${code ? `<span class="ctx">방 <b class="code" style="font-size:16px">${esc(code)}</b></span>` : ''}<span class="ctx">${esc(g.title)}</span>${isGuest ? '' : '<button class="btn sm ghost" data-cmd="tosetup">설정</button>'}`)}
  <main class="wrap play"><div class="stage" id="stage"></div><div id="chat" class="mt2" style="max-width:640px"></div></main>`;
  stageKey = '';
  renderStage();
}

let stagePending = false;
function scheduleStage() { if (stagePending) return; stagePending = true; requestAnimationFrame(() => { stagePending = false; renderStage(); }); }

function makeCtx() {
  if (G.guest) {
    const gs = G.guest;
    const g = byId(gs.game);
    return { g, state: gs.state, seat: gs.you, actors: [gs.you], names: gs.names, online: true, offset: gs.offset,
      send: (s, a) => gs.conn.send({ t: 'act', a }), gid: gs.gid };
  }
  const g = byId(G.setup.game), st = G.engine.state, seats = G.setup.seats;
  const locals = seats.map((s, i) => s.type === 'human' ? i : -1).filter(i => i >= 0);
  const base = { g, state: st, names: names(), offset: 0, online: !!G.room, send: (s, a) => { const e = G.engine.act(s, a); if (e && e !== 'over') shakeStage(); }, gid: G.engineId, locals };
  if (locals.length === 0) return { ...base, seat: -1, actors: [] };
  if (locals.length === 1) return { ...base, seat: locals[0], actors: locals };
  const w = st.over ? [] : g.waiting(st).filter(i => locals.includes(i));
  const priv = g.isPrivate ? g.isPrivate(st) : g.private;
  if (priv && w.length) {
    if (curtainSeat != null && w.includes(curtainSeat)) return { ...base, seat: curtainSeat, actors: [curtainSeat] };
    return { ...base, curtain: w[0] };
  }
  curtainSeat = null;
  if (w.length) return { ...base, seat: w[0], actors: [w[0]], table: false };
  return { ...base, seat: -1, actors: locals, table: true };
}

function shakeStage() { const s = document.getElementById('stage'); if (!s) return; s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); }

function renderStage() {
  const el = document.getElementById('stage');
  if (!el) return;
  const ctx = makeCtx();
  if (!ctx.state) { el.innerHTML = '<div class="curtain"><div><h2>연결 중</h2></div></div>'; return; }
  ctx.now = () => Date.now() + (ctx.offset || 0);
  ctx.ui = uiStore;
  if (ctx.curtain != null) {
    el.innerHTML = `<div class="curtain"><div><p class="muted">화면을 넘겨주세요</p><h2 style="color:${pc(ctx.curtain)}">${esc(ctx.names[ctx.curtain])}</h2><p class="muted mt">다른 사람은 보지 않기</p><button class="btn primary lg mt2" data-cmd="reveal" data-v="${ctx.curtain}">확인</button></div></div>`;
    return;
  }
  const st = ctx.state;
  const fresh = st.fx && st.fx.id !== lastFx ? st.fx : null;
  ctx.newChat = st.chatId && st.chatId !== lastChat ? st.chat[st.chat.length - 1] : null;
  renderChat(ctx);
  ctx.fresh = kind => fresh && (!kind || fresh.kind === kind) ? fresh : null;
  // preserve inputs
  const keep = {};
  el.querySelectorAll('input[id][data-keep]').forEach(i => { keep[i.id] = { v: i.value, k: i.dataset.keep, f: document.activeElement === i }; });
  el.innerHTML = ctx.g.render(ctx);
  el.querySelectorAll('input[id][data-keep]').forEach(i => { const k = keep[i.id]; if (k && k.k === i.dataset.keep) { i.value = k.v; if (k.f) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch { } } } });
  const af = el.querySelector('[data-autofocus]'); if (af && !el.contains(document.activeElement)) af.focus({ preventScroll: true });
  if (ctx.g.after) ctx.g.after(el, ctx);
  if (fresh) {
    lastFx = fresh.id;
    el.querySelectorAll('[data-burst]').forEach(b => FX.burst(b, b.dataset.burst || undefined));
  }
  tickTimers();
  lastChat = st.chatId || 0;
  const rs = document.querySelector('.result .say'); if (rs && st.over) { const c = (st.chat || []).filter(x => x.at > (st.overAt || 0)).slice(-1)[0]; if (c) { rs.innerHTML = `<b style="color:${pc(c.i)}">${esc(ctx.names[c.i])}</b> ${esc(c.t)}`; } }
  if (st.over && resultShownFor !== ctx.gid) { resultShownFor = ctx.gid; setTimeout(() => showResult(ctx), 900); }
}

function showResult(ctx) {
  const st = ctx.state, o = st.over;
  const iWon = ctx.seat >= 0 && o.winners.includes(ctx.seat);
  const lost = ctx.seat >= 0 && !iWon;
  const head = ctx.seat < 0 ? (o.winners.length ? `${o.winners.map(i => ctx.names[i]).join(', ')} 승리` : '무승부') : iWon ? (o.winners.length > 1 ? '공동 승리' : '승리') : (o.winners.length ? '패배' : '무승부');
  const wrap = document.createElement('div');
  wrap.className = `result ${lost ? 'lose' : 'win'}`;
  const host = !G.guest;
  wrap.innerHTML = `<div class="card-r" role="dialog" aria-label="결과">
    <h2>${esc(head)}</h2>
    ${o.note ? `<p class="muted mt">${o.note}</p>` : ''}
    <p class="say mt small" style="text-align:left"></p>
    <ol>${(o.rows || []).map(r => `<li><span style="color:${pc(r.i)}">${esc(ctx.names[r.i])}</span><span>${esc(r.v)}</span></li>`).join('')}</ol>
    <div class="row" style="justify-content:center">${host ? '<button class="btn primary" data-cmd="again">다시 하기</button><button class="btn" data-cmd="tosetup">설정</button>' : '<span class="note">방장이 다시 시작하면 이어져요</span>'}<button class="btn ghost" data-cmd="closeres">보드 보기</button></div>
  </div>`;
  document.body.appendChild(wrap);
  if (lost) { document.getElementById('stage')?.animate([{ filter: 'grayscale(0)' }, { filter: 'grayscale(.85) brightness(.8)' }], { duration: 1600, fill: 'forwards' }); FX.lose(); }
  else FX.win();
}
function closeResult() { document.querySelectorAll('.result').forEach(r => r.remove()); }

/* ---------- guest ---------- */
function joinRoom(code) {
  code = code.trim().toUpperCase();
  if (!code) return;
  if (!window.Peer) { alert('네트워크 모듈을 불러오지 못했어요.'); return; }
  const name = (localStorageGet('pan-name') || '').slice(0, 10) || '손님';
  G.guest = { code, status: '연결 중', name };
  G.screen = 'guest'; render();
  G.guest.peer = net.join(code, {
    open: conn => { G.guest.conn = conn; G.guest.status = '연결됨'; conn.send({ t: 'hello', name: G.guest.name }); render(); },
    data: d => {
      const gs = G.guest; if (!gs) return;
      if (d.t === 'full') { gs.status = '자리가 없어요'; render(); }
      if (d.t === 'lobby') { gs.lobby = d; gs.you = d.you; if (G.screen !== 'guest') { G.screen = 'guest'; closeResult(); } render(); }
      if (d.t === 'state') {
        const newGame = gs.gid !== d.gid;
        Object.assign(gs, { state: d.state, game: d.game, names: d.names, you: d.you, offset: d.now - Date.now(), gid: d.gid });
        if (newGame) { uiStore = {}; lastFx = 0; closeResult(); }
        if (G.screen !== 'play' || newGame) { G.screen = 'play'; renderPlayFrame(); } else scheduleStage();
      }
    },
    close: () => { if (G.guest) { G.guest.status = '연결이 끊겼어요'; G.screen = 'guest'; render(); } },
    error: e => { if (G.guest) { G.guest.status = e.type === 'peer-unavailable' ? '그 코드의 방이 없어요' : '연결 오류'; render(); } },
  });
}

function renderGuest() {
  const gs = G.guest, lb = gs.lobby, g = lb && byId(lb.game);
  root.innerHTML = `${topbar(`<span class="ctx">방 <b class="code" style="font-size:16px">${esc(gs.code)}</b></span>`)}
  <main class="wrap setup">
    <div>${g ? `<h1>${esc(g.title)}</h1><p class="src">${esc(g.src)}</p><ol class="rules">${g.rules.map(r => `<li>${r}</li>`).join('')}</ol>` : `<h1>${esc(gs.status)}</h1>`}</div>
    <div>
      <div class="panel"><h3>내 이름</h3><form class="row" data-form="gname"><input type="text" name="name" maxlength="10" value="${esc(gs.name)}" aria-label="이름"><button class="btn" type="submit">바꾸기</button></form></div>
      ${lb ? `<div class="panel"><h3>자리</h3>${lb.seats.map((s, i) => `<div class="seat"><span class="swatch" style="background:${pc(i)}"></span><span>${esc(s.name)}${i === lb.you ? ' (나)' : ''}</span><span class="muted small">${s.type === 'ai' ? 'AI' : s.type === 'remote' ? '온라인' : '방장 쪽'}</span><span></span></div>`).join('')}</div>
      <p class="note mt">방장이 시작하면 바로 넘어가요.</p>` : `<p class="note mt">${esc(gs.status)}</p>`}
    </div>
  </main>`;
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { } }

/* ---------- timers ---------- */
function tickTimers() {
  const off = G.guest ? (G.guest.offset || 0) : 0;
  const now = Date.now() + off;
  document.querySelectorAll('[data-until]').forEach(e => { const s = Math.max(0, Math.ceil((+e.dataset.until - now) / 1000)); const t = s + '초'; if (e.textContent !== t) e.textContent = t; });
  document.querySelectorAll('[data-from]').forEach(e => { const a = +e.dataset.from, b = +e.dataset.to; const p = Math.max(0, Math.min(1, (b - now) / (b - a))); e.style.transform = `scaleX(${p})`; });
}
setInterval(() => { tickTimers(); const st = G.guest ? G.guest.state : G.engine?.state; const g = G.screen === 'play' && byId(G.guest ? G.guest.game : G.setup?.game); if (g && g.live && st && !st.over) scheduleStage(); }, 150);

/* ---------- events ---------- */
root.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) {
    const v = go.dataset.go;
    if (v === 'home') { leaveAll(); G.screen = 'home'; history.replaceState(null, '', location.pathname); render(); }
    else if (v.startsWith('setup:')) openSetup(v.slice(6));
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) {
    const { s, a: action } = JSON.parse(a.dataset.act);
    const ctx = makeCtx();
    if (ctx.actors && ctx.actors.includes(s)) ctx.send(s, action);
    return;
  }
  const u = e.target.closest('[data-ui]');
  if (u && !u.disabled) {
    const ctx = makeCtx(); ctx.now = () => Date.now() + (ctx.offset || 0); ctx.ui = uiStore;
    ctx.g.onUi && ctx.g.onUi(u.dataset.ui, JSON.parse(u.dataset.v || 'null'), ctx, u);
    renderStage();
    return;
  }
  const c = e.target.closest('[data-cmd]');
  if (c && (c.tagName === 'BUTTON')) cmd(c.dataset.cmd, c.dataset.v, c);
});
document.body.addEventListener('click', e => { const c = e.target.closest('.result [data-cmd]'); if (c) cmd(c.dataset.cmd, c.dataset.v, c); });

root.addEventListener('change', e => {
  const c = e.target.closest('select[data-cmd], input[data-cmd]');
  if (!c) return;
  const S = G.setup, i = +c.dataset.v;
  if (c.dataset.cmd === 'name') { S.seats[i].name = c.value.slice(0, 10) || `P${i + 1}`; pushLobby(); }
  if (c.dataset.cmd === 'type') {
    const s = S.seats[i]; if (s.conn) { s.conn.close(); s.conn = null; }
    s.type = c.value;
    if (s.type === 'ai') { s.level = s.level ?? 1; s.name = AI_NAMES[i % AI_NAMES.length]; }
    if (s.type === 'human') s.name = i === 0 ? '나' : `P${i + 1}`;
    if (s.type === 'remote') s.name = '대기 중';
    ensureRoom(); render(); pushLobby();
  }
  if (c.dataset.cmd === 'level') { S.seats[i].level = +c.value; if (+c.value === GEMINI) { S.seats[i].persona = S.seats[i].persona || 'bluff'; } render(); }
  if (c.dataset.cmd === 'persona') S.seats[i].persona = c.value;
});

root.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fd = new FormData(f);
  if (f.dataset.form === 'join') joinRoom(String(fd.get('code') || ''));
  if (f.dataset.form === 'gname') { const n = String(fd.get('name') || '').trim().slice(0, 10); if (n) { G.guest.name = n; localStorageSet('pan-name', n); G.guest.conn?.send({ t: 'hello', name: n }); } }
  if (f.dataset.form === 'chat') {
    const t = String(fd.get('t') || '').trim(); if (!t) return;
    const ctx = makeCtx(); ctx.send(+fd.get('s'), { chat: t }); f.querySelector('#chatin').value = '';
    return;
  }
  if (f.dataset.form === 'game') {
    const ctx = makeCtx(); ctx.now = () => Date.now() + (ctx.offset || 0); ctx.ui = uiStore;
    ctx.g.onForm && ctx.g.onForm(fd, ctx, f, e.submitter);
    renderStage();
  }
});

root.addEventListener('keydown', e => {
  if (G.screen !== 'play') return;
  const ctx = makeCtx(); if (!ctx.g?.onKey || ctx.curtain != null) return;
  if (e.target.matches('input, select, textarea')) return;
  ctx.now = () => Date.now() + (ctx.offset || 0); ctx.ui = uiStore;
  if (ctx.g.onKey(e.key, ctx)) { e.preventDefault(); renderStage(); }
});

function cmd(c, v, el) {
  const S = G.setup;
  if (c === 'n') {
    const n = +v, g = byId(S.game);
    while (S.seats.length < n) { const i = S.seats.length; S.seats.push({ name: AI_NAMES[i - 1] || `AI ${i}`, type: 'ai', level: 1 }); }
    while (S.seats.length > n) { const s = S.seats.pop(); if (s.conn) s.conn.close(); }
    render(); pushLobby();
  }
  if (c === 'opt') { const [k, val] = JSON.parse(v); S.opts[k] = val; render(); pushLobby(); }
  if (c === 'start') startGame();
  if (c === 'gemini') openGemini();
  if (c === 'copy') { navigator.clipboard?.writeText(v).then(() => { el.textContent = '복사됨'; setTimeout(() => { el.textContent = '링크 복사'; }, 1400); }); }
  if (c === 'reveal') { curtainSeat = +v; renderStage(); }
  if (c === 'again') { closeResult(); startGame(); }
  if (c === 'tosetup') { closeResult(); if (G.engine) { G.engine.stop(); G.engine = null; } G.screen = 'setup'; render(); pushLobby(); }
  if (c === 'closeres') closeResult();
}

function leaveAll() {
  closeResult();
  if (G.engine) { G.engine.stop(); G.engine = null; }
  if (G.room?.peer) { try { G.room.peer.destroy(); } catch { } }
  if (G.guest?.peer) { try { G.guest.peer.destroy(); } catch { } }
  if (G.setup) G.setup.seats.forEach(s => { if (s.type === 'remote') { s.conn = null; s.name = '대기 중'; } });
  G.room = null; G.guest = null;
}

window.addEventListener('beforeunload', () => { try { G.room?.peer?.destroy(); G.guest?.peer?.destroy(); } catch { } });

// boot
const m = location.hash.match(/join=([A-Za-z0-9]{5})/);
if (m) { const tryJoin = () => window.Peer ? joinRoom(m[1]) : setTimeout(tryJoin, 200); render(); tryJoin(); }
else render();
