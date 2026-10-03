import { sql } from './db';

export const RESULT_MODES = ['closed', 'percent', 'full'];

// Works on any config row. Falls back to the old results_public flag so the
// site keeps behaving sensibly if schema-v9 has not been run yet.
export function modeFromConfig(cfg) {
  if (cfg && RESULT_MODES.includes(cfg.results_mode)) return cfg.results_mode;
  return cfg && cfg.results_public === false ? 'closed' : 'full';
}

export async function getVisibility() {
  let cfg = {};
  try {
    cfg = (await sql`SELECT results_public, results_mode, show_race_badge, show_countdown FROM config WHERE id = 'main'`)[0] || {};
  } catch {
    // schema-v9 not applied yet
    cfg = (await sql`SELECT results_public FROM config WHERE id = 'main'`)[0] || {};
  }
  return {
    mode: modeFromConfig(cfg),
    raceBadge: cfg.show_race_badge !== false,
    countdown: cfg.show_countdown !== false,
  };
}

// Per-category maths done on the server so the browser never needs the raw
// scores just to draw a ranking. `rows` need id, section_label, award_name, votes.
// Returns Map(id -> { rank, percent, tight }).
//  - rank:    competition rank within the category (ties share), null if 0 votes
//  - percent: whole-number share of the category's votes
//  - tight:   top two within 10% of each other (or tied for first) — a
//             "neck and neck" flag that reveals no numbers
export function categoryStats(rows) {
  const groups = {};
  rows.forEach(c => { (groups[`${c.section_label || ''}|${c.award_name || ''}`] ||= []).push(c); });
  const out = new Map();
  Object.values(groups).forEach(list => {
    const total = list.reduce((n, c) => n + Number(c.votes), 0);
    const sorted = [...list].sort((a, b) => Number(b.votes) - Number(a.votes));
    const distinct = [...new Set(sorted.map(c => Number(c.votes)))];
    const v1 = distinct[0] || 0;
    const v2 = distinct[1] || 0;
    const leaders = sorted.filter(c => Number(c.votes) === v1).length;
    let tightValues = [];
    if (v1 > 0) {
      if (leaders >= 2) tightValues = [v1];
      else if (v2 > 0 && (v1 - v2) / v1 <= 0.10) tightValues = [v1, v2];
    }
    let r = 0, prev = null;
    sorted.forEach((c, i) => {
      const v = Number(c.votes);
      if (v !== prev) { r = i + 1; prev = v; }
      out.set(c.id, {
        rank: v > 0 ? r : null,
        percent: total > 0 ? Math.round((v / total) * 100) : 0,
        tight: tightValues.includes(v),
      });
    });
  });
  return out;
}
