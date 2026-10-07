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
  // SELECT * so this keeps working whichever schema migrations have been run.
  const cfg = (await sql`SELECT * FROM config WHERE id = 'main'`)[0] || {};
  const mode = modeFromConfig(cfg);
  return {
    mode,
    // Shuffle only means something while the public sees ranking only. With
    // percentages or votes on show, a shuffled list would contradict the numbers.
    shuffle: mode === 'closed' && cfg.results_shuffle === true,
    // The shuffled order is FIXED until the admin presses "Reshuffle", which
    // just picks a new seed. (No seed column yet -> 1, still stable.)
    shuffleSeed: Number(cfg.shuffle_seed) || 1,
    raceBadge: cfg.show_race_badge !== false,
    countdown: cfg.show_countdown !== false,
    // Winners (the Winners page and the trophy) are only public once the admin
    // reveals them — and stay hidden if schema-v11 has not been run yet.
    winners: cfg.winners_public === true,
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

// Small, fast, deterministic string hash (FNV-1a with a final mix) — used to give
// every nominee a fixed "dice roll" for a given seed.
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

// The public's "not a ranking" order. Only nominees who are actually competing
// (votes > 0) are shuffled; nominees with no votes yet sit together at the bottom
// of their category in a fixed, non-alphabetical order (by ballot code), so they
// never get mixed in with the competitors.
//
// The shuffle is STABLE: the same seed always gives the same order, however many
// people load the page, until the admin presses "Reshuffle" (new seed). A nominee
// who gets a first vote joins the shuffled group straight away, at the place
// their own roll gives them. `rows` must already be grouped by category.
export function shuffleWithinCategories(rows, seed = 1) {
  const out = [];
  const key = r => `${r.section_label || ''}|${r.award_name || ''}`;
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && key(rows[j]) === key(rows[i])) j++;
    const grp = rows.slice(i, j);
    const k = key(rows[i]);
    const competing = grp.filter(c => Number(c.votes) > 0)
      .map(c => ({ c, h: hash32(`${seed}|${k}|${c.id}`) }))
      .sort((a, b) => a.h - b.h || String(a.c.id).localeCompare(String(b.c.id)))
      .map(x => x.c);
    const idle = grp.filter(c => !(Number(c.votes) > 0))
      .sort((a, b) => String(a.ballot_code || a.id).localeCompare(String(b.ballot_code || b.id)));
    out.push(...competing, ...idle);
    i = j;
  }
  return out;
}
