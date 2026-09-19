import { sql } from './db';
import { logAudit } from './audit';
import { genAccessCode } from './codegen';

const PAYSTACK_BASE = 'https://api.paystack.co';

export function paystackSecret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set in the environment.');
  return key;
}

export function paystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function paystack(path, init = {}) {
  const res = await fetch(PAYSTACK_BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack request failed (${res.status})`);
  }
  return data.data;
}

export function newReference() {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORA-${Date.now().toString(36).toUpperCase()}-${r}`;
}

export async function initializeTransaction({ email, amountPesewas, reference, callbackUrl, metadata }) {
  return paystack('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      currency: 'GHS',
      reference,
      callback_url: callbackUrl,
      metadata,
      // Mobile money first — that is how most buyers here will pay.
      channels: ['mobile_money', 'card', 'bank_transfer', 'ussd'],
    }),
  });
}

export async function verifyTransaction(reference) {
  return paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
}

// Turn a successful payment into access codes. Safe to call more than once
// for the same reference — the callback page and the webhook both call it,
// and whichever arrives second simply gets the codes already issued.
export async function fulfilPayment(reference, verified) {
  const rows = await sql`SELECT * FROM payments WHERE reference = ${reference}`;
  if (rows.length === 0) throw new Error('Unknown payment reference.');
  const p = rows[0];

  if (p.status === 'paid') return { codes: p.codes || [], alreadyFulfilled: true, payment: p };

  if (!verified || verified.status !== 'success') {
    await sql`UPDATE payments SET status = 'failed', raw = ${JSON.stringify(verified || {})} WHERE reference = ${reference}`;
    return { codes: [], failed: true, payment: p };
  }
  // Never trust the amount that came back from the browser — compare with
  // what we recorded when the checkout was created.
  if (Number(verified.amount) < Number(p.amount_pesewas)) {
    await sql`UPDATE payments SET status = 'failed', raw = ${JSON.stringify(verified)} WHERE reference = ${reference}`;
    throw new Error('Amount paid does not match the amount due.');
  }

  const codes = [];
  for (let i = 0; i < p.quantity; i++) {
    let code = genAccessCode();
    let clash = await sql`SELECT 1 FROM codes WHERE code = ${code}`;
    while (clash.length > 0) {
      code = genAccessCode();
      clash = await sql`SELECT 1 FROM codes WHERE code = ${code}`;
    }
    await sql`
      INSERT INTO codes (code, status, source, issued_by_type, issued_by_id, issued_by_name, created_at)
      VALUES (${code}, 'unused', 'paystack', 'online', ${reference}, ${'Online · ' + (p.buyer_name || 'Paystack')}, now())
    `;
    codes.push(code);
  }

  await sql`
    UPDATE payments SET status = 'paid', paid_at = now(), codes = ${codes}::text[],
      channel = ${verified.channel || null}, raw = ${JSON.stringify(verified)}
    WHERE reference = ${reference}
  `;
  await logAudit(
    { type: 'online', id: reference, name: p.buyer_name },
    'codes_purchased_online',
    { reference, quantity: p.quantity, amountGHS: Number(p.amount_pesewas) / 100, codes },
  );

  return { codes, payment: { ...p, status: 'paid' } };
}
