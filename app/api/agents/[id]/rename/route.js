import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id).toUpperCase();
  const { name } = await req.json();
  if (!name || !name.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });

  const rows = await sql`SELECT * FROM agents WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Agent not found.' }, { status: 404 });

  const oldName = rows[0].name;
  await sql`UPDATE agents SET name = ${name.trim()} WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, 'agent_renamed', { agentId: id, oldName, newName: name.trim() });

  return Response.json({ ok: true });
}
