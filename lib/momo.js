import { paystackSecret } from './paystack';

// USSD has no browser, so it can't use initializeTransaction() +
// authorization_url like /vote does — there's nowhere to redirect a caller
// mid-dial. Paystack's Charge API solves this: you pass the phone + network
// directly, and Paystack itself prompts the customer's phone to approve
// (MTN) or asks for a voucher/OTP (Vodafone). Same underlying transaction
// type as a checkout, so the *same* /api/paystack/webhook and the *same*
// fulfilVotePayment() in lib/votes.js still do the crediting — nothing
// about the payment/vote-crediting logic is duplicated for USSD.
const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystack(path, body) {
  const res = await fetch(PAYSTACK_BASE + path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackSecret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(data.message || `Paystack request failed (${res.status})`);
  }
  return data.data;
}

// Arkesel reports the caller's network as "MTN" / "AIRTELTIGO" / "VODAFONE"
// (or "TELECEL" post-rebrand — mapped the same way). Paystack's mobile_money
// provider codes are the three-letter set below. Returns null for anything
// unrecognised so the caller can fall back to the web link instead of
// guessing a network and risking a failed/misrouted charge.
export function mapNetworkToProvider(network) {
  const n = String(network || '').toUpperCase();
  if (n.includes('MTN')) return 'mtn';
  if (n.includes('AIRTEL') || n.includes('TIGO') || n === 'ATL') return 'atl';
  if (n.includes('VODAFONE') || n.includes('TELECEL') || n === 'VOD') return 'vod';
  return null;
}

// Arkesel always sends phone numbers in international format (233XXXXXXXXX —
// see schema-v5.sql comment on ussd_sessions), but every Paystack mobile-money
// example uses local format (0XXXXXXXXX — their own documented test number is
// 055 123 498 7). Passing 233... straight through would silently fail the
// charge for every network, not just a wrong test number.
function toLocalFormat(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return '0' + digits.slice(3);
  return digits; // already local, or an unexpected shape — pass through as-is
}

// Kicks off a direct mobile-money debit. `reference` must be a vote_payments
// reference already inserted as 'pending' (same table /vote/init.js writes
// to) so the webhook has something to match against when charge.success
// arrives. Paystack requires an email even for USSD-originated charges —
// there isn't a real one to collect mid-session, so we synthesize one under
// your own real domain (Paystack rejects made-up TLDs like .local as
// "Invalid Email Address" even though nothing ever needs to receive it).
export async function chargeMobileMoney({ phone, provider, amountPesewas, reference, metadata }) {
  const localPhone = toLocalFormat(phone);
  return paystack('/charge', {
    email: `ussd-voter-${localPhone}@ora26.vercel.app`,
    amount: amountPesewas,
    currency: 'GHS',
    reference,
    mobile_money: { phone: localPhone, provider },
    metadata,
  });
}

// Vodafone (and occasionally AirtelTigo) charges come back `send_otp`
// instead of `pay_offline` — the caller has to read a voucher code off a
// prior *110# prompt or an SMS and type it back in. We collect that in the
// same USSD session (sessions run ~2.5 min, plenty of time) and forward it
// here before ending the session.
export async function submitOtp({ reference, otp }) {
  return paystack('/charge/submit_otp', { reference, otp });
}
