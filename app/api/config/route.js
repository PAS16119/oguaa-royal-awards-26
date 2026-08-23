import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql`SELECT * FROM config WHERE id = 'main'`;
  return Response.json({ config: rows[0] || null });
}

export async function POST(req) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  await sql`
    INSERT INTO config (id, event_name, price_ghs, open_date, close_date, momo_name, momo_number, momo_network)
    VALUES ('main', ${body.eventName || null}, ${body.priceGHS || 10}, ${body.openDate || null}, ${body.closeDate || null}, ${body.momoName || null}, ${body.momoNumber || null}, ${body.momoNetwork || null})
    ON CONFLICT (id) DO UPDATE SET
      event_name = EXCLUDED.event_name,
      price_ghs = EXCLUDED.price_ghs,
      open_date = EXCLUDED.open_date,
      close_date = EXCLUDED.close_date,
      momo_name = EXCLUDED.momo_name,
      momo_number = EXCLUDED.momo_number,
      momo_network = EXCLUDED.momo_network
  `;
  await logAudit({ type: 'main-admin' }, 'settings_updated', {});
  return Response.json({ ok: true });
}
