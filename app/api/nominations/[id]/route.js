import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { del } from '@vercel/blob';

export async function DELETE(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id);
  const rows = await sql`SELECT * FROM nominations WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  const nom = rows[0];

  if (nom.photo_url) {
    try { await del(nom.photo_url); } catch (e) { /* ignore, not fatal */ }
  }

  await sql`DELETE FROM nominations WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, 'nomination_deleted', { nominationId: id, nominee: nom.nominee_name, category: nom.category });

  return Response.json({ ok: true });
}
