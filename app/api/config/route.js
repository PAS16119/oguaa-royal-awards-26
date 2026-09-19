import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { paystackConfigured } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await sql`SELECT * FROM config WHERE id = 'main'`;
  return Response.json({
    config: rows[0] || null,
    paystackConfigured: paystackConfigured(),
  });
}

export async function POST(req) {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const b = await req.json();
  const cur = (await sql`SELECT * FROM config WHERE id = 'main'`)[0] || {};
  const pick = (v, fallback) => (v === undefined ? fallback : v);

  await sql`
    INSERT INTO config (id, event_name, price_ghs, open_date, close_date, momo_name, momo_number, momo_network,
                        free_enabled, free_open_date, free_close_date, free_max_per_phone, free_photo_required,
                        online_sales_enabled, max_codes_per_purchase)
    VALUES ('main',
      ${pick(b.eventName, cur.event_name)},
      ${pick(b.priceGHS, cur.price_ghs) || 10},
      ${pick(b.openDate, cur.open_date) || null},
      ${pick(b.closeDate, cur.close_date) || null},
      ${pick(b.momoName, cur.momo_name)},
      ${pick(b.momoNumber, cur.momo_number)},
      ${pick(b.momoNetwork, cur.momo_network)},
      ${pick(b.freeEnabled, cur.free_enabled)},
      ${pick(b.freeOpenDate, cur.free_open_date) || null},
      ${pick(b.freeCloseDate, cur.free_close_date) || null},
      ${parseInt(pick(b.freeMaxPerPhone, cur.free_max_per_phone)) || 6},
      ${pick(b.freePhotoRequired, cur.free_photo_required)},
      ${pick(b.onlineSalesEnabled, cur.online_sales_enabled)},
      ${parseInt(pick(b.maxCodesPerPurchase, cur.max_codes_per_purchase)) || 10}
    )
    ON CONFLICT (id) DO UPDATE SET
      event_name = EXCLUDED.event_name,
      price_ghs = EXCLUDED.price_ghs,
      open_date = EXCLUDED.open_date,
      close_date = EXCLUDED.close_date,
      momo_name = EXCLUDED.momo_name,
      momo_number = EXCLUDED.momo_number,
      momo_network = EXCLUDED.momo_network,
      free_enabled = EXCLUDED.free_enabled,
      free_open_date = EXCLUDED.free_open_date,
      free_close_date = EXCLUDED.free_close_date,
      free_max_per_phone = EXCLUDED.free_max_per_phone,
      free_photo_required = EXCLUDED.free_photo_required,
      online_sales_enabled = EXCLUDED.online_sales_enabled,
      max_codes_per_purchase = EXCLUDED.max_codes_per_purchase
  `;
  await logAudit({ type: 'main-admin' }, 'settings_updated', {});
  return Response.json({ ok: true });
}
