import { sql } from './db';
import { logAudit } from './audit';

// Votes use a distinct reference prefix from code purchases (which use
// "ORA-") so the single Paystack webhook can tell the two apart without
// needing two separate webhook URLs configured in the Paystack dashboard.
export function newVoteReference() {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORAV-${Date.now().toString(36).toUpperCase()}-${r}`;
}

export function isVoteReference(reference) {
  return typeof reference === 'string' && reference.startsWith('ORAV-');
}

// Turns a successful vote payment into credited votes on the candidate.
// Safe to call more than once for the same reference — the webhook and the
// callback page both call this, and whichever arrives second is a no-op
// because the status is only ever 'pending' -> 'paid' once.
export async function fulfilVotePayment(reference, verified) {
  const rows = await sql`SELECT * FROM vote_payments WHERE reference = ${reference}`;
  if (rows.length === 0) throw new Error('Unknown vote payment reference.');
  const p = rows[0];

  if (p.status === 'paid') return { alreadyFulfilled: true, payment: p };
  if (p.status === 'voided') return { voided: true, payment: p };

  if (!verified || verified.status !== 'success') {
    await sql`UPDATE vote_payments SET status = 'failed', raw = ${JSON.stringify(verified || {})} WHERE reference = ${reference}`;
    return { failed: true, payment: p };
  }
  // Trust nothing from the browser — the amount actually paid, per Paystack,
  // must meet or exceed what we recorded when checkout started.
  if (Number(verified.amount) < Number(p.amount_pesewas)) {
    await sql`UPDATE vote_payments SET status = 'failed', raw = ${JSON.stringify(verified)} WHERE reference = ${reference}`;
    throw new Error('Amount paid does not match the amount due.');
  }

  // Single atomic increment — Postgres serializes concurrent UPDATEs to the
  // same row, so two near-simultaneous fulfilments of *different* references
  // for the same candidate still both land correctly.
  await sql`UPDATE candidates SET votes = votes + ${p.votes} WHERE id = ${p.candidate_id}`;
  await sql`
    UPDATE vote_payments SET status = 'paid', paid_at = now(),
      channel = ${verified.channel || null}, raw = ${JSON.stringify(verified)}
    WHERE reference = ${reference}
  `;

  await logAudit(
    { type: 'online', id: reference, name: p.buyer_name },
    'votes_purchased',
    { reference, candidateId: p.candidate_id, votes: p.votes, amountGHS: Number(p.amount_pesewas) / 100 },
  );

  return { payment: { ...p, status: 'paid' } };
}
