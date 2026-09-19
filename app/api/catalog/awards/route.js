import { sql } from '@/lib/db';
import { requireAdminLevel } from '@/lib/session';
import { logAudit, actorFromSession } from '@/lib/audit';
import { slugifyAwardId } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

async function guard() {
  const session = await requireAdminLevel();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return session;
}

// POST — add an award. { sectionKey, name, notes?, nominable? }
// Also accepts { sectionKey, bulk: "one award per line" } to paste a whole list.
export async function POST(req) {
  const g = await guard(); if (g instanceof Response) return g; const session = g;
  const b = await req.json();

  const secRows = await sql`SELECT * FROM award_sections WHERE key = ${b.sectionKey}`;
  if (secRows.length === 0) return Response.json({ error: 'Unknown group.' }, { status: 400 });

  const names = b.bulk
    ? String(b.bulk).split('\n').map(s => s.trim()).filter(Boolean)
    : [(b.name || '').trim()].filter(Boolean);
  if (names.length === 0) return Response.json({ error: 'Nothing to add.' }, { status: 400 });

  const startRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM awards WHERE section_key = ${b.sectionKey}`;
  let order = startRows[0].n;
  const created = [];

  for (const name of names) {
    const id = slugifyAwardId(b.sectionKey, name);
    await sql`
      INSERT INTO awards (id, section_key, name, notes, nominable, sort_order, active)
      VALUES (${id}, ${b.sectionKey}, ${name}, ${b.notes || null}, ${b.nominable !== false}, ${order++}, true)
    `;
    created.push({ id, name });
  }
  await logAudit(actorFromSession(session), 'award_created', { sectionKey: b.sectionKey, count: created.length, names });
  return Response.json({ ok: true, created });
}

// PATCH — edit one award. { id, name?, notes?, nominable?, active?, move? }
export async function PATCH(req) {
  const g = await guard(); if (g instanceof Response) return g; const session = g;
  const b = await req.json();
  const rows = await sql`SELECT * FROM awards WHERE id = ${b.id}`;
  if (rows.length === 0) return Response.json({ error: 'Award not found.' }, { status: 404 });
  const cur = rows[0];

  if (b.move === 'up' || b.move === 'down') {
    const dir = b.move === 'up' ? -1 : 1;
    const siblings = await sql`SELECT * FROM awards WHERE section_key = ${cur.section_key} ORDER BY sort_order, name`;
    const i = siblings.findIndex(a => a.id === cur.id);
    const j = i + dir;
    if (j >= 0 && j < siblings.length) {
      const other = siblings[j];
      await sql`UPDATE awards SET sort_order = ${other.sort_order} WHERE id = ${cur.id}`;
      await sql`UPDATE awards SET sort_order = ${cur.sort_order} WHERE id = ${other.id}`;
    }
    return Response.json({ ok: true });
  }

  await sql`
    UPDATE awards SET
      name      = ${b.name ?? cur.name},
      notes     = ${b.notes ?? cur.notes},
      nominable = ${typeof b.nominable === 'boolean' ? b.nominable : cur.nominable},
      active    = ${typeof b.active === 'boolean' ? b.active : cur.active},
      section_key = ${b.sectionKey ?? cur.section_key}
    WHERE id = ${b.id}
  `;
  await logAudit(actorFromSession(session), 'award_updated', { id: b.id });
  return Response.json({ ok: true });
}

// DELETE — remove an award. Blocked once nominations exist for it.
export async function DELETE(req) {
  const g = await guard(); if (g instanceof Response) return g; const session = g;
  const { id } = await req.json();
  const rows = await sql`SELECT * FROM awards WHERE id = ${id}`;
  if (rows.length === 0) return Response.json({ error: 'Award not found.' }, { status: 404 });

  const used = await sql`SELECT COUNT(*)::int AS n FROM nominations WHERE award_id = ${id} OR category = ${rows[0].name}`;
  if (used[0].n > 0) {
    return Response.json({
      error: `${used[0].n} nomination(s) already point at this award. Switch it off ("Hide") instead of deleting, so nothing is lost.`,
    }, { status: 400 });
  }
  await sql`DELETE FROM awards WHERE id = ${id}`;
  await logAudit(actorFromSession(session), 'award_deleted', { id, name: rows[0].name });
  return Response.json({ ok: true });
}
