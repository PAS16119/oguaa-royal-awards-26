import { sql } from '@/lib/db';
import { requireMainAdmin, ADMIN_SECTIONS } from '@/lib/session';
import { logAudit } from '@/lib/audit';

const VALID_KEYS = ADMIN_SECTIONS.map(([key]) => key);

// POST { permissions: { awards: true, codes: false, ... } | null }
// null means "full access" — same as a co-admin created before this feature
// existed. Their current session stays valid until they log in again (the
// session token, not a live DB lookup, is what every route checks) — tell
// them to log out and back in if you need the change to apply immediately.
export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id).toUpperCase();
  const rows = await sql`SELECT * FROM coadmins WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Co-Admin not found.' }, { status: 404 });

  const { permissions } = await req.json();
  let perms = null;
  if (permissions && typeof permissions === 'object') {
    perms = {};
    for (const key of VALID_KEYS) perms[key] = permissions[key] === true;
  }

  await sql`UPDATE coadmins SET permissions = ${perms ? JSON.stringify(perms) : null}::jsonb WHERE id = ${id}`;
  await logAudit({ type: 'main-admin' }, 'coadmin_permissions_updated', { coAdminId: id, coAdminName: rows[0].name, permissions: perms });

  return Response.json({ ok: true, permissions: perms });
}
