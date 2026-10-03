import { sql } from '@/lib/db';
import { requireSection } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireSection('voting');
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`
    SELECT vp.*, c.nominee_name, c.award_name
    FROM vote_payments vp
    LEFT JOIN candidates c ON c.id = vp.candidate_id
    ORDER BY vp.created_at DESC LIMIT 500
  `;
  // Votes bought per day (admin only) — lets the committee see whether a change
  // such as hiding totals or adding a deal actually moved voting.
  const daily = await sql`
    SELECT to_char(date_trunc('day', paid_at), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(votes), 0)::int AS votes,
           COALESCE(SUM(amount_pesewas), 0)::bigint / 100.0 AS ghs,
           COUNT(*)::int AS purchases
    FROM vote_payments WHERE status = 'paid' AND paid_at IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 21`;
  return Response.json({ votePayments: rows, daily });
}
