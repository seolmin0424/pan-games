// Canvas particle effects for results and big moments
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function canvas() {
  const c = document.createElement('canvas');
  c.className = 'fx';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.width = '100%'; c.style.height = '100%';
  document.body.appendChild(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  return { c, g };
}

function run(parts, step, ms) {
  if (reduce()) return;
  const { c, g } = canvas();
  const t0 = performance.now();
  const frame = t => {
    const e = t - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => step(g, p, e));
    if (e < ms) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}

export function win() {
  const cols = [css('--seg'), css('--accent'), css('--white-tile'), css('--p1'), css('--p2')];
  const W = innerWidth, H = innerHeight;
  const parts = [];
  for (let k = 0; k < 2; k++) {
    const ox = k ? W + 10 : -10;
    for (let i = 0; i < 90; i++) {
      const a = (k ? Math.PI + .35 : -.35) + (Math.random() - .5) * .9 + (k ? .4 : -.4) * Math.random();
      const v = 9 + Math.random() * 11;
      parts.push({ x: ox, y: H * .78, vx: Math.cos(a) * v * (k ? 1 : 1), vy: -Math.abs(Math.sin(a) * v) - 6 - Math.random() * 6,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 10, r: Math.random() * 6, vr: (Math.random() - .5) * .35, c: cols[i % cols.length], d: Math.random() * 300 });
    }
  }
  run(parts, (g, p, e) => {
    if (e < p.d) return;
    p.vy += .32; p.vx *= .99; p.vy *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
    g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.r * 2));
    g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
  }, 4200);
}

export function lose() {
  const W = innerWidth, H = innerHeight, col = css('--muted');
  const parts = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: -Math.random() * H * .6, s: 1 + Math.random() * 2.5, v: .6 + Math.random() * 1.2, ph: Math.random() * 6 }));
  run(parts, (g, p, e) => {
    p.y += p.v; p.x += Math.sin(e / 700 + p.ph) * .5;
    g.globalAlpha = Math.max(0, .55 - e / 9000); g.fillStyle = col;
    g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); g.globalAlpha = 1;
  }, 5000);
}

// small burst at an element (placement / scoring)
export function burst(el, color) {
  if (!el || reduce()) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const col = color || css('--seg');
  const parts = Array.from({ length: 22 }, (_, i) => { const a = i / 22 * Math.PI * 2; const v = 2 + Math.random() * 3.5; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v }; });
  run(parts, (g, p, e) => {
    p.x += p.vx; p.y += p.vy; p.vx *= .92; p.vy *= .92;
    g.globalAlpha = Math.max(0, 1 - e / 600); g.fillStyle = col;
    g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); g.globalAlpha = 1;
  }, 650);
}
