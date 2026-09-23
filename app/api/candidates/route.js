import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';
import { genId } from '@/lib/codegen';

export const dynamic = 'force-dynamic';

// GET — public: every active candidate with live vote counts, for /vote.
// GET ?all=1 — admin/co-admin only: every candidate, for ballot management.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const wantAll = searchParams.get('all') === '1';

  if (wantAll) {
    const session = await requireAdminLevel();
    if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await sql`SELECT * FROM candidates ORDER BY section_label, award_name, votes DESC`;
    return Response.json({ candidates: rows });
  }

  const rows = await sql`
    SELECT id, award_id, section_key, section_label, award_name, nominee_name,
           nominee_class, nominee_house, photo_url, votes
    FROM candidates WHERE active = true
    ORDER BY section_label, award_name, votes DESC
  `;
  return Response.json({ candidates: rows });
}

// POST — promote a paid-track nomination onto the ballot. Admin or Co-Admin.
// Deliberately manual: nothing lands on the ballot without someone choosing it.
export async function POST(req) {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const { nominationId } = await req.json();
  const nomRows = await sql`SELECT * FROM nominations WHERE id = ${nominationId}`;
  if (nomRows.length === 0) return Response.json({ error: 'Nomination not found.' }, { status: 404 });
  const nom = nomRows[0];

  if ((nom.track || 'paid') !== 'paid') {
    return Response.json({ error: 'Only paid-track nominations can go on the voting ballot.' }, { status: 400 });
  }
  const existing = await sql`SELECT id FROM candidates WHERE nomination_id = ${nominationId}`;
  if (existing.length > 0) {
    return Response.json({ error: 'This nomination is already on the ballot.' }, { status: 400 });
  }

  const id = genId();
  await sql`
    INSERT INTO candidates
      (id, nomination_id, award_id, section_key, section_label, award_name,
       nominee_name, nominee_class, nominee_house, photo_url, votes, active, created_at, created_by)
    VALUES
      (${id}, ${nominationId}, ${nom.award_id}, ${nom.section_key}, ${nom.section_label}, ${nom.category},
       ${nom.nominee_name}, ${nom.nominee_class}, ${nom.nominee_house}, ${nom.photo_url}, 0, true, now(), ${session.role})
  `;
  await logAudit(actorFromSession(session), 'candidate_added', { candidateId: id, nominee: nom.nominee_name, award: nom.category });

  return Response.json({ ok: true, id });
}
