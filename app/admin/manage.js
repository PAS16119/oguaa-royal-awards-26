'use client';
import { useEffect, useState } from 'react';
import { toast } from '../components';

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

      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>Save these settings</button>
      {msg && <div className={`banner ${msg.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 12 }}>{msg.text}</div>}
    </div>
  );
}
