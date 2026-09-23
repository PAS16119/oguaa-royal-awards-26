import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const rows = await sql`
    SELECT vp.*, c.nominee_name, c.award_name
    FROM vote_payments vp
    LEFT JOIN candidates c ON c.id = vp.candidate_id
    ORDER BY vp.created_at DESC LIMIT 500
  `;
  return Response.json({ votePayments: rows });
}
