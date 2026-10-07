'use client';
import { useEffect, useState } from 'react';
import { Shell, Toast, CandidateSearch } from '../../components';

const MODE_NOTE = {
  hidden: 'Results are being kept private until the winners are announced.',
  closed: 'Showing the current ranking in each category.',
  shuffled: 'Not a ranking. Nominees who have received votes are shown in a shuffled order — nominees still waiting for their first vote are listed last. Every vote can move you into the race!',
  percent: 'Each nominee’s share of the votes in their category. Updated live.',
  full: 'Votes per nominee in each category. Updated the moment a vote is confirmed.',
};
const MODE_LABEL = { hidden: 'Hidden — nothing shown', closed: 'Closed — ranking only', percent: 'Percentages', full: 'Full votes' };

// Per-category results. Total votes and money raised are NOT shown here to the
// public — only a logged-in admin gets that banner (the API only sends the
// numbers to admins). What the public sees per nominee depends on the mode the
// Main Admin chose: closed (ranking only) | percent | full.
export default function VoteResultsPage() {
  const [data, setData] = useState(null);
  const [adminTotals, setAdminTotals] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);   // true once we know this browser is logged in as admin
  const [preview, setPreview] = useState(false);   // admin previewing exactly what voters see

  useEffect(() => {
    const q = preview ? '?as=public' : '';
    fetch('/api/candidates' + q).then(r => r.json()).then(d => {
      setData(d);
      if (d.viewerIsAdmin) setIsAdmin(true);
    }).catch(() => setData({ candidates: [], mode: 'closed' }));
    fetch('/api/public/summary' + q).then(r => r.json()).then(d => {
      setAdminTotals(typeof d.votesTotal === 'number' ? d : null);
    }).catch(() => {});
  }, [preview]);

  const candidates = data ? data.candidates || [] : null;
  const mode = data?.mode || 'closed';
  const shuffled = !!data?.shuffled;
  const winnersVisible = !!(data?.winnersPublic || data?.viewerIsAdmin);

  const sections = {};
  (candidates || []).forEach(c => {
    const sectionKey = c.section_label || 'Other';
    const awardKey = c.award_name || 'Other';
    sections[sectionKey] = sections[sectionKey] || {};
    sections[sectionKey][awardKey] = sections[sectionKey][awardKey] || [];
    sections[sectionKey][awardKey].push(c);
  });
  // Order by the server-computed rank (works in every mode); anyone without a
  // rank yet (no votes) goes last, alphabetically.
  // When shuffled, keep the server's fixed shuffled order: no sorting by anything.
  if (!shuffled) Object.values(sections).forEach(awards => {
    Object.values(awards).forEach(list => list.sort((a, b) =>
      (a.rank ?? 9999) - (b.rank ?? 9999) || a.nominee_name.localeCompare(b.nominee_name)));
  });

  const focused = (candidates || []).find(c => c.id === focusId) || null;
  const visibleSections = focused
    ? { [focused.section_label || 'Other']: { [focused.award_name || 'Other']: sections[focused.section_label || 'Other']?.[focused.award_name || 'Other'] || [] } }
    : sections;

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Results</span>
              <h2>Voting results by category</h2>
              <div className="sub">
                {shuffled ? MODE_NOTE.shuffled : MODE_NOTE[mode]}
                {winnersVisible && <>{' · '}<a href="/vote/winners" style={{ color: 'inherit', textDecoration: 'underline' }}>Winners only →</a></>}
              </div>
            </div>
          </div>

          {isAdmin && !preview && (
            <div className="banner banner-gold" style={{ marginBottom: 20, display: 'block', border: '2px dashed #b45309' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>👁 ADMIN VIEW — only you can see this box</div>
              <div style={{ fontSize: 13 }}>
                You're logged in as admin in this browser. Voters never see this box or the numbers in it.
                {adminTotals && <> Total: <strong>{adminTotals.votesTotal}</strong> votes · <strong>GH₵{(adminTotals.voteRevenueGHS || 0).toFixed(2)}</strong> raised.</>}
                {' '}Voters currently see: <strong>{MODE_LABEL[data?.publicMode] || data?.publicMode}{data?.publicShuffle ? ' (shuffled order)' : ''}</strong>.
              </div>
              <button className="btn btn-gold" style={{ marginTop: 10, fontSize: 13 }} onClick={() => setPreview(true)}>See it exactly as a voter does</button>
            </div>
          )}
          {isAdmin && preview && (
            <div className="banner banner-good" style={{ marginBottom: 20, display: 'block' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>👥 Previewing what voters see</div>
              <div style={{ fontSize: 13 }}>No totals, no money, and only what the current mode allows.</div>
              <button className="btn btn-gold" style={{ marginTop: 10, fontSize: 13 }} onClick={() => setPreview(false)}>Back to admin view</button>
            </div>
          )}

          {mode !== 'hidden' && !shuffled && candidates && candidates.length > 0 && (
            <CandidateSearch
              candidates={candidates}
              placeholder="Find a nominee to see where they stand…"
              onSelect={c => setFocusId(c.id)}
            />
          )}

          {focused && (
            <div style={{ marginBottom: 16 }}>
              <button className="small-btn" onClick={() => setFocusId(null)}>← Show all categories</button>
            </div>
          )}

          {candidates === null ? (
            <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>
          ) : mode === 'hidden' ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              🔒 Results are hidden while voting is on. Winners will be announced at the Oguaa Royal Awards Night.
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>No candidates on the ballot yet.</div>
          ) : Object.keys(visibleSections).map(section => (
            <div key={section} style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 10 }}>{section}</h3>
              {Object.keys(visibleSections[section]).map(award => {
                const list = visibleSections[section][award];
                const maxVotes = (mode === 'full' && list[0]?.votes) || 1;
                const tight = list.some(c => c.tight);
                return (
                  <div key={award} className="panel panel-pad" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span>{award}</span>
                      {tight && <span style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>🔥 Neck and neck at the top</span>}
                    </div>
                    {list.map(c => {
                      const showBar = mode === 'full' || mode === 'percent';
                      const barPct = mode === 'full' ? Math.round(((c.votes || 0) / maxVotes) * 100) : (c.percent || 0);
                      return (
                        <div key={c.id} style={{ marginBottom: 12, padding: c.id === focusId ? '6px 8px' : 0, borderRadius: 8, background: c.id === focusId ? 'rgba(201,162,39,.16)' : 'transparent' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: showBar ? 4 : 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              {!shuffled && <span style={{ color: 'var(--ink-soft)', fontSize: 11.5, minWidth: 18 }}>{c.rank ? `#${c.rank}` : '–'}</span>}
                              {c.photo_url && (
                                <img src={c.photo_url} alt="" width={22} height={22}
                                     style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', flex: 'none' }} />
                              )}
                              {c.winner ? '🏆 ' : ''}{c.nominee_name}
                            </span>
                            {mode === 'full' && <strong>{c.votes}</strong>}
                            {mode === 'percent' && <strong>{c.percent}%</strong>}
                          </div>
                          {showBar && (
                            <div style={{ height: 8, borderRadius: 6, background: 'var(--panel-2)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.max(c.rank ? 4 : 0, barPct)}%`, background: 'var(--gold, #c9a227)', borderRadius: 6 }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
