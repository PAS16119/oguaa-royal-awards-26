import { sql } from '@/lib/db';
import { requireAnySession } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET: public — anyone can check whether a code is valid before filling the form.
// Deliberately returns only status, never who issued it or any other detail.
export async function GET(req, { params }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const rows = await sql`SELECT code, status FROM codes WHERE code = ${code}`;
  if (rows.length === 0) return Response.json({ found: false });
  return Response.json({ found: true, status: rows[0].status });
}

// DELETE: void a code. Main admin can void any non-used code; an agent can
// only void codes they personally generated.
export async function DELETE(req, { params }) {
  const session = await requireAnySession();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const code = decodeURIComponent(params.code).toUpperCase();
  const rows = await sql`SELECT * FROM codes WHERE code = ${code}`;
  if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  const rec = rows[0];

  if (rec.status === 'used') {
    return Response.json({ error: 'Used codes cannot be voided.' }, { status: 400 });
  }
  if (session.role === 'agent' && !(rec.issued_by_type === 'agent' && rec.issued_by_id === session.id)) {
    return Response.json({ error: 'You can only void codes you generated yourself.' }, { status: 403 });
  }

  await sql`UPDATE codes SET status = 'void' WHERE code = ${code}`;
  await logAudit(actorFromSession(session), 'code_void', { code });

  return Response.json({ ok: true });
}
