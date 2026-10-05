// One place that turns the voting close DATE (+ optional TIME) into an exact
// moment. Ghana is on GMT all year (no daylight saving), so the time the admin
// types is read as UTC, and it is the same on the server, in USSD and in every
// visitor's browser, wherever they are.
// No time set -> the vote stays open until the end of the close date (old behaviour).
export function votingCloseAt(cfg) {
  if (!cfg || !cfg.voting_close_date) return null;
  const d = String(cfg.voting_close_date).slice(0, 10);
  const t = String(cfg.voting_close_time || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  const iso = m ? `${d}T${m[1].padStart(2, '0')}:${m[2]}:00Z` : `${d}T23:59:59Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms);
}

// "6:00 PM", or '' when no time is set.
export function fmtCloseTime(cfg) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(cfg?.voting_close_time || '').trim());
  if (!m) return '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}
