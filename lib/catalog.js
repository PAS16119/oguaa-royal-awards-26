import { sql } from './db';

// Shape returned to the browser:
// [{ key, track, label, emoji, color, sort_order, active,
//    awards: [{ id, name, notes, nominable, sort_order, active }] }]
export async function getCatalog({ track = null, includeInactive = false } = {}) {
  const sections = track
    ? await sql`SELECT * FROM award_sections WHERE track = ${track} ORDER BY sort_order, label`
    : await sql`SELECT * FROM award_sections ORDER BY track DESC, sort_order, label`;

  const awards = await sql`SELECT * FROM awards ORDER BY sort_order, name`;

  return sections
    .filter(s => includeInactive || s.active)
    .map(s => ({
      ...s,
      awards: awards
        .filter(a => a.section_key === s.key && (includeInactive || a.active)),
    }));
}

// Single award + its section, used when validating a submitted nomination.
export async function getAward(id) {
  const rows = await sql`
    SELECT a.*, s.track, s.label AS section_label, s.key AS section_key_2
    FROM awards a JOIN award_sections s ON s.key = a.section_key
    WHERE a.id = ${id}
  `;
  return rows[0] || null;
}

export function slugifyAwardId(sectionKey, name) {
  const base = String(name).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 54);
  return `${sectionKey}__${base || 'award'}-${Math.random().toString(36).slice(2, 6)}`;
}

export function slugifySectionKey(label) {
  const base = String(label).toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${base || 'section'}-${Math.random().toString(36).slice(2, 5)}`;
}
