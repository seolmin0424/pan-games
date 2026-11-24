// Authoritative game runner (host side)
import * as LLM from './llm.js';

export const GEMINI = 3; // ai level meaning "Gemini drives this seat"
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Engine {
  constructor(game, seats, opts, onChange) {
    this.game = game; this.seats = seats; this.opts = opts; this.onChange = onChange;
    this.state = game.setup(seats.length, opts, Date.now());
    this.state.chat = [];
    this.ver = 0; this.aiBusy = {}; this.lastReply = {}; this.learned = false;
    this.timer = setInterval(() => this.loop(), 200);
  }
  names() { return this.seats.map(s => s.name); }
  usesGemini(i) { const s = this.seats[i]; return s.type === 'ai' && s.level === GEMINI && this.game.llm && LLM.ready(); }
  say(i, t) {
    t = String(t || '').trim().slice(0, 120); if (!t) return;
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
    this.onChange();
  }
  loop() {
    const now = Date.now();
    if (this.state.over) return;
    if (this.game.tick) { try { if (this.game.tick(this.state, now)) this.bump(); } catch (e) { console.error(e); } }
    if (this.state.over) return;
    this.seats.forEach((s, i) => {
      if (s.type !== 'ai' || this.aiBusy[i]) return;
      let r = null;
      try { r = this.game.ai(this.state, i, now, Math.min(2, s.level ?? 1)); } catch (e) { console.error(e); }
      if (!r) return;
      this.aiBusy[i] = true;
      if (this.usesGemini(i)) { this.runGemini(i, r); return; }
      setTimeout(() => { this.aiBusy[i] = false; this.act(i, r.a); }, Math.max(0, r.d ?? 700));
    });
  }
  async runGemini(i, fallback) {
    const v0 = this.ver, t0 = Date.now();
    this.state.thinking = i; this.bump();
    let out = null;
    try { out = await this.game.llm(this.state, i, { names: this.names(), persona: this.seats[i].persona, fallback: fallback.a }); }
    catch (e) { console.warn('gemini fallback', e); }
    const wait = 900 - (Date.now() - t0); if (wait > 0) await sleep(wait);
    this.state.thinking = -1;
    if (this.state.over) { this.aiBusy[i] = false; return; }
    if (out && out.say) this.say(i, out.say);
    if (out && out.note) { this.state.notes = this.state.notes || []; this.state.notes.push({ i, t: out.note, tag: out.tag || '' }); }
    let err = out && out.a ? this.act(i, out.a) : 'none';
    if (err) { const r = (() => { try { return this.game.ai(this.state, i, Date.now(), 2); } catch { return null; } })(); if (r) this.act(i, r.a); else this.bump(); }
    this.aiBusy[i] = false;
    void v0;
  }
  async replyToChat(from) {
    if (!LLM.ready() || !this.game.brief) return;
    const cands = this.seats.map((s, i) => i).filter(i => i !== from && this.usesGemini(i) && Date.now() - (this.lastReply[i] || 0) > 3500);
    if (!cands.length) return;
    const i = cands[Math.floor(Math.random() * cands.length)];
    this.lastReply[i] = Date.now();
    try {
      const t = await LLM.reply(this.state, i, this.names(), this.seats[i].persona, this.game.brief(this.state, i));
      if (t) { this.say(i, t); this.bump(); }
    } catch (e) { console.warn(e); }
  }
  async afterGame() {
    if (!this.game.postgame || !LLM.ready()) return;
    const gi = this.seats.findIndex((s, i) => this.usesGemini(i));
    if (gi < 0) return;
    try { const t = await this.game.postgame(this.state, gi, { names: this.names(), persona: this.seats[gi].persona }); if (t) { this.say(gi, t); this.onChange(); } } catch (e) { console.warn(e); }
  }
  stop() { clearInterval(this.timer); }
}
