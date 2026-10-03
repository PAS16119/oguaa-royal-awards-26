import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { genId } from '@/lib/codegen';

export const dynamic = 'force-dynamic';

// GET — public: active packages, for the /vote page. ?all=1 — main admin: every package.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('all') === '1') {
    const session = await requireMainAdmin();
    if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const rows = await sql`SELECT * FROM vote_packages ORDER BY sort_order, price_ghs`;
    return Response.json({ packages: rows });
  }
  // Scheduled ("last hours") packages only appear inside their window.
  let rows;
  try {
    rows = await sql`
      SELECT * FROM vote_packages
      WHERE active = true
        AND (available_from IS NULL OR available_from <= now())
        AND (available_until IS NULL OR available_until > now())
      ORDER BY sort_order, price_ghs`;
  } catch {
    // schema-v9 not applied yet
    rows = await sql`SELECT * FROM vote_packages WHERE active = true ORDER BY sort_order, price_ghs`;
  }
  return Response.json({ packages: rows });
}

// POST — create a package. Main Admin only: pricing is a financial control,
// same boundary as event Settings.
export async function POST(req) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json();
  const label = (b.label || '').trim();
  const votes = parseInt(b.votes);
  const price = Number(b.priceGHS);
  if (!label || !votes || votes < 1 || !price || price <= 0) {
    return Response.json({ error: 'Give the package a name, a vote count, and a price.' }, { status: 400 });
  }

  const id = genId();
  const maxRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM vote_packages`;
  await sql`
    INSERT INTO vote_packages (id, label, votes, price_ghs, sort_order, active)
    VALUES (${id}, ${label}, ${votes}, ${price}, ${maxRows[0].n}, true)
  `;
  if (b.promoLabel || b.availableFrom || b.availableUntil) {
    try {
      await sql`
        UPDATE vote_packages SET
          promo_label = ${(b.promoLabel || '').trim() || null},
          available_from = ${b.availableFrom || null},
          available_until = ${b.availableUntil || null}
        WHERE id = ${id}`;
    } catch {
      return Response.json({ error: 'Package added, but the schedule was not saved. Run lib/schema-v9.sql in Neon, then use Schedule on the package.' }, { status: 500 });
    }
  }
  await logAudit({ type: 'main-admin' }, 'vote_package_created', { id, label, votes, price });
  return Response.json({ ok: true, id });
}
