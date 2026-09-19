const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I, etc.)

function randFrom(chars, len) {
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function genAccessCode() {
  return 'ORA-' + randFrom(CODE_CHARS, 3) + '-' + randFrom(CODE_CHARS, 3);
}

export function genAgentId() {
  return 'AGT-' + randFrom('0123456789', 4);
}

export function genCoAdminId() {
  return 'ADM-' + randFrom('0123456789', 4);
}

export function randDigits(len) {
  return randFrom('0123456789', len);
}

export function genId() {
  return crypto.randomUUID();
}

export function sanitizeFile(s) {
  return (s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
