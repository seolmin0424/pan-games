// Gemini client. Key lives only in this browser's localStorage.
const KEY = 'pan-gemini-key', MODEL = 'pan-gemini-model';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const get = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const set = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { } };

export const key = () => get(KEY);
export const model = () => get(MODEL) || 'gemini-2.5-flash';
export const ready = () => !!key();
export function save(k, m) { set(KEY, k.trim()); if (m) set(MODEL, m); }

export async function listModels(k = key()) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': k } });
  if (!r.ok) throw new Error(`키 확인 실패 (${r.status})`);
  const j = await r.json();
  return (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => /^gemini-/.test(n) && !/(image|tts|audio|live|embedding|vision|exp-\d{4})/.test(n));
}
export function pickDefault(names) {
  const score = n => { const m = n.match(/^gemini-(\d+(?:\.\d+)?)-(flash|pro)(-lite)?(.*)$/); if (!m) return -1; return +m[1] * 10 + (m[2] === 'flash' ? 3 : 1) - (m[3] ? 2 : 0) - (m[4] ? 1 : 0); };
  return names.slice().sort((a, b) => score(b) - score(a))[0];
}

export async function json(prompt, { timeout = 15000, temperature = 1 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`${BASE}/models/${model()}:generateContent`, {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature } }),
    });
    if (!r.ok) throw new Error('gemini ' + r.status);
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim());
  } finally { clearTimeout(t); }
}

export const PERSONAS = {
  calc: { name: '계산형', desc: '냉정하고 말수가 적다. 확률과 숫자로 말한다. 감정 표현이 거의 없다.' },
  bluff: { name: '허세형', desc: '자신감이 넘치고 과장한다. 자기 패나 계획에 대해 자주 거짓말을 한다.' },
  taunt: { name: '도발형', desc: '상대의 실수와 습관을 콕 집어 놀린다. 얄밉지만 선은 넘지 않는다.' },
  snake: { name: '능구렁이', desc: '친근하게 칭찬하고 동맹인 척하다가 뒤통수를 친다. 존댓말을 쓴다.' },
};
export const personaLine = p => `너의 캐릭터: ${(PERSONAS[p] || PERSONAS.bluff).name}. ${(PERSONAS[p] || PERSONAS.bluff).desc}`;

export function chatLog(state, names, n = 12) {
  return (state.chat || []).slice(-n).map(c => `${names[c.i] ?? '?'}: ${c.t}`).join('\n') || '(없음)';
}

// in-character reply to table talk
export async function reply(state, seat, names, persona, brief) {
  const p = `너는 한국 두뇌 서바이벌 예능의 참가자 "${names[seat]}"다. ${personaLine(persona)}
지금 상황: ${brief}
최근 대화:
${chatLog(state, names)}
마지막 말에 캐릭터답게 한 마디로 받아쳐라. 40자 이내, 반말 또는 캐릭터 말투, 이모지 금지. 너의 실제 남은 점수나 다음 수를 사실대로 밝히지 마라(허세나 거짓말은 괜찮다).
JSON으로만 답: {"say": "..."}`;
  const r = await json(p, { timeout: 10000 });
  return String(r.say || '').slice(0, 80);
}
