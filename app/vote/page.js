'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../components';

const VOTER_KEY = 'ora_voter';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function VotePage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState(null);
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState(null);
  const [totals, setTotals] = useState(null);

  const [pickedId, setPickedId] = useState(null);
  const [packageId, setPackageId] = useState('');
  const [customVotes, setCustomVotes] = useState(10);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => setCandidates(d.candidates || [])).catch(() => setCandidates([]));
    fetch('/api/vote-packages').then(r => r.json()).then(d => setPackages(d.packages || [])).catch(() => {});
    fetch('/api/public/summary').then(r => r.json()).then(d => { setConfig(d.config); setTotals(d); }).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(VOTER_KEY) || 'null');
      if (saved) { setName(saved.name || ''); setEmail(saved.email || ''); setPhone(saved.phone || ''); }
    } catch {}
  }, []);

  const grouped = {};
  (candidates || []).forEach(c => {
    const key = c.section_label || 'Other';
    (grouped[key] = grouped[key] || []).push(c);
  });
  Object.values(grouped).forEach(list => list.sort((a, b) => b.votes - a.votes));

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
    if (!name.trim()) { setErr('Please enter your name.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Please enter a valid email.'); return; }
    if (phone.replace(/\D/g, '').length < 9) { setErr('Please enter a working phone number.'); return; }

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

          {totals && (totals.votesTotal > 0 || totals.candidatesCount > 0) && (
            <div className="banner banner-gold" style={{ marginBottom: 20 }}>
              🗳️ {totals.votesTotal} vote{totals.votesTotal === 1 ? '' : 's'} cast so far
              {totals.voteRevenueGHS > 0 && <> · GH₵{totals.voteRevenueGHS.toFixed(2)} raised for the free awards</>}
              {' · '}<a href="/vote/results" style={{ color: 'inherit', textDecoration: 'underline' }}>see the leaderboard →</a>
            </div>
          )}

          {closedMsg && <div className="banner banner-bad" style={{ marginBottom: 20 }}>{closedMsg}</div>}

          {!closedMsg && candidates.length === 0 && (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              Voting hasn't opened yet — check back once the ballot is announced.
            </div>
          )}

          {!closedMsg && !picked && Object.keys(grouped).map(section => (
            <div key={section} style={{ marginBottom: 26 }}>
              <h3 style={{ margin: '0 0 12px' }}>{section}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {grouped[section].map(c => (
                  <div key={c.id} className="panel panel-pad" style={{ textAlign: 'center' }}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt={c.nominee_name} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 10px' }} />
                      : <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--panel-2)', margin: '0 auto 10px' }} />}
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nominee_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 6 }}>{c.award_name}</div>
                    <div className="badge badge-used" style={{ marginBottom: 10 }}>{c.votes} vote{c.votes === 1 ? '' : 's'}</div>
                    <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                      onClick={() => { setPickedId(c.id); setErr(''); }}>
                      Vote →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {picked && (
            <div className="panel panel-pad">
              <button className="small-btn" style={{ marginBottom: 14 }} onClick={() => setPickedId(null)}>← Back to candidates</button>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                {picked.photo_url
                  ? <img src={picked.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--panel-2)' }} />}
                <div>
                  <div style={{ fontWeight: 700 }}>{picked.nominee_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{picked.award_name} · {picked.votes} votes so far</div>
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
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>{p.votes}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>votes</div>
                        <div style={{ fontSize: 13, marginTop: 6 }}>GH₵{Number(p.price_ghs).toFixed(2)}</div>
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
                <label>Your name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ama Mensah" />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  <div className="hint">Paystack sends your receipt here.</div>
                </div>
                <div className="field">
                  <label>Phone *</label>
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
