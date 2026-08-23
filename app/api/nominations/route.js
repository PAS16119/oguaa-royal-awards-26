import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { genId } from '@/lib/codegen';

// GET: main admin only — the full nomination list.
export async function GET() {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await sql`SELECT * FROM nominations ORDER BY submitted_at DESC`;
  return Response.json({ nominations: rows });
}

// POST: public — but only succeeds with a valid, unused access code.
// This is the one and only place a code gets marked 'used'.
export async function POST(req) {
  const body = await req.json();
  const {
    code, sectionKey, sectionLabel, category,
    nomineeName, nomineeClass, nomineeHouse, reason, photoUrl,
    nominatorName, nominatorPhone, relation,
  } = body;

  if (!code || !category || !nomineeName || !photoUrl || !reason || !nominatorName || !nominatorPhone) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const upperCode = String(code).toUpperCase();
  const rows = await sql`SELECT * FROM codes WHERE code = ${upperCode}`;
  if (rows.length === 0) return Response.json({ error: 'Invalid access code.' }, { status: 400 });
  const rec = rows[0];
  if (rec.status !== 'unused') {
    return Response.json({ error: 'This code has already been used or was voided.' }, { status: 400 });
  }

  const id = genId();
  await sql`
    INSERT INTO nominations
      (id, code, section_key, section_label, category, nominee_name, nominee_class, nominee_house, reason, photo_url, nominator_name, nominator_phone, relation, submitted_at)
    VALUES
      (${id}, ${upperCode}, ${sectionKey}, ${sectionLabel}, ${category}, ${nomineeName}, ${nomineeClass || ''}, ${nomineeHouse || ''}, ${reason}, ${photoUrl}, ${nominatorName}, ${nominatorPhone}, ${relation || ''}, now())
  `;
  await sql`UPDATE codes SET status = 'used', used_at = now(), nomination_id = ${id} WHERE code = ${upperCode}`;

  const actor = rec.issued_by_type === 'agent'
    ? { type: 'agent', id: rec.issued_by_id, name: rec.issued_by_name }
    : { type: 'main-admin' };
  await logAudit(actor, 'code_used', { code: upperCode, nominee: nomineeName, category, nominationId: id });

  return Response.json({ ok: true, id });
}
