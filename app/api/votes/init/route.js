import { sql } from '@/lib/db';
import { initializeTransaction, paystackConfigured } from '@/lib/paystack';
import { newVoteReference } from '@/lib/votes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json();
  const cfgRows = await sql`SELECT * FROM config WHERE id = 'main'`;
  const cfg = cfgRows[0] || {};

  if (!cfg.voting_enabled) {
    return Response.json({ error: 'Voting is not open right now.' }, { status: 400 });
  }
  if (!paystackConfigured()) {
    return Response.json({ error: 'Online payment is not configured yet. Please contact the committee.' }, { status: 500 });
  }
  const now = new Date();
  if (cfg.voting_open_date && now < new Date(String(cfg.voting_open_date).slice(0, 10))) {
    return Response.json({ error: 'Voting has not opened yet.' }, { status: 400 });
  }
  if (cfg.voting_close_date && now > new Date(String(cfg.voting_close_date).slice(0, 10) + 'T23:59:59')) {
    return Response.json({ error: 'Voting has closed.' }, { status: 400 });
  }

  const candRows = await sql`SELECT * FROM candidates WHERE id = ${body.candidateId}`;
  if (candRows.length === 0 || !candRows[0].active) {
    return Response.json({ error: 'That candidate is not open for voting.' }, { status: 400 });
  }
  const candidate = candRows[0];

  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  if (!name) return Response.json({ error: 'Please enter your name.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: 'Paystack needs a valid email to send your receipt.' }, { status: 400 });
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return Response.json({ error: 'Please enter a working phone number.' }, { status: 400 });
  }

  // Votes and price are computed ENTIRELY from what the server already knows
  // — a package looked up by ID, or the admin-configured per-vote price.
  // Nothing about the amount is ever taken from the request body directly.
  let votes, amountPesewas, packageId = null;

  if (body.packageId) {
    const pkgRows = await sql`SELECT * FROM vote_packages WHERE id = ${body.packageId} AND active = true`;
    if (pkgRows.length === 0) return Response.json({ error: 'That vote package is no longer available.' }, { status: 400 });
    votes = pkgRows[0].votes;
    amountPesewas = Math.round(Number(pkgRows[0].price_ghs) * 100);
    packageId = pkgRows[0].id;
  } else {
    const maxVotes = parseInt(cfg.max_votes_per_purchase) || 500;
    const requested = Math.max(1, Math.min(maxVotes, parseInt(body.votes) || 1));
    votes = requested;
    amountPesewas = Math.round(Number(cfg.vote_price_ghs || 1) * requested * 100);
  }

  const reference = newVoteReference();
  const origin = req.headers.get('origin') || new URL(req.url).origin;

  await sql`
    INSERT INTO vote_payments (reference, candidate_id, package_id, votes, buyer_name, email, phone, amount_pesewas, currency, status)
    VALUES (${reference}, ${candidate.id}, ${packageId}, ${votes}, ${name}, ${email}, ${phone}, ${amountPesewas}, 'GHS', 'pending')
  `;

  try {
    const data = await initializeTransaction({
      email, amountPesewas, reference,
      callbackUrl: `${origin}/vote/callback`,
      metadata: {
        purpose: 'votes', candidate_id: candidate.id, votes, buyer_name: name, phone,
        custom_fields: [
          { display_name: 'Voting for', variable_name: 'candidate', value: candidate.nominee_name },
          { display_name: 'Votes', variable_name: 'votes', value: String(votes) },
        ],
      },
    });
    return Response.json({ authorization_url: data.authorization_url, reference });
  } catch (e) {
    await sql`UPDATE vote_payments SET status = 'failed' WHERE reference = ${reference}`;
    return Response.json({ error: e.message || 'Could not start the payment.' }, { status: 502 });
  }
}
