import { sql } from '@/lib/db';
import { hashPin, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// GET: has a main admin PIN already been created?
export async function GET() {
  const rows = await sql`SELECT id FROM admin_auth WHERE id = 'main'`;
  return Response.json({ exists: rows.length > 0 });
}

// POST: one-time creation of the main admin PIN. Refuses if one already exists.
export async function POST(req) {
  const { pin } = await req.json();
  if (!pin || pin.length < 6) {
    return Response.json({ error: 'PIN must be at least 6 characters.' }, { status: 400 });
  }
  const existing = await sql`SELECT id FROM admin_auth WHERE id = 'main'`;
  if (existing.length > 0) {
    return Response.json({ error: 'A main admin PIN already exists.' }, { status: 409 });
  }
  const pinHash = await hashPin(pin);
  await sql`INSERT INTO admin_auth (id, pin_hash, updated_at) VALUES ('main', ${pinHash}, now())`;
  await logAudit({ type: 'main-admin' }, 'main_admin_setup', {});

  const token = await createSessionToken({ role: 'main-admin' });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true });
}
