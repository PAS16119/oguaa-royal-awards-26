'use client';
import { useEffect, useState } from 'react';
import { Shell, Toast, CandidateSearch } from '../../components';

// Per-category results. Total votes and money raised are NOT shown here to the
// public — only an admin who is logged in gets that banner (the API only sends
// the numbers to admins).
export default function VoteResultsPage() {
  const [candidates, setCandidates] = useState(null);
  const [showScores, setShowScores] = useState(true);
  const [adminTotals, setAdminTotals] = useState(null);
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => {
      setCandidates(d.candidates || []);
      setShowScores(d.showScores !== false);
    }).catch(() => setCandidates([]));
    fetch('/api/public/summary').then(r => r.json()).then(d => {
      if (typeof d.votesTotal === 'number') setAdminTotals(d);
    }).catch(() => {});
  }, []);

  const sections = {};
  (candidates || []).forEach(c => {
    const sectionKey = c.section_label || 'Other';
    const awardKey = c.award_name || 'Other';
    sections[sectionKey] = sections[sectionKey] || {};
    sections[sectionKey][awardKey] = sections[sectionKey][awardKey] || [];
    sections[sectionKey][awardKey].push(c);
  });
  // Order by the server-computed rank (works with or without scores); anyone
  // without a rank yet (no votes) goes last, alphabetically.
  Object.values(sections).forEach(awards => {
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
                {showScores ? 'Updated the moment a vote is confirmed.' : 'Showing the current ranking in each category.'}
                {' · '}<a href="/vote/winners" style={{ color: 'inherit', textDecoration: 'underline' }}>Winners only →</a>
              </div>
            </div>
          </div>

          {adminTotals && (
            <div className="banner banner-gold" style={{ marginBottom: 20 }}>
              🔒 Admin only: {adminTotals.votesTotal} votes cast · GH₵{(adminTotals.voteRevenueGHS || 0).toFixed(2)} raised
            </div>
          )}

          {candidates && candidates.length > 0 && (
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
          ) : candidates.length === 0 ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>No candidates on the ballot yet.</div>
          ) : Object.keys(visibleSections).map(section => (
            <div key={section} style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 10 }}>{section}</h3>
              {Object.keys(visibleSections[section]).map(award => {
                const list = visibleSections[section][award];
                const max = (showScores && list[0]?.votes) || 1;
                return (
                  <div key={award} className="panel panel-pad" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 10 }}>{award}</div>
                    {list.map(c => (
                      <div key={c.id} style={{ marginBottom: 12, padding: c.id === focusId ? '6px 8px' : 0, borderRadius: 8, background: c.id === focusId ? 'rgba(201,162,39,.16)' : 'transparent' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: showScores ? 4 : 0 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>{c.rank ? `#${c.rank}` : '–'}</span>
                            {c.photo_url && (
                              <img src={c.photo_url} alt="" width={22} height={22}
                                   style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', flex: 'none' }} />
                            )}
                            {c.rank === 1 ? '🏆 ' : ''}{c.nominee_name}
                          </span>
                          {showScores && <strong>{c.votes}</strong>}
                        </div>
                        {showScores && (
                          <div style={{ height: 8, borderRadius: 6, background: 'var(--panel-2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.max(4, Math.round((c.votes / max) * 100))}%`, background: 'var(--gold, #c9a227)', borderRadius: 6 }} />
                          </div>
                        )}
                      </div>
                    ))}
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
