import { sql } from '@/lib/db';
import { getVisibility, categoryStats, shuffleWithinCategories } from '@/lib/results';
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

  // Public ballot. Group and award name come from the LIVE award list (via
  // award_id), not from the copy stored on each candidate when it was created.
  // That way moving or renaming an award can never leave some nominees filed
  // under the old group — one award is always exactly one slot. The stored
  // copy is only a fallback for any entry that has no award_id.
  // Ordered by the admin's own group/award order, then by name (never by votes,
  // so the order itself can't leak who is ahead).
  const rows = await sql`
    SELECT c.id, c.award_id,
           COALESCE(s.key,   c.section_key)   AS section_key,
           COALESCE(s.label, c.section_label) AS section_label,
           COALESCE(a.name,  c.award_name)    AS award_name,
           c.nominee_name, c.nominee_class, c.nominee_house, c.photo_url, c.votes, c.ballot_code
    FROM candidates c
    LEFT JOIN awards a ON a.id = c.award_id
    LEFT JOIN award_sections s ON s.key = a.section_key
    WHERE c.active = true
    ORDER BY COALESCE(s.sort_order, 9999), COALESCE(s.label, c.section_label),
             COALESCE(a.sort_order, 9999), COALESCE(a.name, c.award_name), c.nominee_name
  `;

  // What this viewer may see. Admins always see full votes. Everyone else gets
  // whatever the Main Admin chose: hidden (nothing), closed (ranking only),
  // percent (ranking + % share of the category) or full (ranking + each
  // nominee's votes). Total votes and money raised are never part of this
  // response in any mode. ?as=public lets a logged-in admin preview exactly
  // what a voter gets.
  const vis = await getVisibility();
  const asPublic = searchParams.get('as') === 'public';
  const isAdmin = !asPublic && !!(await requireSection('voting'));
  const viewMode = isAdmin ? 'full' : vis.mode;
  const stats = categoryStats(rows);
  // Shuffle: public sees a "not a ranking" order and no rank/badges. Admins always
  // see the truth. The order is fixed (same for everyone, on every page load)
  // until the admin presses Reshuffle, which just changes the seed.
  const shuffled = !isAdmin && vis.shuffle;
  const hideRank = viewMode === 'hidden' || shuffled;
  const ordered = shuffled ? shuffleWithinCategories(rows, vis.shuffleSeed) : rows;
  // Who the winners are is only sent once the admin has revealed them (or to an admin).
  const sendWinners = vis.winners || isAdmin;

  const out = ordered.map(c => {
    const st = stats.get(c.id) || {};
    return {
      ...c,
      votes: viewMode === 'full' ? Number(c.votes) : null,
      percent: viewMode === 'percent' ? st.percent : null,
      rank: hideRank ? null : (st.rank ?? null),
      tight: hideRank ? false : (vis.raceBadge ? !!st.tight : false),
      ...(sendWinners ? { winner: st.rank === 1 } : {}),
    };
  });

  return Response.json({
    candidates: out,
    mode: viewMode,
    publicMode: vis.mode,
    shuffled,
    rankHidden: hideRank,
    publicShuffle: vis.shuffle,
    winnersPublic: vis.winners,
    viewerIsAdmin: isAdmin,
    showScores: viewMode === 'full',
  });
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
