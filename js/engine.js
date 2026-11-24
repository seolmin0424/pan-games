// Authoritative game runner (host side)
import * as LLM from './llm.js';

export const GEMINI = 3; // ai level meaning "Gemini drives this seat"
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Engine {
  constructor(game, seats, opts, onChange) {
    this.game = game; this.seats = seats; this.opts = opts; this.onChange = onChange;
    this.state = game.setup(seats.length, opts, Date.now());
    this.state.chat = [];
    this.ver = 0; this.aiBusy = {}; this.lastTalk = {}; this.learned = false; this.jobs = {}; this.seenFx = 0;
    this.timer = setInterval(() => this.loop(), 200);
  }
  names() { return this.seats.map(s => s.name); }
  usesGemini(i) { const s = this.seats[i]; return !!s && s.type === 'ai' && s.level === GEMINI && LLM.ready() && !!(this.game.llm || this.game.brief); }
  geminiSeats() { return this.seats.map((s, i) => i).filter(i => this.usesGemini(i)); }
  say(i, t) {
    t = String(t || '').trim().slice(0, 160); if (!t) return;
    this.state.chat.push({ i, t, at: Date.now() });
    if (this.state.chat.length > 60) this.state.chat.shift();
    this.state.chatId = (this.state.chatId || 0) + 1;
  }
  act(seat, a) {
    if (a && typeof a.chat === 'string') { this.say(seat, a.chat); this.bump(); this.replyToChat(seat); return; }
    if (this.state.over) return 'over';
    let err;
    try { err = this.game.act(this.state, seat, a, Date.now()); } catch (e) { console.error(e); err = 'error'; }
    if (err) return err;
    this.bump();
  }
  bump() {
    this.ver++;
    if (this.state.over && !this.learned) { this.learned = true; this.state.overAt = Date.now(); try { this.game.learn && this.game.learn(this.state, this.seats); } catch (e) { console.error(e); } this.afterGame(); }
    this.reactFx();
    this.onChange();
  }
  loop() {
    const now = Date.now();
    if (this.state.over) return;
    this.runJobs();
    if (this.game.tick) { try { if (this.game.tick(this.state, now)) this.bump(); } catch (e) { console.error(e); } }
    if (this.state.over) return;
    this.seats.forEach((s, i) => {
      if (s.type !== 'ai' || this.aiBusy[i]) return;
      let r = null;
      try { r = this.game.ai(this.state, i, now, Math.min(2, s.level ?? 1)); } catch (e) { console.error(e); }
      if (!r) return;
      this.aiBusy[i] = true;
      if (this.usesGemini(i) && this.game.llm) { this.runGemini(i, r); return; }
      setTimeout(() => {
        this.aiBusy[i] = false;
        const err = this.act(i, r.a);
        if (!err && this.usesGemini(i) && Math.random() < .3) this.talk(i, this.game.myEvent ? this.game.myEvent(this.state, i, r.a) : '네가 방금 수를 뒀다');
      }, Math.max(0, r.d ?? 700));
    });
  }
  runJobs() {
    if (!this.game.job) return;
    let j; try { j = this.game.job(this.state, LLM.ready()); } catch (e) { console.error(e); return; }
    if (!j || this.jobs[j.key]) return;
    this.jobs[j.key] = 1;
    (async () => {
      let data = null;
      try { data = await j.run(); } catch (e) { console.warn('job failed', e); }
      try { j.apply(this.state, data, Date.now()); } catch (e) { console.error(e); }
      this.bump();
    })();
  }
  async runGemini(i, fallback) {
    const t0 = Date.now();
    this.state.thinking = i; this.bump();
    let out = null;
    try { out = await this.game.llm(this.state, i, { names: this.names(), persona: this.seats[i].persona, fallback: fallback.a }); }
    catch (e) { console.warn('gemini fallback', e); }
    const minWait = out && out.fast ? 0 : 900;
    const wait = minWait - (Date.now() - t0); if (wait > 0) await sleep(wait);
    if (this.state.thinking === i) this.state.thinking = -1;
    if (this.state.over) { this.aiBusy[i] = false; this.bump(); return; }
    if (out && out.say) this.say(i, out.say);
    if (out && out.note) { this.state.notes = this.state.notes || []; this.state.notes.push({ i, t: out.note }); }
    if (out && out.skip) { this.aiBusy[i] = false; this.bump(); return; }
    const err = out && out.a ? this.act(i, out.a) : 'none';
    if (err) {
      if (out && out.a) await sleep(fallback.d ? Math.min(fallback.d, 1500) : 400);
      const r = (() => { try { return this.game.ai(this.state, i, Date.now(), 2); } catch { return null; } })();
      if (!r || this.act(i, r.a)) this.bump();
    }
    this.aiBusy[i] = false;
  }
  async talk(i, event) {
    if (!this.game.brief || Date.now() - (this.lastTalk[i] || 0) < 8000) return;
    this.lastTalk[i] = Date.now();
    try { const t = await LLM.talk(this.state, i, this.names(), this.seats[i].persona, this.game.brief(this.state, i), event); if (t && !this.state.over) { this.say(i, t); this.bump(); } } catch (e) { console.warn(e); }
  }
  reactFx() {
    const f = this.state.fx; if (!f || f.id === this.seenFx) return;
    this.seenFx = f.id;
    if (!this.game.eventText) return;
    const gs = this.geminiSeats(); if (!gs.length) return;
    const i = gs[Math.floor(Math.random() * gs.length)];
    let ev = null; try { ev = this.game.eventText(this.state, f, i, this.names()); } catch { }
    if (ev && Math.random() < .55) this.talk(i, ev);
  }
  async replyToChat(from) {
    if (!LLM.ready() || !this.game.brief) return;
    const cands = this.geminiSeats().filter(i => i !== from);
    if (!cands.length) return;
    const i = cands[Math.floor(Math.random() * cands.length)];
    if (Date.now() - (this.lastTalk[i] || 0) < 2500) return;
    this.lastTalk[i] = Date.now();
    try { const t = await LLM.reply(this.state, i, this.names(), this.seats[i].persona, this.game.brief(this.state, i)); if (t) { this.say(i, t); this.bump(); } } catch (e) { console.warn(e); }
  }
  async afterGame() {
    const gs = this.geminiSeats(); if (!gs.length) return;
    const gi = gs[0], names = this.names();
    try {
      let t;
      if (this.game.postgame) t = await this.game.postgame(this.state, gi, { names, persona: this.seats[gi].persona });
      else if (this.game.summary) {
        const won = this.state.over.winners.includes(gi);
        const r = await LLM.json(`너는 두뇌 게임 "${this.game.title}"을 방금 끝낸 참가자 "${names[gi]}"다. ${LLM.personaLine(this.seats[gi].persona)}
결과: ${won ? '네가 이겼다' : '네가 졌다'}.
경기 기록:
${this.game.summary(this.state, names)}
다른 참가자들에게 캐릭터 말투로 소감 한 마디와 승부처에 대한 한 줄 분석을 합쳐 100자 이내로. 이모지 금지.
JSON: {"say": "..."}`, { timeout: 15000 });
        t = String(r.say || '').slice(0, 160);
      }
      if (t) { this.say(gi, t); this.onChange(); }
    } catch (e) { console.warn(e); }
  }
  stop() { clearInterval(this.timer); }
}
