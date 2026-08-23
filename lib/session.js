import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE } from './auth';

// Read + verify the current caller's session from the httpOnly cookie.
// Returns null if there's no session or it's invalid/expired.
export async function getSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function requireMainAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'main-admin') return null;
  return session;
}

export async function requireAnySession() {
  const session = await getSession();
  if (!session) return null;
  return session;
}
