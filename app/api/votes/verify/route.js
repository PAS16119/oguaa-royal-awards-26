import { sql } from '@/lib/db';
import { verifyTransaction, paystackConfigured } from '@/lib/paystack';
import { fulfilVotePayment } from '@/lib/votes';
import { requireSection } from '@/lib/session';
import { getVisibility } from '@/lib/results';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  if (!reference) return Response.json({ error: 'No payment reference supplied.' }, { status: 400 });

  const rows = await sql`SELECT * FROM vote_payments WHERE reference = ${reference}`;
  if (rows.length === 0) return Response.json({ error: 'We have no record of that payment reference.' }, { status: 404 });
  const p = rows[0];

  async function candidateSnapshot() {
    const c = await sql`SELECT id, nominee_name, award_name, votes FROM candidates WHERE id = ${p.candidate_id}`;
    if (!c[0]) return null;
    // Same rule as the results pages: when results are closed, a voter's
    // thank-you screen must not reveal the nominee's running total either.
    const vis = await getVisibility();
    const open = vis.mode === 'full' || !!(await requireSection('voting'));
    return open ? c[0] : { ...c[0], votes: null };
  }

  if (p.status === 'paid') {
    return Response.json({ status: 'paid', votes: p.votes, candidate: await candidateSnapshot() });
  }
  if (p.status === 'voided') {
    return Response.json({ status: 'voided' });
  }
  if (!paystackConfigured()) {
    return Response.json({ error: 'Online payment is not configured on the server.' }, { status: 500 });
  }

  try {
    const verified = await verifyTransaction(reference);
    const result = await fulfilVotePayment(reference, verified);
    if (result.failed) {
      return Response.json({ status: 'failed', message: 'Paystack reports this payment did not go through.' });
    }
    return Response.json({ status: 'paid', votes: p.votes, candidate: await candidateSnapshot() });
  } catch (e) {
    return Response.json({ error: e.message || 'Could not verify that payment.' }, { status: 502 });
  }
}
