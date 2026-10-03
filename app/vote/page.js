'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast, CandidateSearch } from '../components';
import { useNow, fmtRemaining } from '../countdown';

const VOTER_KEY = 'ora_voter';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function VotePage() {
  const router = useRouter();
  const nowMs = useNow();
  const [candidates, setCandidates] = useState(null);
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [showScores, setShowScores] = useState(true);

  const [pickedId, setPickedId] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [activeAward, setActiveAward] = useState(null);
  const [packageId, setPackageId] = useState('');
  const [customVotes, setCustomVotes] = useState(10);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => { setCandidates(d.candidates || []); setShowScores(d.showScores !== false); }).catch(() => setCandidates([]));
    fetch('/api/vote-packages').then(r => r.json()).then(d => setPackages(d.packages || [])).catch(() => {});
    fetch('/api/public/summary').then(r => r.json()).then(d => setConfig(d.config)).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(VOTER_KEY) || 'null');
      if (saved) { setName(saved.name || ''); setEmail(saved.email || ''); setPhone(saved.phone || ''); }
    } catch {}
  }, []);

  // Poster QR codes link here as /vote?code=204 — once candidates load, jump
  // straight to that candidate instead of making a scanner scroll the whole
  // list. Read window.location directly (client-only, inside an effect) so
  // this doesn't pull in useSearchParams and its Suspense-boundary requirement.
  useEffect(() => {
    if (!candidates) return;
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return;
    const match = candidates.find(c => c.ballot_code === code);
    if (match) { setPickedId(match.id); setActiveSection(match.section_label || 'Other'); setActiveAward(match.award_name || 'Other'); }
  }, [candidates]);

  // Group -> Category (award) -> nominees, matching how the ballot is
  // actually organised (e.g. "Senior Student" group contains the "Fine Girl
  // of the Year" category, which has its own nominees).
  const groups = {};
  (candidates || []).forEach(c => {
    const g = c.section_label || 'Other';
    const a = c.award_name || 'Other';
    groups[g] = groups[g] || {};
    (groups[g][a] = groups[g][a] || []).push(c);
  });
  Object.values(groups).forEach(cats => Object.values(cats).forEach(list => list.sort((a, b) => ((b.votes ?? 0) - (a.votes ?? 0)) || a.nominee_name.localeCompare(b.nominee_name))));

  const groupNomineeCount = g => Object.values(groups[g] || {}).reduce((n, list) => n + list.length, 0);
  const activeCats = activeSection ? groups[activeSection] : null;
  const activeNominees = activeSection && activeAward ? groups[activeSection]?.[activeAward] : null;

  const picked = (candidates || []).find(c => c.id === pickedId);
  const pkg = packages.find(p => p.id === packageId);
  const votePrice = Number(config?.vote_price_ghs ?? 1);
  const maxVotes = parseInt(config?.max_votes_per_purchase) || 500;
  const total = pkg ? Number(pkg.price_ghs) : (votePrice * Math.max(1, customVotes)).toFixed(2);

  let closedMsg = null;
  if (config) {
    const now = new Date();
    if (config.voting_enabled === false) closedMsg = 'Voting is not open right now.';
    else if (config.voting_open_date && now < new Date(String(config.voting_open_date).slice(0, 10))) {
      closedMsg = `Voting opens on ${fmtDate(config.voting_open_date)}.`;
    } else if (config.voting_close_date && now > new Date(String(config.voting_close_date).slice(0, 10) + 'T23:59:59')) {
      closedMsg = `Voting closed on ${fmtDate(config.voting_close_date)}. Thank you for your support!`;
    }
  }

  async function pay() {
    setErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Please enter a valid email — it\'s where your receipt goes.'); return; }

    try { localStorage.setItem(VOTER_KEY, JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() })); } catch {}

    setBusy(true);
    try {
      const res = await fetch('/api/votes/init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: pickedId,
          packageId: packageId || undefined,
          votes: packageId ? undefined : customVotes,
          name: name.trim(), email: email.trim(), phone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the payment.');
      window.location.href = data.authorization_url;
    } catch (e) {
      setErr(e.message); toast(e.message); setBusy(false);
    }
  }

  if (candidates === null) {
    return <Shell><section className="block"><div className="wrap"><p style={{ color: 'var(--ink-soft)' }}>Loading candidates…</p></div></section><Toast /></Shell>;
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Vote · supports the free Anniversary Merit Awards</span>
              <h2>Vote for your favourite</h2>
              <div className="sub">
                Every vote is a small donation — GH₵{votePrice.toFixed(2)} per vote, or grab a package below. Vote as many
                times as you like; there's no limit.
              </div>
            </div>
          </div>

          <div className="banner banner-gold" style={{ marginBottom: 20 }}>
            🗳️ <a href="/vote/results" style={{ color: 'inherit', textDecoration: 'underline' }}>See results by category →</a>
          </div>

          {!closedMsg && config?.voting_close_date && config.show_countdown !== false && (() => {
            const left = new Date(String(config.voting_close_date).slice(0, 10) + 'T23:59:59').getTime() - nowMs;
            const txt = fmtRemaining(left);
            if (!txt) return null;
            const final = left < 48 * 3600 * 1000;
            return (
              <div className="banner banner-gold" style={{ marginBottom: 20, fontWeight: final ? 700 : 500 }}>
                ⏳ Voting closes in <strong style={{ margin: '0 4px' }}>{txt}</strong>{final ? ' — final hours, make every vote count!' : ''}
              </div>
            );
          })()}

          {closedMsg && <div className="banner banner-bad" style={{ marginBottom: 20 }}>{closedMsg}</div>}

          {!closedMsg && candidates.length === 0 && (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              Voting hasn't opened yet — check back once the ballot is announced.
            </div>
          )}

          {!closedMsg && !picked && candidates.length > 0 && (
            <CandidateSearch
              candidates={candidates}
              placeholder="Search a nominee by name to vote…"
              onSelect={c => {
                setPickedId(c.id);
                setActiveSection(c.section_label || 'Other');
                setActiveAward(c.award_name || 'Other');
                setErr('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {!closedMsg && !picked && !activeSection && Object.keys(groups).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {Object.keys(groups).map(g => (
                <button
                  key={g}
                  className="panel panel-pad"
                  style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                  onClick={() => setActiveSection(g)}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{g}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                      {Object.keys(groups[g]).length} categor{Object.keys(groups[g]).length === 1 ? 'y' : 'ies'} · {groupNomineeCount(g)} nominee{groupNomineeCount(g) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: 'var(--gold, #c9a227)' }}>→</span>
                </button>
              ))}
            </div>
          )}

          {!closedMsg && !picked && activeSection && !activeAward && activeCats && (
            <div>
              <button className="small-btn" style={{ marginBottom: 16 }} onClick={() => setActiveSection(null)}>← All groups</button>
              <h3 style={{ margin: '0 0 12px' }}>{activeSection}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {Object.keys(activeCats).map(a => (
                  <button
                    key={a}
                    className="panel panel-pad"
                    style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                    onClick={() => setActiveAward(a)}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                        {activeCats[a].length} nominee{activeCats[a].length === 1 ? '' : 's'}
                        {activeCats[a].some(c => c.tight) && <span style={{ marginLeft: 8, color: '#b45309', fontWeight: 700 }}>🔥 Neck and neck</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: 'var(--gold, #c9a227)' }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!closedMsg && !picked && activeSection && activeAward && activeNominees && (
            <div>
              <button className="small-btn" style={{ marginBottom: 16 }} onClick={() => setActiveAward(null)}>← {activeSection}</button>
              <h3 style={{ margin: '0 0 12px' }}>{activeAward}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {activeNominees.map(c => (
                  <div key={c.id} className="panel panel-pad" style={{ textAlign: 'center' }}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt={c.nominee_name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px' }} />
                      : <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--panel-2)', margin: '0 auto 10px' }} />}
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nominee_name}</div>
                    <div className="badge badge-used" style={{ margin: '6px 0 10px' }}>{c.votes === null ? 'Vote now' : `${c.votes} vote${c.votes === 1 ? '' : 's'}`}</div>
                    {c.tight && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', margin: '-4px 0 8px' }}>🔥 Neck and neck</div>}
                    <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                      onClick={() => { setPickedId(c.id); setErr(''); }}>
                      Vote →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {picked && (
            <div className="panel panel-pad">
              <button className="small-btn" style={{ marginBottom: 14 }} onClick={() => setPickedId(null)}>← Back to {activeAward || 'candidates'}</button>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                {picked.photo_url
                  ? <img src={picked.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--panel-2)' }} />}
                <div>
                  <div style={{ fontWeight: 700 }}>{picked.nominee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{picked.award_name}{picked.votes !== null && ` · ${picked.votes} votes so far`}</div>
                </div>
              </div>

              {packages.length > 0 && (
                <>
                  <div className="divider-label">choose a package</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    {packages.map(p => (
                      <button key={p.id}
                        className={`panel panel-pad`}
                        style={{ textAlign: 'center', cursor: 'pointer', border: packageId === p.id ? '2px solid var(--gold, #c9a227)' : undefined }}
                        onClick={() => setPackageId(packageId === p.id ? '' : p.id)}>
                        {p.promo_label && <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', marginBottom: 2 }}>🔥 {p.promo_label}</div>}
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>{p.votes}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>votes</div>
                        <div style={{ fontSize: 13, marginTop: 6 }}>GH₵{Number(p.price_ghs).toFixed(2)}</div>
                        {p.available_until && fmtRemaining(new Date(p.available_until).getTime() - nowMs) && (
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>⏳ ends in {fmtRemaining(new Date(p.available_until).getTime() - nowMs)}</div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="divider-label">or</div>
                </>
              )}

              <div className={`field ${packageId ? 'disabled' : ''}`} style={{ opacity: packageId ? 0.5 : 1 }}>
                <label>Custom number of votes</label>
                <input type="number" min={1} max={maxVotes} value={customVotes}
                  disabled={!!packageId}
                  onChange={e => setCustomVotes(Math.max(1, Math.min(maxVotes, parseInt(e.target.value) || 1)))} />
                <div className="hint">GH₵{votePrice.toFixed(2)} per vote · up to {maxVotes} at once</div>
              </div>

              <div className="divider-label">your details</div>
              <div className="field">
                <label>Your name (optional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ama Mensah" />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  <div className="hint">Required — Paystack sends your receipt here.</div>
                </div>
                <div className="field">
                  <label>Phone (optional)</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0XX XXX XXXX" />
                </div>
              </div>

              <div className="banner banner-gold" style={{ marginBottom: 16 }}>
                Total: <strong style={{ marginLeft: 6 }}>GH₵{Number(total).toFixed(2)}</strong>
                {' '}for <strong style={{ marginLeft: 4 }}>{pkg ? pkg.votes : customVotes} votes</strong>
              </div>

              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={pay}>
                {busy ? 'Opening secure checkout…' : `Pay GH₵${Number(total).toFixed(2)} with Paystack →`}
              </button>
              {err && <div className="banner banner-bad" style={{ marginTop: 14 }}>{err}</div>}
            </div>
          )}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
