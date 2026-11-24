const PREFIX = 'pan-brain-room-';
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');

export function host(code, h) {
  const peer = new window.Peer(PREFIX + code);
  peer.on('open', () => h.open && h.open());
  peer.on('connection', conn => {
    conn.on('open', () => h.join(conn));
    conn.on('data', d => h.data(conn, d));
    conn.on('close', () => h.leave(conn));
    conn.on('error', () => h.leave(conn));
  });
  peer.on('error', e => h.error && h.error(e));
  return peer;
}

export function join(code, h) {
  const peer = new window.Peer();
  peer.on('open', () => {
    const conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
    conn.on('open', () => h.open(conn));
    conn.on('data', d => h.data(d));
    conn.on('close', () => h.close && h.close());
  });
  peer.on('error', e => h.error && h.error(e));
  return peer;
}
