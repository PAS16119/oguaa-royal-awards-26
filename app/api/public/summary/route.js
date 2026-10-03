import { sql } from '@/lib/db';
import { paystackConfigured } from '@/lib/paystack';
import { requireSection } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const configRows = await sql`SELECT * FROM config WHERE id = 'main'`;
  const counts = await sql`
    SELECT COALESCE(track, 'paid') AS track, COUNT(*)::int AS count FROM nominations GROUP BY 1
  `;
  const awardCounts = await sql`
    SELECT s.track, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE a.nominable)::int AS nominable
    FROM awards a JOIN award_sections s ON s.key = a.section_key
    WHERE a.active AND s.active
    GROUP BY s.track
  `;

  const byTrack = Object.fromEntries(counts.map(r => [r.track, r.count]));
  const awardsByTrack = Object.fromEntries(awardCounts.map(r => [r.track, { total: r.total, nominable: r.nominable }]));

  // Voting totals — wrapped so the rest of the site still works before the
  // v4 migration (which adds these tables) has been run.
  let votesTotal = 0, voteRevenueGHS = 0, candidatesCount = 0;
  try {
    const voteTotals = await sql`SELECT COALESCE(SUM(votes),0)::int AS votes, COALESCE(SUM(amount_pesewas),0)::bigint AS pesewas FROM vote_payments WHERE status = 'paid'`;
    votesTotal = voteTotals[0].votes;
    voteRevenueGHS = Number(voteTotals[0].pesewas) / 100;
    const candRows = await sql`SELECT COUNT(*)::int AS n FROM candidates WHERE active = true`;
    candidatesCount = candRows[0].n;
  } catch { /* schema-v4 not applied yet */ }

  const body = {
    config: configRows[0] || null,
    paystackConfigured: paystackConfigured(),
    nominationCount: (byTrack.paid || 0) + (byTrack.free || 0),
    freeCount: byTrack.free || 0,
    awards: awardsByTrack,
    candidatesCount,
  };

  // Total votes and money raised are admin-only, whether results are open or
  // closed. The check is here in the API (not just hidden in the page), so
  // nobody can read the numbers by opening /api/public/summary directly.
  const adminSession = await requireSection('voting');
  if (adminSession && new URL(req.url).searchParams.get('as') !== 'public') {
    body.paidCount = byTrack.paid || 0;
    body.votesTotal = votesTotal;
    body.voteRevenueGHS = voteRevenueGHS;
  }
  return Response.json(body);
}
