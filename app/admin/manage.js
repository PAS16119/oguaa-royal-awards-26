'use client';
import { useEffect, useState } from 'react';
import { toast } from '../components';
import PosterCard from '../vote/poster/PosterCard';

function Loading() {
  return <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Loading…</div>;
}

async function api(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ======================================================= AWARDS MANAGER === */
export function AwardsTab() {
  const [track, setTrack] = useState('paid');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});
  const [newGroup, setNewGroup] = useState('');
  const [bulkFor, setBulkFor] = useState(null);
  const [bulkText, setBulkText] = useState('');

  async function load(t = track) {
    setLoading(true);
    try {
      const [cat, noms] = await Promise.all([
        fetch(`/api/catalog?track=${t}&all=1`).then(r => r.json()),
        fetch('/api/nominations').then(r => r.json()),
      ]);
      setSections(cat.sections || []);
      const c = {};
      (noms.nominations || []).forEach(n => {
        if (n.award_id) c[n.award_id] = (c[n.award_id] || 0) + 1;
      });
      setCounts(c);
    } catch (e) { toast(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(track); /* eslint-disable-next-line */ }, [track]);

  async function run(fn) {
    try { await fn(); await load(); } catch (e) { toast(e.message); }
  }

  const addGroup = () => run(async () => {
    if (!newGroup.trim()) { toast('Give the group a name'); return; }
    const emoji = prompt('An emoji for this group (optional):', '🏆') || '🏆';
    await api('/api/catalog/sections', 'POST', { track, label: newGroup.trim(), emoji });
    setNewGroup('');
    toast('Group added');
  });

  const editGroup = (s) => run(async () => {
    const label = prompt('Group name:', s.label);
    if (label === null) return;
    await api('/api/catalog/sections', 'PATCH', { key: s.key, label: label.trim() || s.label });
  });

  const deleteGroup = (s) => run(async () => {
    if (!confirm(`Delete the group "${s.label}" and all its awards? This cannot be undone.`)) return;
    await api('/api/catalog/sections', 'DELETE', { key: s.key });
    toast('Group deleted');
  });

  const addAward = (s) => run(async () => {
    const name = prompt(`New award under "${s.label}":`);
    if (!name || !name.trim()) return;
    const nominable = confirm('Should people be able to NOMINATE for this award?\n\nOK = yes, open for nomination\nCancel = decided from records only');
    await api('/api/catalog/awards', 'POST', { sectionKey: s.key, name: name.trim(), nominable });
    toast('Award added');
  });

  const addBulk = (s) => run(async () => {
    const lines = bulkText.split('\n').map(x => x.trim()).filter(Boolean);
    if (!lines.length) { toast('Nothing to add'); return; }
    await api('/api/catalog/awards', 'POST', { sectionKey: s.key, bulk: bulkText, nominable: true });
    setBulkText(''); setBulkFor(null);
    toast(`${lines.length} award${lines.length > 1 ? 's' : ''} added`);
  });

  const editAward = (a) => run(async () => {
    const name = prompt('Award name:', a.name);
    if (name === null) return;
    const notes = prompt('Criteria / note shown under this award (leave blank for none):', a.notes || '');
    await api('/api/catalog/awards', 'PATCH', { id: a.id, name: name.trim() || a.name, notes: notes === null ? a.notes : notes });
  });

  const patchAward = (a, patch) => run(() => api('/api/catalog/awards', 'PATCH', { id: a.id, ...patch }));
  const patchGroup = (s, patch) => run(() => api('/api/catalog/sections', 'PATCH', { key: s.key, ...patch }));

  const deleteAward = (a) => run(async () => {
    if (!confirm(`Delete "${a.name}"?`)) return;
    await api('/api/catalog/awards', 'DELETE', { id: a.id });
    toast('Award deleted');
  });

  const totalAwards = sections.reduce((n, s) => n + s.awards.length, 0);
  const nominableCount = sections.reduce((n, s) => n + s.awards.filter(a => a.nominable).length, 0);

  return (
    <div>
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button className={track === 'paid' ? 'active' : ''} onClick={() => setTrack('paid')}>💰 Paid track (Royal Awards)</button>
        <button className={track === 'free' ? 'active' : ''} onClick={() => setTrack('free')}>🎁 Free track (Merit Awards)</button>
      </div>

      <div className="banner banner-gold" style={{ marginBottom: 16 }}>
        {track === 'paid'
          ? 'These categories need a paid access code. Every change here shows up on the nomination form immediately.'
          : 'These are nominated free of charge. Awards switched to "Records only" appear on the site as decided by results and service records, with no nomination form.'}
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="kpi-grid" style={{ marginBottom: 16 }}>
            <div className="kpi"><div className="n">{sections.length}</div><div className="l">Groups</div></div>
            <div className="kpi"><div className="n">{totalAwards}</div><div className="l">Awards</div></div>
            <div className="kpi"><div className="n">{nominableCount}</div><div className="l">Open for nomination</div></div>
            <div className="kpi"><div className="n">{totalAwards - nominableCount}</div><div className="l">Records only</div></div>
          </div>

          {sections.map((s, si) => (
            <div className="panel panel-pad" key={s.key} style={{ marginBottom: 16, opacity: s.active ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{s.emoji} {s.label}{!s.active && <span className="badge badge-void" style={{ marginLeft: 8 }}>hidden</span>}</h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{s.awards.length} award{s.awards.length === 1 ? '' : 's'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="small-btn" disabled={si === 0} onClick={() => patchGroup(s, { move: 'up' })}>↑</button>
                  <button className="small-btn" disabled={si === sections.length - 1} onClick={() => patchGroup(s, { move: 'down' })}>↓</button>
                  <button className="small-btn" onClick={() => editGroup(s)}>Rename</button>
                  <button className="small-btn" onClick={() => patchGroup(s, { active: !s.active })}>{s.active ? 'Hide' : 'Show'}</button>
                  <button className="small-btn danger" onClick={() => deleteGroup(s)}>Delete</button>
                </div>
              </div>

              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table>
                  <thead>
                    <tr><th>Award</th><th>Nomination</th><th>Noms</th><th style={{ minWidth: 190 }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {s.awards.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 18 }}>No awards in this group yet.</td></tr>
                    ) : s.awards.map((a, ai) => (
                      <tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
                        <td>
                          <strong>{a.name}</strong>
                          {!a.active && <span className="badge badge-void" style={{ marginLeft: 8 }}>hidden</span>}
                          {a.notes && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 3 }}>{a.notes}</div>}
                        </td>
                        <td>
                          <span className={`badge ${a.nominable ? 'badge-used' : 'badge-unused'}`}>
                            {a.nominable ? 'Open' : 'Records only'}
                          </span>
                        </td>
                        <td>{counts[a.id] || 0}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="small-btn" disabled={ai === 0} onClick={() => patchAward(a, { move: 'up' })}>↑</button>{' '}
                          <button className="small-btn" disabled={ai === s.awards.length - 1} onClick={() => patchAward(a, { move: 'down' })}>↓</button>{' '}
                          <button className="small-btn" onClick={() => editAward(a)}>Edit</button>{' '}
                          <button className="small-btn" onClick={() => patchAward(a, { nominable: !a.nominable })}>
                            {a.nominable ? 'Records only' : 'Open it'}
                          </button>{' '}
                          <button className="small-btn" onClick={() => patchAward(a, { active: !a.active })}>{a.active ? 'Hide' : 'Show'}</button>{' '}
                          <button className="small-btn danger" onClick={() => deleteAward(a)}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-outline-dark" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => addAward(s)}>+ Add award</button>
                <button className="btn btn-outline-dark" style={{ padding: '9px 16px', fontSize: 13 }}
                  onClick={() => { setBulkFor(bulkFor === s.key ? null : s.key); setBulkText(''); }}>
                  {bulkFor === s.key ? 'Cancel paste' : 'Paste a list'}
                </button>
              </div>

              {bulkFor === s.key && (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>One award per line</label>
                  <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                    placeholder={'Most Hardworking — Form 2\nMost Hardworking — Form 3'} />
                  <button className="btn btn-gold" style={{ marginTop: 8 }} onClick={() => addBulk(s)}>Add them all</button>
                </div>
              )}
            </div>
          ))}

          <div className="panel panel-pad">
            <h3 style={{ marginTop: 0 }}>Add a new group</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
              A group is a heading on the form, e.g. “Senior Student” or “Staff Awards & Recognition”.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 220 }}>
                <label>Group name</label>
                <input type="text" value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="e.g. Old Students" />
              </div>
              <button className="btn btn-gold" onClick={addGroup}>Add group</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================= CO-ADMINS === */
export function CoAdminsTab() {
  const [coadmins, setCoAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [created, setCreated] = useState(null);

  async function load() { setLoading(true); const d = await fetch('/api/coadmins').then(r => r.json()); setCoAdmins(d.coadmins || []); setLoading(false); }
  useEffect(() => { load(); }, []);

  async function createCoAdmin() {
    if (!newName.trim()) { toast('Enter a name'); return; }
    try {
      const data = await api('/api/coadmins', 'POST', { name: newName.trim() });
      setCreated(data); setNewName(''); toast(`Co-Admin ${data.name} created`); load();
    } catch (e) { toast(e.message); }
  }
  async function resetPin(id, name) {
    if (!confirm(`Reset PIN for ${name}? Their old PIN will stop working immediately.`)) return;
    try {
      const data = await api(`/api/coadmins/${id}/reset-pin`, 'POST');
      alert(`New PIN for ${name} (${id}): ${data.pin}\n\nShare this securely — it will not be shown again.`);
      toast(`PIN reset for ${name}`); load();
    } catch (e) { toast(e.message); }
  }
  async function toggle(id, active) {
    try { await api(`/api/coadmins/${id}/toggle`, 'POST', { active }); toast(active ? 'Co-Admin reactivated' : 'Co-Admin deactivated'); load(); }
    catch (e) { toast(e.message); }
  }
  async function rename(id, oldName) {
    const name = prompt('New name for this co-admin:', oldName);
    if (!name || !name.trim() || name.trim() === oldName) return;
    try { await api(`/api/coadmins/${id}/rename`, 'POST', { name: name.trim() }); toast('Co-Admin renamed'); load(); }
    catch (e) { toast(e.message); }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="banner banner-gold" style={{ marginBottom: 16 }}>
        Co-Admins can help run Overview, Awards, Access Codes, Online Sales, Nominations, Export and the Audit Trail.
        They cannot manage Agents, cannot touch Settings (price, dates, MoMo, Paystack), and cannot create other Co-Admins —
        only the Main Admin can do those.
      </div>
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Add a Co-Admin</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Each Co-Admin gets their own ID and PIN, separate from yours and from any agent's.</p>
        <div className="two-col">
          <div className="field" style={{ marginBottom: 0 }}><label>Name</label><input type="text" placeholder="e.g. Mr. Twumasi — Awards sub-committee" value={newName} onChange={e => setNewName(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={createCoAdmin}>Create co-admin →</button></div>
        </div>
        {created && (
          <div className="banner banner-good" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 14 }}>
            <div>Co-Admin created. Share these credentials with <strong>{created.name}</strong> now — the PIN won't be shown again:</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="code-chip">{created.id}</span>
              <span className="code-chip">{created.pin}</span>
            </div>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>ID</th><th>Status</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>
            {coadmins.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No co-admins yet — create one above.</td></tr> :
              coadmins.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td className="mono">{a.id}</td>
                  <td>{a.active ? <span className="badge badge-used">Active</span> : <span className="badge badge-inactive">Inactive</span>}</td>
                  <td>{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : 'Never'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="small-btn" onClick={() => rename(a.id, a.name)}>Rename</button>{' '}
                    <button className="small-btn" onClick={() => resetPin(a.id, a.name)}>Reset PIN</button>{' '}
                    {a.active
                      ? <button className="small-btn danger" onClick={() => toggle(a.id, false)}>Deactivate</button>
                      : <button className="small-btn good" onClick={() => toggle(a.id, true)}>Reactivate</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="security-note" style={{ marginTop: 16 }}>
        🔒 Same protection as agents: PINs are hashed with bcrypt, shown to you once at creation or reset, and never stored anywhere in plain text.
      </div>
    </div>
  );
}

/* =========================================================== VOTING ===== */
export function VotingTab({ isMainAdmin }) {
  const [sub, setSub] = useState('ballot');
  return (
    <div>
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button className={sub === 'ballot' ? 'active' : ''} onClick={() => setSub('ballot')}>🗳️ Ballot</button>
        {isMainAdmin && <button className={sub === 'packages' ? 'active' : ''} onClick={() => setSub('packages')}>💎 Premium levels</button>}
        <button className={sub === 'transactions' ? 'active' : ''} onClick={() => setSub('transactions')}>💳 Vote purchases</button>
      </div>
      {sub === 'ballot' && <BallotTab />}
      {sub === 'packages' && isMainAdmin && <VotePackagesTab />}
      {sub === 'transactions' && <VoteTransactionsTab isMainAdmin={isMainAdmin} />}
    </div>
  );
}

function BallotTab() {
  const [candidates, setCandidates] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posterFor, setPosterFor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [cand, noms] = await Promise.all([
        fetch('/api/candidates?all=1').then(r => r.json()),
        fetch('/api/nominations?track=paid').then(r => r.json()),
      ]);
      const cList = cand.candidates || [];
      setCandidates(cList);
      const onBallot = new Set(cList.map(c => c.nomination_id));
      setPending((noms.nominations || []).filter(n => !onBallot.has(n.id)));
    } catch (e) { toast(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addToBallot(nominationId) {
    try { await api('/api/candidates', 'POST', { nominationId }); toast('Added to ballot'); load(); }
    catch (e) { toast(e.message); }
  }
  async function toggleActive(c) {
    try { await api(`/api/candidates/${c.id}`, 'PATCH', { active: !c.active }); load(); }
    catch (e) { toast(e.message); }
  }
  async function removeCandidate(c) {
    if (!confirm(`Remove ${c.nominee_name} from the ballot?`)) return;
    try { await api(`/api/candidates/${c.id}`, 'DELETE'); toast('Removed'); load(); }
    catch (e) { toast(e.message); }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="banner banner-gold" style={{ marginBottom: 16 }}>
        Only paid-track nominations you explicitly add here can be voted for — nothing lands on the ballot automatically.
      </div>

      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Paid nominations awaiting the ballot ({pending.length})</h3>
        {pending.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Nothing waiting — every paid nomination is either already on the ballot, or there are none yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nominee</th><th>Category</th><th></th></tr></thead>
              <tbody>
                {pending.map(n => (
                  <tr key={n.id}>
                    <td>{n.nominee_name}</td>
                    <td>{n.category}</td>
                    <td><button className="small-btn" onClick={() => addToBallot(n.id)}>Add to ballot →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Current ballot ({candidates.length})</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: -6 }}>
          Each candidate's <strong>Code</strong> is what supporters dial into the USSD voting menu — print it on
          posters/flyers next to their name and photo.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Candidate</th><th>Category</th><th>Votes</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {candidates.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No candidates yet.</td></tr> :
                candidates.map(c => (
                  <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                    <td><span className="badge">{c.ballot_code || '—'}</span></td>
                    <td>{c.nominee_name}</td>
                    <td>{c.award_name}</td>
                    <td><strong>{c.votes}</strong></td>
                    <td>{c.active ? <span className="badge badge-used">Live</span> : <span className="badge badge-inactive">Hidden</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="small-btn" onClick={() => setPosterFor(c)}>🖨️ Poster</button>{' '}
                      <button className="small-btn" onClick={() => toggleActive(c)}>{c.active ? 'Hide' : 'Show'}</button>{' '}
                      <button className="small-btn danger" onClick={() => removeCandidate(c)}>Remove</button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {posterFor && <CandidatePoster candidate={posterFor} onClose={() => setPosterFor(null)} />}
    </div>
  );
}

function CandidatePoster({ candidate, onClose }) {
  const [shortcode, setShortcode] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ora26.vercel.app';
  const voteUrl = `${origin}/vote?code=${candidate.ballot_code}`;
  const nomineeLink = `${origin}/vote/poster/${candidate.ballot_code}`;

  useEffect(() => {
    fetch('/api/public/summary').then(r => r.json()).then(d => setShortcode(d?.config?.ussd_shortcode || null)).catch(() => {});
  }, []);

  async function copyNomineeLink() {
    try { await navigator.clipboard.writeText(nomineeLink); toast('Link copied — send it to the nominee'); }
    catch { toast('Could not copy — long-press the link instead'); }
  }

  // html2canvas is loaded from a CDN on demand rather than bundled, since
  // downloading a poster image is a rarely-used admin action — not worth
  // adding to every visitor's JS bundle. useCORS lets it read the candidate
  // photo and QR image (both served with permissive CORS) into the canvas;
  // without that, the download would silently omit those two images.
  async function downloadPoster() {
    setDownloading(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const node = document.getElementById('poster-card');
      const canvas = await window.html2canvas(node, { useCORS: true, backgroundColor: null, scale: 2 });
      const link = document.createElement('a');
      link.download = `${candidate.nominee_name.replace(/[^a-z0-9]+/gi, '-')}-poster.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      toast('Download failed — try Print instead, or right-click and Save on the public poster page');
    }
    setDownloading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="poster-print-area">
          <PosterCard candidate={candidate} voteUrl={voteUrl} shortcode={shortcode} />
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-gold" style={{ flex: '1 1 140px', justifyContent: 'center' }} onClick={downloadPoster} disabled={downloading}>
            {downloading ? 'Preparing…' : '⬇ Download PNG'}
          </button>
          <button className="btn btn-outline-dark" style={{ flex: '1 1 140px', justifyContent: 'center' }} onClick={() => window.print()}>Print</button>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline-dark" style={{ flex: '1 1 200px', justifyContent: 'center' }} onClick={copyNomineeLink}>🔗 Copy link to send the nominee</button>
          <button className="btn btn-outline-dark" onClick={onClose}>Close</button>
        </div>
        <div className="hint no-print" style={{ marginTop: 8, textAlign: 'center' }}>
          The nominee link opens a public page with this same poster — no login needed. They can download or screenshot it themselves to share on WhatsApp/status.
        </div>
      </div>
    </div>
  );
}

function VotePackagesTab() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ label: '', votes: '', priceGHS: '' });

  async function load() { setLoading(true); const d = await fetch('/api/vote-packages?all=1').then(r => r.json()); setPackages(d.packages || []); setLoading(false); }
  useEffect(() => { load(); }, []);

  async function create() {
    try {
      await api('/api/vote-packages', 'POST', form);
      setForm({ label: '', votes: '', priceGHS: '' }); toast('Package added'); load();
    } catch (e) { toast(e.message); }
  }
  async function toggle(p) { try { await api(`/api/vote-packages/${p.id}`, 'PATCH', { active: !p.active }); load(); } catch (e) { toast(e.message); } }
  async function edit(p) {
    const label = prompt('Package name:', p.label); if (label === null) return;
    const votes = prompt('Votes included:', p.votes); if (votes === null) return;
    const priceGHS = prompt('Price (GH₵):', p.price_ghs); if (priceGHS === null) return;
    try { await api(`/api/vote-packages/${p.id}`, 'PATCH', { label, votes: parseInt(votes), priceGHS: Number(priceGHS) }); load(); } catch (e) { toast(e.message); }
  }
  async function del(p) {
    if (!confirm(`Delete "${p.label}"?`)) return;
    try { await api(`/api/vote-packages/${p.id}`, 'DELETE'); toast('Deleted'); load(); } catch (e) { toast(e.message); }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="banner banner-gold" style={{ marginBottom: 16 }}>
        "Premium levels" — bulk vote bundles a supporter can buy in one tap instead of entering a custom count.
      </div>
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Add a package</h3>
        <div className="two-col">
          <div className="field" style={{ marginBottom: 0 }}><label>Name</label><input type="text" placeholder="e.g. Gold Supporter" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label>Votes</label><input type="number" value={form.votes} onChange={e => setForm(f => ({ ...f, votes: e.target.value }))} /></div>
        </div>
        <div className="two-col">
          <div className="field"><label>Price (GH₵)</label><input type="number" step="0.01" value={form.priceGHS} onChange={e => setForm(f => ({ ...f, priceGHS: e.target.value }))} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={create}>Add package</button></div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Votes</th><th>Price</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {packages.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No packages yet — supporters can still vote with a custom count.</td></tr> :
              packages.map(p => (
                <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                  <td>{p.label}</td><td>{p.votes}</td><td>GH₵{Number(p.price_ghs).toFixed(2)}</td>
                  <td>{p.active ? <span className="badge badge-used">Active</span> : <span className="badge badge-inactive">Hidden</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="small-btn" onClick={() => edit(p)}>Edit</button>{' '}
                    <button className="small-btn" onClick={() => toggle(p)}>{p.active ? 'Hide' : 'Show'}</button>{' '}
                    <button className="small-btn danger" onClick={() => del(p)}>Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VoteTransactionsTab({ isMainAdmin }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() { setLoading(true); const d = await fetch('/api/vote-payments').then(r => r.json()); setRows(d.votePayments || []); setLoading(false); }
  useEffect(() => { load(); }, []);

  async function voidPurchase(ref) {
    const reason = prompt('Reason for voiding this vote purchase (required):');
    if (!reason || !reason.trim()) return;
    try { await api(`/api/vote-payments/${encodeURIComponent(ref)}/void`, 'POST', { reason }); toast('Voided'); load(); }
    catch (e) { toast(e.message); }
  }

  if (loading) return <Loading />;

  const paid = rows.filter(r => r.status === 'paid');
  const votesTotal = paid.reduce((n, r) => n + (r.votes || 0), 0);
  const revenue = paid.reduce((n, r) => n + Number(r.amount_pesewas || 0), 0) / 100;

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="n">{paid.length}</div><div className="l">Successful purchases</div></div>
        <div className="kpi"><div className="n">{votesTotal}</div><div className="l">Votes credited</div></div>
        <div className="kpi"><div className="n">GH₵{revenue.toFixed(2)}</div><div className="l">Raised</div></div>
        <div className="kpi"><div className="n">{rows.filter(r => r.status === 'voided').length}</div><div className="l">Voided</div></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Voter</th><th>Candidate</th><th>Votes</th><th>Amount</th><th>Status</th><th>When</th>{isMainAdmin && <th></th>}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={isMainAdmin ? 8 : 7} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No vote purchases yet.</td></tr> :
              rows.map(p => (
                <tr key={p.reference}>
                  <td className="mono" style={{ fontSize: 11 }}>{p.reference}</td>
                  <td>{p.buyer_name}<div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{p.phone}</div></td>
                  <td>{p.nominee_name}</td>
                  <td>{p.votes}</td>
                  <td>GH₵{(Number(p.amount_pesewas) / 100).toFixed(2)}</td>
                  <td><span className={`badge ${p.status === 'paid' ? 'badge-used' : p.status === 'pending' ? 'badge-unused' : 'badge-void'}`}>{p.status}</span>
                    {p.status === 'voided' && p.void_reason && <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.void_reason}</div>}
                  </td>
                  <td style={{ fontSize: 11 }}>{new Date(p.paid_at || p.created_at).toLocaleString()}</td>
                  {isMainAdmin && <td>{p.status === 'paid' && <button className="small-btn danger" onClick={() => voidPurchase(p.reference)}>Void</button>}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="security-note" style={{ marginTop: 16 }}>
        🔒 Votes are only ever credited after Paystack confirms payment, and the amount is checked against what the
        server calculated at checkout. Voiding a purchase subtracts its votes and keeps the record — nothing is ever
        silently edited.
      </div>
    </div>
  );
}

/* ====================================================== ONLINE PAYMENTS === */
export function PaymentsTab() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments').then(r => r.json()).then(d => { setPayments(d.payments || []); setLoading(false); });
  }, []);

  if (loading) return <Loading />;

  const paid = payments.filter(p => p.status === 'paid');
  const revenue = paid.reduce((n, p) => n + Number(p.amount_pesewas || 0), 0) / 100;
  const codesSold = paid.reduce((n, p) => n + (p.quantity || 0), 0);

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="n">{paid.length}</div><div className="l">Successful payments</div></div>
        <div className="kpi"><div className="n">{codesSold}</div><div className="l">Codes sold online</div></div>
        <div className="kpi"><div className="n">GH₵{revenue.toFixed(2)}</div><div className="l">Collected online</div></div>
        <div className="kpi"><div className="n">{payments.filter(p => p.status === 'pending').length}</div><div className="l">Started but unpaid</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Reference</th><th>Buyer</th><th>Qty</th><th>Amount</th><th>Status</th><th>Codes</th><th>When</th></tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No online payments yet.</td></tr>
            ) : payments.map(p => (
              <tr key={p.reference}>
                <td className="mono" style={{ fontSize: 11 }}>{p.reference}</td>
                <td>{p.buyer_name}<div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{p.phone} · {p.email}</div></td>
                <td>{p.quantity}</td>
                <td>GH₵{(Number(p.amount_pesewas) / 100).toFixed(2)}</td>
                <td><span className={`badge ${p.status === 'paid' ? 'badge-used' : p.status === 'pending' ? 'badge-unused' : 'badge-void'}`}>{p.status}</span></td>
                <td className="mono" style={{ fontSize: 11 }}>{(p.codes || []).join(', ') || '—'}</td>
                <td style={{ fontSize: 11 }}>{new Date(p.paid_at || p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="security-note" style={{ marginTop: 16 }}>
        🔒 Codes are issued only after Paystack itself confirms the payment, and the amount is checked against what was
        recorded when checkout started. A payment stuck on “pending” means the buyer never finished — no code was issued.
      </div>
    </div>
  );
}

/* ================================== FREE TRACK + ONLINE SALES SETTINGS === */
export function ExtraSettings() {
  const [config, setConfig] = useState(null);
  const [paystackReady, setPaystackReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(d => {
      setConfig(d.config || {});
      setPaystackReady(Boolean(d.paystackConfigured));
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  async function save() {
    const res = await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        freeEnabled: !!config.free_enabled,
        freeOpenDate: config.free_open_date ? String(config.free_open_date).slice(0, 10) : null,
        freeCloseDate: config.free_close_date ? String(config.free_close_date).slice(0, 10) : null,
        freeMaxPerPhone: parseInt(config.free_max_per_phone) || 6,
        freePhotoRequired: !!config.free_photo_required,
        onlineSalesEnabled: !!config.online_sales_enabled,
        maxCodesPerPurchase: parseInt(config.max_codes_per_purchase) || 10,
        votingEnabled: !!config.voting_enabled,
        votePriceGHS: Number(config.vote_price_ghs) || 1,
        votingOpenDate: config.voting_open_date ? String(config.voting_open_date).slice(0, 10) : null,
        votingCloseDate: config.voting_close_date ? String(config.voting_close_date).slice(0, 10) : null,
        maxVotesPerPurchase: parseInt(config.max_votes_per_purchase) || 500,
        resultsPublic: config.results_public !== false,
        ussdShortcode: config.ussd_shortcode || null,
      }),
    });
    if (!res.ok) { setMsg({ ok: false, text: 'Failed to save.' }); return; }
    setMsg({ ok: true, text: 'Saved.' }); toast('Saved');
  }

  const set = (k, v) => setConfig(c => ({ ...c, [k]: v }));

  return (
    <div className="panel panel-pad" style={{ maxWidth: 560, marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Free nominations &amp; online sales</h3>

      <label className="checkbox-row" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={!!config.free_enabled} onChange={e => set('free_enabled', e.target.checked)} />
        Free merit-award nominations are open
      </label>

      <div className="two-col">
        <div className="field"><label>Free track opens</label>
          <input type="text" placeholder="YYYY-MM-DD" value={config.free_open_date ? String(config.free_open_date).slice(0, 10) : ''} onChange={e => set('free_open_date', e.target.value)} /></div>
        <div className="field"><label>Free track closes</label>
          <input type="text" placeholder="YYYY-MM-DD" value={config.free_close_date ? String(config.free_close_date).slice(0, 10) : ''} onChange={e => set('free_close_date', e.target.value)} /></div>
      </div>
      <div className="two-col">
        <div className="field"><label>Max free nominations per phone</label>
          <input type="text" value={config.free_max_per_phone ?? 6} onChange={e => set('free_max_per_phone', e.target.value)} />
          <div className="hint">One person can still only nominate once per award.</div></div>
        <div className="field"><label>Codes per online purchase (max)</label>
          <input type="text" value={config.max_codes_per_purchase ?? 10} onChange={e => set('max_codes_per_purchase', e.target.value)} /></div>
      </div>

      <label className="checkbox-row" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={!!config.free_photo_required} onChange={e => set('free_photo_required', e.target.checked)} />
        Require a photo on free nominations
      </label>

      <div className="divider-label">online payment</div>

      <label className="checkbox-row" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={!!config.online_sales_enabled} disabled={!paystackReady}
          onChange={e => set('online_sales_enabled', e.target.checked)} />
        Let people buy access codes themselves with Paystack
      </label>
      {!paystackReady && (
        <div className="banner banner-bad" style={{ marginBottom: 12 }}>
          PAYSTACK_SECRET_KEY is not set on this deployment, so online purchase cannot be switched on yet.
        </div>
      )}

      <div className="divider-label">paid voting (fundraiser)</div>

      <label className="checkbox-row" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={!!config.voting_enabled} disabled={!paystackReady} onChange={e => set('voting_enabled', e.target.checked)} />
        Voting is open
      </label>
      <div className="two-col">
        <div className="field"><label>Voting opens</label>
          <input type="text" placeholder="YYYY-MM-DD" value={config.voting_open_date ? String(config.voting_open_date).slice(0, 10) : ''} onChange={e => set('voting_open_date', e.target.value)} /></div>
        <div className="field"><label>Voting closes</label>
          <input type="text" placeholder="YYYY-MM-DD" value={config.voting_close_date ? String(config.voting_close_date).slice(0, 10) : ''} onChange={e => set('voting_close_date', e.target.value)} /></div>
      </div>
      <div className="two-col">
        <div className="field"><label>Price per single vote (GH₵)</label>
          <input type="text" value={config.vote_price_ghs ?? 1} onChange={e => set('vote_price_ghs', e.target.value)} />
          <div className="hint">Ignored when a supporter picks a package instead.</div></div>
        <div className="field"><label>Max votes per single purchase</label>
          <input type="text" value={config.max_votes_per_purchase ?? 500} onChange={e => set('max_votes_per_purchase', e.target.value)} /></div>
      </div>

      <div className="field" style={{ marginBottom: 12 }}><label>USSD shortcode (shown on posters)</label>
        <input type="text" placeholder="*928*135#" value={config.ussd_shortcode || ''} onChange={e => set('ussd_shortcode', e.target.value)} />
        <div className="hint">The exact code supporters dial, once your Arkesel extension is approved — e.g. *928*135#.</div></div>

      <label className="checkbox-row" style={{ marginBottom: 4 }}>
        <input type="checkbox" checked={config.results_public !== false} onChange={e => set('results_public', e.target.checked)} />
        Show live vote totals publicly
      </label>
      <div className="hint" style={{ marginBottom: 12 }}>
        Turn this off to hide vote counts on /vote and /vote/results (and the USSD "check votes" option) —
        useful for building suspense, or if you'd rather a trailing candidate not see exactly how far behind they are.
        People can still vote while this is off; they just can't see the running tally. Admin and Co-Admin views are unaffected.
      </div>

      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>Save these settings</button>
      {msg && <div className={`banner ${msg.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 12 }}>{msg.text}</div>}
    </div>
  );
}
