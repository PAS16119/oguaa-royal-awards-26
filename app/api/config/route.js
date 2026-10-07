import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { paystackConfigured } from '@/lib/paystack';
import { RESULT_MODES } from '@/lib/results';

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
                        online_sales_enabled, max_codes_per_purchase,
                        voting_enabled, vote_price_ghs, voting_open_date, voting_close_date, max_votes_per_purchase,
                        results_public, ussd_shortcode, poster_bg_url)
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
      ${parseInt(pick(b.maxCodesPerPurchase, cur.max_codes_per_purchase)) || 10},
      ${pick(b.votingEnabled, cur.voting_enabled)},
      ${Number(pick(b.votePriceGHS, cur.vote_price_ghs)) || 1},
      ${pick(b.votingOpenDate, cur.voting_open_date) || null},
      ${pick(b.votingCloseDate, cur.voting_close_date) || null},
      ${Math.min(5000, Math.max(1, parseInt(pick(b.maxVotesPerPurchase, cur.max_votes_per_purchase)) || 500))},
      ${pick(b.resultsPublic, cur.results_public) !== false},
      ${pick(b.ussdShortcode, cur.ussd_shortcode) || null},
      ${pick(b.posterBgUrl, cur.poster_bg_url) || null}
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
      max_codes_per_purchase = EXCLUDED.max_codes_per_purchase,
      voting_enabled = EXCLUDED.voting_enabled,
      vote_price_ghs = EXCLUDED.vote_price_ghs,
      voting_open_date = EXCLUDED.voting_open_date,
      voting_close_date = EXCLUDED.voting_close_date,
      max_votes_per_purchase = EXCLUDED.max_votes_per_purchase,
      results_public = EXCLUDED.results_public,
      ussd_shortcode = EXCLUDED.ussd_shortcode,
      poster_bg_url = EXCLUDED.poster_bg_url
  `;
  // Results control and public motivators live in schema-v9 columns. They are
  // saved separately, and only when sent, so the rest of Settings keeps working
  // even before that migration has been run.
  const touchesV9 = b.resultsMode !== undefined || b.showRaceBadge !== undefined || b.showCountdown !== undefined;
  if (touchesV9) {
    if (b.resultsMode !== undefined && !RESULT_MODES.includes(b.resultsMode)) {
      return Response.json({ error: 'Unknown results mode.' }, { status: 400 });
    }
    try {
      const mode = b.resultsMode ?? cur.results_mode ?? (cur.results_public === false ? 'closed' : 'full');
      await sql`
        UPDATE config SET
          results_mode    = ${mode},
          results_public  = ${mode !== 'closed' && mode !== 'hidden'},
          show_race_badge = ${b.showRaceBadge ?? cur.show_race_badge ?? true},
          show_countdown  = ${b.showCountdown ?? cur.show_countdown ?? true}
        WHERE id = 'main'
      `;
    } catch (e) {
      return Response.json({ error: 'Run lib/schema-v9.sql in the Neon SQL editor first, then try again.' }, { status: 500 });
    }
    await logAudit({ type: 'main-admin' }, 'results_visibility_updated', { mode: b.resultsMode, raceBadge: b.showRaceBadge, countdown: b.showCountdown });
  }
  // Exact close time + shuffle live in schema-v10 columns, saved separately and
  // only when sent, so everything else keeps working before that migration runs.
  if (b.votingCloseTime !== undefined || b.resultsShuffle !== undefined) {
    let t = b.votingCloseTime === undefined ? undefined : String(b.votingCloseTime || '').trim();
    if (t && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
      return Response.json({ error: 'Close time must look like 18:00 (24-hour).' }, { status: 400 });
    }
    try {
      await sql`
        UPDATE config SET
          voting_close_time = ${t === undefined ? (cur.voting_close_time ?? null) : (t || null)},
          results_shuffle   = ${b.resultsShuffle ?? cur.results_shuffle ?? false}
        WHERE id = 'main'
      `;
    } catch (e) {
      return Response.json({ error: 'Run lib/schema-v10.sql in the Neon SQL editor first, then try again.' }, { status: 500 });
    }
    await logAudit({ type: 'main-admin' }, 'results_shuffle_or_close_time_updated', { closeTime: t, shuffle: b.resultsShuffle });
  }
  // schema-v11: the "reveal winners" switch and the Reshuffle button. Reshuffle
  // just picks a new seed; the shuffled order stays exactly as it is until then.
  if (b.winnersPublic !== undefined || b.reshuffle === true) {
    try {
      if (b.winnersPublic !== undefined) {
        await sql`UPDATE config SET winners_public = ${b.winnersPublic === true} WHERE id = 'main'`;
      }
      if (b.reshuffle === true) {
        const seed = 1 + Math.floor(Math.random() * 2000000000);
        await sql`UPDATE config SET shuffle_seed = ${seed} WHERE id = 'main'`;
      }
    } catch (e) {
      return Response.json({ error: 'Run lib/schema-v11.sql in the Neon SQL editor first, then try again.' }, { status: 500 });
    }
    if (b.winnersPublic !== undefined) await logAudit({ type: 'main-admin' }, 'winners_visibility_updated', { revealed: b.winnersPublic === true });
    if (b.reshuffle === true) await logAudit({ type: 'main-admin' }, 'results_reshuffled', {});
  }
  await logAudit({ type: 'main-admin' }, 'settings_updated', {});
  return Response.json({ ok: true });
}
