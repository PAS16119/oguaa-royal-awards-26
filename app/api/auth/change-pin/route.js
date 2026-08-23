import { sql } from '@/lib/db';
import { hashPin, verifyPin } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(req) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Not logged in.' }, { status: 401 });

  const { currentPin, newPin } = await req.json();
  if (!newPin || newPin.length < 6) {
    return Response.json({ error: 'New PIN must be at least 6 characters.' }, { status: 400 });
  }

  if (session.role === 'main-admin') {
    const rows = await sql`SELECT pin_hash FROM admin_auth WHERE id = 'main'`;
    const ok = rows.length && await verifyPin(currentPin || '', rows[0].pin_hash);
    if (!ok) return Response.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
    const newHash = await hashPin(newPin);
    await sql`UPDATE admin_auth SET pin_hash = ${newHash}, updated_at = now() WHERE id = 'main'`;
    await logAudit({ type: 'main-admin' }, 'settings_updated', { change: 'main admin pin changed' });
  } else {
    const rows = await sql`SELECT * FROM agents WHERE id = ${session.id}`;
    if (rows.length === 0) return Response.json({ error: 'Agent not found.' }, { status: 404 });
    const ok = await verifyPin(currentPin || '', rows[0].pin_hash);
    if (!ok) return Response.json({ error: 'Current PIN is incorrect.' }, { status: 401 });
    const newHash = await hashPin(newPin);
    await sql`UPDATE agents SET pin_hash = ${newHash} WHERE id = ${session.id}`;
    await logAudit({ type: 'agent', id: session.id, name: session.name }, 'settings_updated', { change: 'agent pin changed' });
  }

  return Response.json({ ok: true });
}
