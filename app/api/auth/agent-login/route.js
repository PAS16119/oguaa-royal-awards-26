import { sql } from '@/lib/db';
import { verifyPin, createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { cookies } from 'next/headers';

export async function POST(req) {
  const { agentId, pin } = await req.json();
  const id = (agentId || '').trim().toUpperCase();
  const rows = await sql`SELECT * FROM agents WHERE id = ${id}`;
  if (rows.length === 0) {
    return Response.json({ error: 'Agent ID not found.' }, { status: 404 });
  }
  const agent = rows[0];
  if (!agent.active) {
    return Response.json({ error: 'This agent account has been deactivated.' }, { status: 403 });
  }
  const ok = await verifyPin(pin || '', agent.pin_hash);
  if (!ok) {
    return Response.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }
  await sql`UPDATE agents SET last_login_at = now() WHERE id = ${id}`;
  await logAudit({ type: 'agent', id: agent.id, name: agent.name }, 'agent_login', {});

  const token = await createSessionToken({ role: 'agent', id: agent.id, name: agent.name });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true, id: agent.id, name: agent.name });
}
