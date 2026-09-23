import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// The only way a vote count is ever reduced. Main Admin only, requires a
// reason, and the original vote_payments row is kept forever (marked
// 'voided', never deleted) — so every reversal is itself auditable.
export async function POST(req, { params }) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const reference = decodeURIComponent(params.reference);
  const { reason } = await req.json();
  if (!reason || !reason.trim()) {
    return Response.json({ error: 'A reason is required to void a paid vote purchase.' }, { status: 400 });
  }

  const rows = await sql`SELECT * FROM vote_payments WHERE reference = ${reference}`;
  if (rows.length === 0) return Response.json({ error: 'Not found.' }, { status: 404 });
  const p = rows[0];
  if (p.status !== 'paid') {
    return Response.json({ error: 'Only a paid, credited purchase can be voided.' }, { status: 400 });
  }

  await sql`UPDATE candidates SET votes = GREATEST(0, votes - ${p.votes}) WHERE id = ${p.candidate_id}`;
  await sql`
    UPDATE vote_payments SET status = 'voided', voided_at = now(), void_reason = ${reason.trim()}
    WHERE reference = ${reference}
  `;
  await logAudit({ type: 'main-admin' }, 'votes_voided', { reference, candidateId: p.candidate_id, votes: p.votes, reason: reason.trim() });

  return Response.json({ ok: true });
}
