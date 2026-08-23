import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

function getSecret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    // Fail loudly in production so nobody accidentally ships an unsigned session.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET is not set. Add it in your Vercel project env vars.');
    }
    return new TextEncoder().encode('dev-only-insecure-secret');
  }
  return new TextEncoder().encode(raw);
}

export async function hashPin(pin) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin, hash) {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

export async function createSessionToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'ora_session';
