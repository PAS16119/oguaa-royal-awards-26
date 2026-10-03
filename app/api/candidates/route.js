import { sql } from '@/lib/db';
import { requireSection } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';
import { genId, genBallotCode } from '@/lib/codegen';

export const dynamic = 'force-dynamic';

// GET — public: every active candidate with live vote counts, for /vote.
// GET ?all=1 — admin/co-admin only: every candidate, for ballot management.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const wantAll = searchParams.get('all') === '1';

  if (wantAll) {
    const session = await requireSection('voting');
    if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await sql`SELECT * FROM candidates ORDER BY section_label, award_name, votes DESC`;
    return Response.json({ candidates: rows });
  }

  // Public ballot. Ordered by name (not by votes) so the order itself never
  // leaks who is ahead on /vote while results are closed.
  const rows = await sql`
    SELECT id, award_id, section_key, section_label, award_name, nominee_name,
           nominee_class, nominee_house, photo_url, votes, ballot_code
    FROM candidates WHERE active = true
    ORDER BY section_label, award_name, nominee_name
  `;

  // Rank within each category, computed here so the public can be shown a
  // ranking without ever receiving the scores. Ties share a rank; a candidate
  // with 0 votes has no rank yet.
  const groups = {};
  rows.forEach(c => { (groups[`${c.section_label || ''}|${c.award_name || ''}`] ||= []).push(c); });
  const rankOf = new Map();
  Object.values(groups).forEach(list => {
    const sorted = [...list].sort((a, b) => Number(b.votes) - Number(a.votes));
    let r = 0, prev = null;
    sorted.forEach((c, i) => {
      const v = Number(c.votes);
      if (v !== prev) { r = i + 1; prev = v; }
      rankOf.set(c.id, v > 0 ? r : null);
    });
  });

  // Results switch. ON  = everyone sees each nominee's vote count.
  //                OFF = everyone except admins sees ranking only, no scores.
  // Total votes / money raised are never in this response at all.
  const cfgRows = await sql`SELECT results_public FROM config WHERE id = 'main'`;
  const resultsPublic = cfgRows[0]?.results_public !== false;
  const isAdmin = !!(await requireSection('voting'));
  const showScores = resultsPublic || isAdmin;

  const out = rows.map(c => ({
    ...c,
    votes: showScores ? Number(c.votes) : null,
    rank: rankOf.get(c.id),
  }));

  return Response.json({ candidates: out, resultsPublic, showScores });
}

// POST — promote a paid-track nomination onto the ballot. Admin or Co-Admin.
// Deliberately manual: nothing lands on the ballot without someone choosing it.
export async function POST(req) {
  const session = await requireSection('voting');
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

  // Ballot code is what a feature phone dials into the USSD menu, so it has
  // to be unique — retry on the rare collision (1-in-900 odds per attempt).
  let ballotCode = genBallotCode();
  let clash = await sql`SELECT 1 FROM candidates WHERE ballot_code = ${ballotCode}`;
  while (clash.length > 0) {
    ballotCode = genBallotCode();
    clash = await sql`SELECT 1 FROM candidates WHERE ballot_code = ${ballotCode}`;
  }

  await sql`
    INSERT INTO candidates
      (id, nomination_id, award_id, section_key, section_label, award_name,
       nominee_name, nominee_class, nominee_house, photo_url, votes, active, created_at, created_by, ballot_code)
    VALUES
      (${id}, ${nominationId}, ${nom.award_id}, ${nom.section_key}, ${nom.section_label}, ${nom.category},
       ${nom.nominee_name}, ${nom.nominee_class}, ${nom.nominee_house}, ${nom.photo_url}, 0, true, now(), ${session.role}, ${ballotCode})
  `;
  await logAudit(actorFromSession(session), 'candidate_added', { candidateId: id, nominee: nom.nominee_name, award: nom.category, ballotCode });

  return Response.json({ ok: true, id, ballotCode });
}
