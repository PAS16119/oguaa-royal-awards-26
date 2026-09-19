import { sql } from '@/lib/db';
import { initializeTransaction, newReference, paystackConfigured } from '@/lib/paystack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json();

  const cfgRows = await sql`SELECT * FROM config WHERE id = 'main'`;
  const cfg = cfgRows[0] || {};

  if (!cfg.online_sales_enabled) {
    return Response.json({ error: 'Online purchase is switched off. Buy a code from a committee member or sales agent.' }, { status: 400 });
  }
  if (!paystackConfigured()) {
    return Response.json({ error: 'Online payment is not configured yet. Please contact the committee.' }, { status: 500 });
  }

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  const maxQty = parseInt(cfg.max_codes_per_purchase) || 10;
  const qty = Math.max(1, Math.min(maxQty, parseInt(body.quantity) || 1));

  if (!name) return Response.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Paystack needs a valid email to send your receipt.' }, { status: 400 });
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ error: 'Please enter a working phone number.' }, { status: 400 });
  }

  const price = Number(cfg.price_ghs || 10);
  const amountPesewas = Math.round(price * qty * 100);
  const reference = newReference();

  const origin = req.headers.get('origin') || new URL(req.url).origin;

  await sql`
    INSERT INTO payments (reference, buyer_name, email, phone, quantity, amount_pesewas, currency, status)
    VALUES (${reference}, ${name}, ${email}, ${phone}, ${qty}, ${amountPesewas}, 'GHS', 'pending')
  `;

  try {
    const data = await initializeTransaction({
      email,
      amountPesewas,
      reference,
      callbackUrl: `${origin}/buy/callback`,
      metadata: {
        buyer_name: name,
        phone,
        quantity: qty,
        custom_fields: [
          { display_name: 'Buyer', variable_name: 'buyer_name', value: name },
          { display_name: 'Codes', variable_name: 'quantity', value: String(qty) },
        ],
      },
    });
    return Response.json({ authorization_url: data.authorization_url, reference });
  } catch (e) {
    await sql`UPDATE payments SET status = 'failed' WHERE reference = ${reference}`;
    return Response.json({ error: e.message || 'Could not start the payment.' }, { status: 502 });
  }
}
