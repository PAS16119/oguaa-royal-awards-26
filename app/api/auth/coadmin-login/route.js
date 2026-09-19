import { sql } from '@/lib/db';
import { verifyPin, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';

export async function POST(req) {
  const { adminId, pin } = await req.json();
  const id = (adminId || '').trim().toUpperCase();
  const rows = await sql`SELECT * FROM coadmins WHERE id = ${id}`;
  if (rows.length === 0) {
    return Response.json({ error: 'Co-Admin ID not found.' }, { status: 404 });
  }
  const co = rows[0];
  if (!co.active) {
    return Response.json({ error: 'This co-admin account has been deactivated.' }, { status: 403 });
  }
  const ok = await verifyPin(pin || '', co.pin_hash);
  if (!ok) {
    return Response.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }
  await sql`UPDATE coadmins SET last_login_at = now() WHERE id = ${id}`;
  await logAudit({ type: 'co-admin', id: co.id, name: co.name }, 'coadmin_login', {});

  const token = await createSessionToken({ role: 'co-admin', id: co.id, name: co.name });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true, id: co.id, name: co.name });
}
