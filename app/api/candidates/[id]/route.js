import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// PATCH — edit a candidate, or show/hide them on the public ballot. Admin or Co-Admin.
export async function PATCH(req, { params }) {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = params.id;
  const rows = await sql`SELECT * FROM candidates WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Candidate not found.' }, { status: 404 });
  const cur = rows[0];
  const b = await req.json();

  await sql`
    UPDATE candidates SET
      nominee_name = ${b.nomineeName ?? cur.nominee_name},
      photo_url    = ${b.photoUrl ?? cur.photo_url},
      active       = ${typeof b.active === 'boolean' ? b.active : cur.active}
    WHERE id = ${id}
  `;
  await logAudit(actorFromSession(session), 'candidate_updated', { candidateId: id });
  return Response.json({ ok: true });
}

// DELETE — remove a candidate. Blocked once they have votes (deactivate
// instead), so a paid, fundraised vote can never silently disappear.
export async function DELETE(req, { params }) {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = params.id;
  const rows = await sql`SELECT * FROM candidates WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Candidate not found.' }, { status: 404 });
  if (Number(rows[0].votes) > 0) {
    return Response.json({
      error: 'This candidate already has votes. Deactivate instead of removing, so the record and the money raised stay intact.',
    }, { status: 400 });
  }

  await sql`DELETE FROM candidates WHERE id = ${id}`;
  await logAudit(actorFromSession(session), 'candidate_removed', { candidateId: id, nominee: rows[0].nominee_name });
  return Response.json({ ok: true });
}
