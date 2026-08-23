import { sql } from '@/lib/db';
import { verifyPin, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';

export async function POST(req) {
  const { pin } = await req.json();
  const rows = await sql`SELECT pin_hash FROM admin_auth WHERE id = 'main'`;
  if (rows.length === 0) {
    return Response.json({ error: 'Main admin has not been set up yet.' }, { status: 400 });
  }
  const ok = await verifyPin(pin || '', rows[0].pin_hash);
  if (!ok) {
    return Response.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }
  await logAudit({ type: 'main-admin' }, 'admin_login', {});
  const token = await createSessionToken({ role: 'main-admin' });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true });
}
