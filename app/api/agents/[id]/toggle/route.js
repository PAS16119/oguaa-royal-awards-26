import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id).toUpperCase();
  const { active } = await req.json();
  const rows = await sql`SELECT * FROM agents WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Agent not found.' }, { status: 404 });

  await sql`UPDATE agents SET active = ${!!active} WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, active ? 'agent_reactivated' : 'agent_deactivated', { agentId: id, agentName: rows[0].name });

  return Response.json({ ok: true });
}
