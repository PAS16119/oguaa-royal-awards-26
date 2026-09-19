import { sql } from '@/lib/db';
import { verifyTransaction, fulfilPayment, paystackConfigured } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/paystack/verify?reference=ORA-XXXX
// Called by /buy/callback right after Paystack sends the buyer back, and
// again by the buyer if they reopen the receipt link later.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  if (!reference) return Response.json({ error: 'No payment reference supplied.' }, { status: 400 });

  const rows = await sql`SELECT * FROM payments WHERE reference = ${reference}`;
  if (rows.length === 0) return Response.json({ error: 'We have no record of that payment reference.' }, { status: 404 });
  const p = rows[0];

  if (p.status === 'paid') {
    return Response.json({ status: 'paid', codes: p.codes || [], quantity: p.quantity, buyer: p.buyer_name });
  }
  if (!paystackConfigured()) {
    return Response.json({ error: 'Online payment is not configured on the server.' }, { status: 500 });
  }

  try {
    const verified = await verifyTransaction(reference);
    const result = await fulfilPayment(reference, verified);
    if (result.failed) {
      return Response.json({ status: 'failed', message: 'Paystack reports this payment did not go through.' });
    }
    return Response.json({ status: 'paid', codes: result.codes, quantity: p.quantity, buyer: p.buyer_name });
  } catch (e) {
    return Response.json({ error: e.message || 'Could not verify that payment.' }, { status: 502 });
  }
}
