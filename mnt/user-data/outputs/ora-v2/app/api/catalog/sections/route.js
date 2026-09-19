import { sql } from '@/lib/db';
import { requireMainAdmin } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { slugifySectionKey } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

async function guard() {
  const session = await requireMainAdmin();
  if (!session) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

// POST — create a group. { track, label, emoji, color }
export async function POST(req) {
  const denied = await guard(); if (denied) return denied;
  const b = await req.json();
  const track = b.track === 'free' ? 'free' : 'paid';
  const label = (b.label || '').trim();
  if (!label) return Response.json({ error: 'A group name is required.' }, { status: 400 });

  const key = slugifySectionKey(label);
  const maxRows = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM award_sections WHERE track = ${track}`;
  await sql`
    INSERT INTO award_sections (key, track, label, emoji, color, sort_order, active)
    VALUES (${key}, ${track}, ${label}, ${b.emoji || '🏆'}, ${b.color || '#5B2E91'}, ${maxRows[0].n}, true)
  `;
  await logAudit({ type: 'main-admin' }, 'award_group_created', { key, label, track });
  return Response.json({ ok: true, key });
}

// PATCH — edit a group. { key, label?, emoji?, color?, active?, move? ('up'|'down') }
export async function PATCH(req) {
  const denied = await guard(); if (denied) return denied;
  const b = await req.json();
  const rows = await sql`SELECT * FROM award_sections WHERE key = ${b.key}`;
  if (rows.length === 0) return Response.json({ error: 'Group not found.' }, { status: 404 });
  const cur = rows[0];

  if (b.move === 'up' || b.move === 'down') {
    const dir = b.move === 'up' ? -1 : 1;
    const neighbours = await sql`
      SELECT * FROM award_sections WHERE track = ${cur.track} ORDER BY sort_order, label
    `;
    const i = neighbours.findIndex(s => s.key === cur.key);
    const j = i + dir;
    if (j >= 0 && j < neighbours.length) {
      const other = neighbours[j];
      await sql`UPDATE award_sections SET sort_order = ${other.sort_order} WHERE key = ${cur.key}`;
      await sql`UPDATE award_sections SET sort_order = ${cur.sort_order} WHERE key = ${other.key}`;
    }
    return Response.json({ ok: true });
  }

  await sql`
    UPDATE award_sections SET
      label  = ${b.label ?? cur.label},
      emoji  = ${b.emoji ?? cur.emoji},
      color  = ${b.color ?? cur.color},
      active = ${typeof b.active === 'boolean' ? b.active : cur.active}
    WHERE key = ${b.key}
  `;
  await logAudit({ type: 'main-admin' }, 'award_group_updated', { key: b.key });
  return Response.json({ ok: true });
}

// DELETE — remove a group and its awards. Blocked if any nomination references it.
export async function DELETE(req) {
  const denied = await guard(); if (denied) return denied;
  const { key } = await req.json();
  const used = await sql`SELECT COUNT(*)::int AS n FROM nominations WHERE section_key = ${key}`;
  if (used[0].n > 0) {
    return Response.json({
      error: `This group already has ${used[0].n} nomination(s). Deactivate it instead of deleting, so the records stay intact.`,
    }, { status: 400 });
  }
  await sql`DELETE FROM award_sections WHERE key = ${key}`;
  await logAudit({ type: 'main-admin' }, 'award_group_deleted', { key });
  return Response.json({ ok: true });
}
