'use client';
import { useEffect, useState } from 'react';
import { Shell, Toast } from '../../components';

// Winners only: one row per category with whoever is currently ranked #1
// (ties show everyone on the top rank). No scores, no totals, no money.
export default function WinnersPage() {
  const [candidates, setCandidates] = useState(null);
  const [mode, setMode] = useState(null);
  const [rankHidden, setRankHidden] = useState(false);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => { setMode(d.mode); setRankHidden(!!d.rankHidden); setCandidates(d.candidates || []); }).catch(() => setCandidates([]));
  }, []);

  const sections = {};
  (candidates || []).forEach(c => {
    const s = c.section_label || 'Other';
    const a = c.award_name || 'Other';
    sections[s] = sections[s] || {};
    sections[s][a] = sections[s][a] || [];
    sections[s][a].push(c);
  });

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 720 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Winners</span>
              <h2>Category winners</h2>
              <div className="sub">
                Who is leading in each category. <a href="/vote/results" style={{ color: 'inherit', textDecoration: 'underline' }}>Full results by category →</a>
              </div>
            </div>
          </div>

          {candidates === null ? (
            <p style={{ color: 'var(--ink-soft)' }}>Loading…</p>
          ) : rankHidden ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              🔒 Winners will be announced at the Oguaa Royal Awards Night.
            </div>
          ) : candidates.length === 0 ? (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>No candidates on the ballot yet.</div>
          ) : Object.keys(sections).map(section => (
            <div key={section} style={{ marginBottom: 24 }}>
              <h3 style={{ marginBottom: 10 }}>{section}</h3>
              <div className="panel panel-pad">
                {Object.keys(sections[section]).map((award, i, arr) => {
                  const winners = sections[section][award].filter(c => c.rank === 1);
                  return (
                    <div key={award} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--parchment-2)' : 'none' }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-soft)', flex: '1 1 40%' }}>{award}</div>
                      <div style={{ flex: '1 1 60%', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                        {winners.length === 0 ? <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>No votes yet</span> : winners.map(w => (
                          <div key={w.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 10 }}>
                            {w.photo_url && <img src={w.photo_url} alt="" width={24} height={24} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center' }} />}
                            🏆 {w.nominee_name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
