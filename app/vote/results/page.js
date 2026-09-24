'use client';
import { useEffect, useState } from 'react';
import { Shell, Toast } from '../../components';

export default function VoteResultsPage() {
  const [candidates, setCandidates] = useState(null);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => setCandidates(d.candidates || [])).catch(() => setCandidates([]));
    fetch('/api/public/summary').then(r => r.json()).then(setTotals).catch(() => {});
  }, []);

  const resultsHidden = (candidates || []).length > 0 && candidates.every(c => c.votes === null);
  const grouped = {};
  (candidates || []).forEach(c => { (grouped[c.section_label || 'Other'] = grouped[c.section_label || 'Other'] || []).push(c); });
  Object.values(grouped).forEach(list => list.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)));

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Live results</span>
              <h2>Voting leaderboard</h2>
              <div className="sub">Updated the moment a vote is confirmed.</div>
            </div>
          </div>

          {totals && (
            <div className="banner banner-gold" style={{ marginBottom: 20 }}>
              🗳️ {totals.votesTotal || 0} votes cast · GH₵{(totals.voteRevenueGHS || 0).toFixed(2)} raised for the free Anniversary Merit Awards
            </div>
          )}

          {resultsHidden && (
            <div className="banner" style={{ marginBottom: 20 }}>
              🤫 The committee has kept individual vote counts private for now — keep voting, and check back later!
            </div>
          )}

          {candidates === null ? (
            <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>
          ) : candidates.length === 0 ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>No candidates on the ballot yet.</div>
          ) : resultsHidden ? null : Object.keys(grouped).map(section => (
            <div key={section} className="panel panel-pad" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>{section}</h3>
              {grouped[section].map((c, i) => {
                const max = grouped[section][0].votes || 1;
                const pct = Math.max(4, Math.round((c.votes / max) * 100));
                return (
                  <div key={c.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{i === 0 && c.votes > 0 ? '🏆 ' : ''}{c.nominee_name} <span style={{ color: 'var(--ink-soft)', fontSize: 11.5 }}>· {c.award_name}</span></span>
                      <strong>{c.votes}</strong>
                    </div>
                    <div style={{ height: 8, borderRadius: 6, background: 'var(--panel-2)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--gold, #c9a227)', borderRadius: 6 }} />
                    </div>
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
