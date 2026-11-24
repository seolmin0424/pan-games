// Tiny safe expression language for generated hidden rules (no eval).
// numbers, variables, + - * / (floor division) % ^, parentheses, functions below.
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const FN = {
  max: (...x) => Math.max(...x), min: (...x) => Math.min(...x), abs: x => Math.abs(x),
  digitsum: x => String(Math.abs(Math.trunc(x))).split('').reduce((s, d) => s + +d, 0),
  rev: x => (x < 0 ? -1 : 1) * +String(Math.abs(Math.trunc(x))).split('').reverse().join(''),
  len: x => String(Math.abs(Math.trunc(x))).length,
  gcd, lcm: (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0),
  concat: (...x) => +x.map(v => Math.abs(Math.trunc(v))).join(''),
  sq: x => x * x, sum: (...x) => x.reduce((a, b) => a + b, 0),
  odd: (...x) => x.filter(v => Math.abs(v) % 2 === 1).length, even: (...x) => x.filter(v => v % 2 === 0).length,
  distinct: (...x) => new Set(x).size,
  if: (c, a, b) => (c ? a : b), gt: (a, b) => +(a > b), eq: (a, b) => +(a === b),
};
export const FUNCS = Object.keys(FN);

export function compile(src, vars) {
  const toks = String(src).match(/\d+|[A-Za-z_]\w*|[-+*/%^(),]/g) || [];
  if (toks.join('').length !== String(src).replace(/\s+/g, '').length) throw new Error('bad char');
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const expect = t => { if (next() !== t) throw new Error('expected ' + t); };
  function expr() { let n = term(); while (peek() === '+' || peek() === '-') { const op = next(), r = term(), l = n; n = op === '+' ? e => l(e) + r(e) : e => l(e) - r(e); } return n; }
  function term() {
    let n = unary();
    while (['*', '/', '%'].includes(peek())) {
      const op = next(), r = unary(), l = n;
      n = op === '*' ? e => l(e) * r(e) : op === '/' ? e => { const d = r(e); if (!d) throw 0; return Math.floor(l(e) / d); } : e => { const d = r(e); if (!d) throw 0; return ((l(e) % d) + Math.abs(d)) % Math.abs(d); };
    }
    return n;
  }
  function unary() { if (peek() === '-') { next(); const u = unary(); return e => -u(e); } return pow(); }
  function pow() { const b = atom(); if (peek() === '^') { next(); const x = unary(); return e => { const p = x(e); if (p > 6 || p < 0) throw 0; return b(e) ** p; }; } return b; }
  function atom() {
    const t = next();
    if (t === undefined) throw new Error('end');
    if (/^\d+$/.test(t)) { const v = +t; return () => v; }
    if (t === '(') { const n = expr(); expect(')'); return n; }
    if (/^[A-Za-z_]/.test(t)) {
      if (peek() === '(') {
        const f = FN[t.toLowerCase()]; if (!f) throw new Error('unknown fn ' + t);
        next(); const args = [];
        if (peek() !== ')') { args.push(expr()); while (peek() === ',') { next(); args.push(expr()); } }
        expect(')');
        return e => f(...args.map(a => a(e)));
      }
      const k = vars.indexOf(t.toLowerCase()); if (k < 0) throw new Error('unknown var ' + t);
      return e => e[k];
    }
    throw new Error('bad token ' + t);
  }
  const fn = expr();
  if (i !== toks.length) throw new Error('trailing');
  return (...vals) => { const v = fn(vals); if (!Number.isFinite(v) || Math.abs(v) > 1e7 || !Number.isInteger(v)) throw 0; return v; };
}

// check a generated rule is usable: always defined on samples and not trivial
export function validate(src, vars, sample) {
  let f; try { f = compile(src, vars); } catch (e) { return null; }
  const outs = new Set();
  for (let k = 0; k < 300; k++) { const v = sample(); let r; try { r = f(...v); } catch { return null; } outs.add(r); }
  return outs.size >= 6 ? f : null;
}
