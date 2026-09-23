import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = params.id;
  const rows = await sql`SELECT * FROM vote_packages WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Package not found.' }, { status: 404 });
  const cur = rows[0];
  const b = await req.json();

  await sql`
    UPDATE vote_packages SET
      label     = ${b.label ?? cur.label},
      votes     = ${b.votes ?? cur.votes},
      price_ghs = ${b.priceGHS ?? cur.price_ghs},
      active    = ${typeof b.active === 'boolean' ? b.active : cur.active}
    WHERE id = ${id}
  `;
  await logAudit({ type: 'main-admin' }, 'vote_package_updated', { id });
  return Response.json({ ok: true });
}

// Blocked once a purchase references this package — deactivate instead.
export async function DELETE(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = params.id;
  const rows = await sql`SELECT * FROM vote_packages WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Package not found.' }, { status: 404 });

  const used = await sql`SELECT COUNT(*)::int AS n FROM vote_payments WHERE package_id = ${id}`;
  if (used[0].n > 0) {
    return Response.json({ error: 'This package already has purchases. Deactivate it instead of deleting.' }, { status: 400 });
  }

  await sql`DELETE FROM vote_packages WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, 'vote_package_deleted', { id, label: rows[0].label });
  return Response.json({ ok: true });
}
