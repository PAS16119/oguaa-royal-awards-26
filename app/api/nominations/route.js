import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { genId } from '@/lib/codegen';
import { getAward } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

// GET: main admin only — the full nomination list (both tracks).
export async function GET(req) {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const track = searchParams.get('track');
  const rows = (track === 'paid' || track === 'free')
    ? await sql`SELECT * FROM nominations WHERE track = ${track} ORDER BY submitted_at DESC`
    : await sql`SELECT * FROM nominations ORDER BY submitted_at DESC`;
  return Response.json({ nominations: rows });
}

// Ghana phone numbers get written a dozen ways. Store one shape, so the
// "one nomination per person per award" rule actually holds.
function normalisePhone(raw) {
  let p = String(raw || '').replace(/[^\d+]/g, '');
  if (p.startsWith('+233')) p = '0' + p.slice(4);
  else if (p.startsWith('233') && p.length > 10) p = '0' + p.slice(3);
  return p;
}

function windowState(cfg, openKey, closeKey) {
  const now = new Date();
  const open = cfg?.[openKey] ? new Date(cfg[openKey]) : null;
  const close = cfg?.[closeKey] ? new Date(String(cfg[closeKey]).slice(0, 10) + 'T23:59:59') : null;
  if (open && now < open) return 'not-yet';
  if (close && now > close) return 'closed';
  return 'open';
}

export async function POST(req) {
  const body = await req.json();
  const track = body.track === 'free' ? 'free' : 'paid';
  const cfgRows = await sql`SELECT * FROM config WHERE id = 'main'`;
  const cfg = cfgRows[0] || {};

  const {
    code, awardId, nomineeName, nomineeClass, nomineeHouse, reason, photoUrl,
    nominatorName, nominatorPhone, relation, nominatorRole,
  } = body;

  const phone = normalisePhone(nominatorPhone);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;

  if (!nomineeName || !reason || !nominatorName || !phone) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (phone.length < 9) {
    return Response.json({ error: 'That phone number does not look right.' }, { status: 400 });
  }

  // ---------------------------------------------------------------- award
  let sectionKey = body.sectionKey;
  let sectionLabel = body.sectionLabel;
  let category = body.category;

  if (awardId) {
    const award = await getAward(awardId);
    if (!award || !award.active) return Response.json({ error: 'That award is no longer open.' }, { status: 400 });
    if (award.track !== track) return Response.json({ error: 'Wrong nomination route for this award.' }, { status: 400 });
    if (!award.nominable) {
      return Response.json({ error: 'This award is decided from official records, not by nomination.' }, { status: 400 });
    }
    sectionKey = award.section_key;
    sectionLabel = award.section_label;
    category = award.name;
  }
  if (!category) return Response.json({ error: 'Please choose an award category.' }, { status: 400 });

  // ----------------------------------------------------------- FREE track
  if (track === 'free') {
    if (cfg.free_enabled === false) {
      return Response.json({ error: 'Free nominations are currently closed.' }, { status: 400 });
    }
    const state = windowState(cfg, 'free_open_date', 'free_close_date');
    if (state === 'not-yet') return Response.json({ error: 'Free nominations have not opened yet.' }, { status: 400 });
    if (state === 'closed') return Response.json({ error: 'Free nominations have closed.' }, { status: 400 });
    if (cfg.free_photo_required && !photoUrl) {
      return Response.json({ error: 'A photo of the nominee is required.' }, { status: 400 });
    }

    const cap = parseInt(cfg.free_max_per_phone) || 6;
    const mine = await sql`SELECT COUNT(*)::int AS n FROM nominations WHERE track = 'free' AND nominator_phone = ${phone}`;
    if (mine[0].n >= cap) {
      return Response.json({ error: `You have reached the limit of ${cap} free nominations from this number.` }, { status: 400 });
    }

    const dup = await sql`
      SELECT 1 FROM nominations WHERE track = 'free' AND nominator_phone = ${phone} AND award_id = ${awardId}
    `;
    if (dup.length > 0) {
      return Response.json({ error: 'You have already nominated someone for this award.' }, { status: 400 });
    }

    const id = genId();
    try {
      await sql`
        INSERT INTO nominations
          (id, code, track, award_id, section_key, section_label, category, nominee_name, nominee_class, nominee_house,
           reason, photo_url, nominator_name, nominator_phone, relation, nominator_role, nominator_ip, submitted_at)
        VALUES
          (${id}, NULL, 'free', ${awardId}, ${sectionKey}, ${sectionLabel}, ${category}, ${nomineeName}, ${nomineeClass || ''}, ${nomineeHouse || ''},
           ${reason}, ${photoUrl || null}, ${nominatorName}, ${phone}, ${relation || ''}, ${nominatorRole || ''}, ${ip}, now())
      `;
    } catch (e) {
      if (String(e.message || '').includes('uniq_free_phone_award')) {
        return Response.json({ error: 'You have already nominated someone for this award.' }, { status: 400 });
      }
      throw e;
    }
    await logAudit({ type: 'public', name: nominatorName }, 'free_nomination', { nominee: nomineeName, category, nominationId: id });
    return Response.json({ ok: true, id, remaining: Math.max(0, cap - mine[0].n - 1) });
  }

  // ----------------------------------------------------------- PAID track
  if (!code) return Response.json({ error: 'An access code is required.' }, { status: 400 });
  if (!photoUrl) return Response.json({ error: 'A photo of the nominee is required.' }, { status: 400 });

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
      (id, code, track, award_id, section_key, section_label, category, nominee_name, nominee_class, nominee_house,
       reason, photo_url, nominator_name, nominator_phone, relation, nominator_role, nominator_ip, submitted_at)
    VALUES
      (${id}, ${upperCode}, 'paid', ${awardId || null}, ${sectionKey}, ${sectionLabel}, ${category}, ${nomineeName}, ${nomineeClass || ''}, ${nomineeHouse || ''},
       ${reason}, ${photoUrl}, ${nominatorName}, ${phone}, ${relation || ''}, ${nominatorRole || ''}, ${ip}, now())
  `;
  await sql`UPDATE codes SET status = 'used', used_at = now(), nomination_id = ${id} WHERE code = ${upperCode}`;

  const actor = rec.issued_by_type === 'agent'
    ? { type: 'agent', id: rec.issued_by_id, name: rec.issued_by_name }
    : { type: rec.issued_by_type || 'main-admin' };
  await logAudit(actor, 'code_used', { code: upperCode, nominee: nomineeName, category, nominationId: id });

  return Response.json({ ok: true, id });
}
