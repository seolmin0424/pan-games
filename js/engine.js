// Authoritative game runner (host side)
export class Engine {
  constructor(game, seats, opts, onChange) {
    this.game = game; this.seats = seats; this.opts = opts; this.onChange = onChange;
    this.state = game.setup(seats.length, opts, Date.now());
    this.ver = 0; this.aiBusy = {};
    this.timer = setInterval(() => this.loop(), 200);
  }
  act(seat, a) {
    if (this.state.over) return 'over';
    let err;
    try { err = this.game.act(this.state, seat, a, Date.now()); } catch (e) { console.error(e); err = 'error'; }
    if (err) return err;
    this.bump();
  }
  bump() { this.ver++; this.onChange(); }
  loop() {
    const now = Date.now();
    if (this.state.over) return;
    if (this.game.tick) { try { if (this.game.tick(this.state, now)) this.bump(); } catch (e) { console.error(e); } }
    if (this.state.over) return;
    this.seats.forEach((s, i) => {
      if (s.type !== 'ai' || this.aiBusy[i]) return;
      let r = null;
      try { r = this.game.ai(this.state, i, now, s.level ?? 1); } catch (e) { console.error(e); }
      if (!r) return;
      this.aiBusy[i] = true;
      setTimeout(() => { this.aiBusy[i] = false; this.act(i, r.a); }, Math.max(0, r.d ?? 700));
    });
  }
  stop() { clearInterval(this.timer); }
}
