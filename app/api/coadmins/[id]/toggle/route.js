import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id).toUpperCase();
  const { active } = await req.json();
  const rows = await sql`SELECT * FROM coadmins WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Co-Admin not found.' }, { status: 404 });

  await sql`UPDATE coadmins SET active = ${!!active} WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, active ? 'coadmin_reactivated' : 'coadmin_deactivated', { coAdminId: id, coAdminName: rows[0].name });

  return Response.json({ ok: true });
}
