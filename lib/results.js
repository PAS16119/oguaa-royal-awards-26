import { sql } from './db';

// hidden  = public sees no ranking, no winners, no badges at all
// closed  = public sees ranking only
export const RESULT_MODES = ['hidden', 'closed', 'percent', 'full'];

// Works on any config row. Falls back to the old results_public flag so the
// site keeps behaving sensibly if schema-v9 has not been run yet.
export function modeFromConfig(cfg) {
  if (cfg && RESULT_MODES.includes(cfg.results_mode)) return cfg.results_mode;
  return cfg && cfg.results_public === false ? 'closed' : 'full';
}

export async function getVisibility() {
  let cfg = {};
  try {
    cfg = (await sql`SELECT results_public, results_mode, show_race_badge, show_countdown, results_shuffle FROM config WHERE id = 'main'`)[0] || {};
  } catch {
    try {
      // schema-v10 not applied yet
      cfg = (await sql`SELECT results_public, results_mode, show_race_badge, show_countdown FROM config WHERE id = 'main'`)[0] || {};
    } catch {
      // schema-v9 not applied yet
      cfg = (await sql`SELECT results_public FROM config WHERE id = 'main'`)[0] || {};
    }
  }
  const mode = modeFromConfig(cfg);
  return {
    mode,
    // Shuffle only means something while the public sees ranking only. With
    // percentages or votes on show, a shuffled list would contradict the numbers.
    shuffle: mode === 'closed' && cfg.results_shuffle === true,
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

// In-place Fisher-Yates, run on each category's nominees so no order can hint at
// who is ahead. Fresh random order on every request.
export function shuffleWithinCategories(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    let j = i;
    const key = r => `${r.section_label || ''}|${r.award_name || ''}`;
    while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    const grp = rows.slice(i, j);
    for (let k = grp.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [grp[k], grp[r]] = [grp[r], grp[k]];
    }
    out.push(...grp);
    i = j;
  }
  return out;
}
