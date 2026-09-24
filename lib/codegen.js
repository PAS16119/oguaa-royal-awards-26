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

// Ballot codes are digits-only (not the ABCDEFGH... alphabet above) because
// they're meant to be typed on a feature-phone keypad mid-USSD-session,
// where letters mean multi-tap. 3 digits (100-999) gives 900 candidates
// before a collision is even possible — comfortably more than one award
// season needs. The caller (app/api/candidates/route.js) retries on clash.
export function genBallotCode() {
  return String(100 + Math.floor(Math.random() * 900));
}

export function sanitizeFile(s) {
  return (s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
