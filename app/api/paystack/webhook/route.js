import crypto from 'crypto';
import { fulfilPayment, paystackSecret } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Paystack calls this server-to-server. It is the safety net: if a buyer
// closes the browser before being redirected back, the codes are still
// issued here, and the buyer can fetch them from /buy/callback later.
export async function POST(req) {
  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') || '';

  let expected;
  try {
    expected = crypto.createHmac('sha512', paystackSecret()).update(raw).digest('hex');
  } catch {
    return new Response('Not configured', { status: 500 });
  }
  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return new Response('Bad payload', { status: 400 }); }

  if (event?.event === 'charge.success' && event?.data?.reference) {
    try {
      await fulfilPayment(event.data.reference, event.data);
    } catch (e) {
      // Log and still answer 200 — Paystack retries on non-2xx, and a
      // permanent error (unknown reference) would be retried forever.
      console.error('Paystack fulfilment failed:', e.message);
    }
  }

  return new Response('ok', { status: 200 });
}
