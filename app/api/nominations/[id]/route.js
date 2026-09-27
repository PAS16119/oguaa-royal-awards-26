import { sql } from '@/lib/db';
import { requireSection } from '@/lib/session';
import { actorFromSession } from '@/lib/audit';
import { logAudit } from '@/lib/audit';
import { getAward } from '@/lib/catalog';
import { del } from '@vercel/blob';

// Same normalisation as POST /api/nominations, so an edited phone number
// still matches the "one nomination per person per award" rule on the free track.
function normalisePhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+233')) p = '0' + p.slice(4);
  else if (p.startsWith('233') && p.length > 10) p = '0' + p.slice(3);
  return p;
}

// PATCH — admin/co-admin edit of an existing nomination: fix a nominee's
// details, or re-file it under the correct award category. Fields are
// applied only if present in the body, so callers can send a partial update.
export async function PATCH(req, { params }) {
  const session = await requireSection('nominations');
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id);
  const rows = await sql`SELECT * FROM nominations WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  const nom = rows[0];

  const body = await req.json();

  // Re-categorising: the new award must exist and stay on the same track —
  // moving a nomination between the paid and free tracks would orphan its
  // access code or free-track duplicate-check, so that's not offered here.
  let awardId = nom.award_id, sectionKey = nom.section_key, sectionLabel = nom.section_label, category = nom.category;
  if (body.awardId && body.awardId !== nom.award_id) {
    const award = await getAward(body.awardId);
    if (!award) return Response.json({ error: 'That award does not exist.' }, { status: 400 });
    if ((award.track || 'paid') !== (nom.track || 'paid')) {
      return Response.json({ error: 'Cannot move a nomination between the paid and free tracks.' }, { status: 400 });
    }
    awardId = award.id; sectionKey = award.section_key; sectionLabel = award.section_label; category = award.name;
  }

  const nomineeName = typeof body.nomineeName === 'string' && body.nomineeName.trim() ? body.nomineeName.trim() : nom.nominee_name;
  const nomineeClass = typeof body.nomineeClass === 'string' ? body.nomineeClass.trim() : nom.nominee_class;
  const nomineeHouse = typeof body.nomineeHouse === 'string' ? body.nomineeHouse.trim() : nom.nominee_house;
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : nom.reason;
  const nominatorName = typeof body.nominatorName === 'string' && body.nominatorName.trim() ? body.nominatorName.trim() : nom.nominator_name;
  const relation = typeof body.relation === 'string' ? body.relation : nom.relation;

  let nominatorPhone = nom.nominator_phone;
  if (typeof body.nominatorPhone === 'string' && body.nominatorPhone.trim()) {
    const phone = normalisePhone(body.nominatorPhone);
    if (phone.length < 9) return Response.json({ error: 'That phone number does not look right.' }, { status: 400 });
    nominatorPhone = phone;
  }

  await sql`
    UPDATE nominations SET
      award_id = ${awardId}, section_key = ${sectionKey}, section_label = ${sectionLabel}, category = ${category},
      nominee_name = ${nomineeName}, nominee_class = ${nomineeClass}, nominee_house = ${nomineeHouse},
      reason = ${reason}, nominator_name = ${nominatorName}, nominator_phone = ${nominatorPhone}, relation = ${relation}
    WHERE id = ${id}
  `;

  // Keep an already-promoted ballot candidate in sync, so fixing a nomination
  // after it's on the ballot doesn't leave the two records disagreeing.
  await sql`
    UPDATE candidates SET
      award_id = ${awardId}, section_key = ${sectionKey}, section_label = ${sectionLabel}, award_name = ${category},
      nominee_name = ${nomineeName}, nominee_class = ${nomineeClass}, nominee_house = ${nomineeHouse}
    WHERE nomination_id = ${id}
  `;

  await logAudit(actorFromSession(session), 'nomination_edited', { nominationId: id, nominee: nomineeName, category });

  const updated = await sql`SELECT * FROM nominations WHERE id = ${id}`;
  return Response.json({ ok: true, nomination: updated[0] });
}

export async function DELETE(req, { params }) {
  const session = await requireSection('nominations');
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const id = decodeURIComponent(params.id);
  const rows = await sql`SELECT * FROM nominations WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404 });
  const nom = rows[0];

  if (nom.photo_url) {
    try { await del(nom.photo_url); } catch (e) { /* ignore, not fatal */ }
  }

  await sql`DELETE FROM nominations WHERE id = ${id}`;
  await logAudit(actorFromSession(session), 'nomination_deleted', { nominationId: id, nominee: nom.nominee_name, category: nom.category });

  return Response.json({ ok: true });
}
