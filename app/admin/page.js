'use client';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../components';
import { AwardsTab, PaymentsTab, ExtraSettings, CoAdminsTab } from './manage';

function sanitizeFile(s) {
  return (s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

function Badge({ status }) {
  const map = { used: ['badge-used', 'Used'], unused: ['badge-unused', 'Unused'], void: ['badge-void', 'Void'] };
  const [cls, label] = map[status] || map.unused;
  return <span className={`badge ${cls}`}>{label}</span>;
}

const ACTION_LABELS = {
  code_generated: 'Code generated', code_used: 'Code used (nomination)', code_void: 'Code voided',
  agent_created: 'Agent created', agent_pin_reset: 'Agent PIN reset', agent_deactivated: 'Agent deactivated',
  agent_reactivated: 'Agent reactivated', agent_renamed: 'Agent renamed', nomination_deleted: 'Nomination deleted', admin_login: 'Main admin login', agent_login: 'Agent login',
  main_admin_setup: 'Main admin PIN created', settings_updated: 'Settings updated',
  coadmin_created: 'Co-Admin created', coadmin_pin_reset: 'Co-Admin PIN reset', coadmin_deactivated: 'Co-Admin deactivated',
  coadmin_reactivated: 'Co-Admin reactivated', coadmin_renamed: 'Co-Admin renamed', coadmin_login: 'Co-Admin login',
  award_group_created: 'Award group added', award_group_updated: 'Award group edited', award_group_deleted: 'Award group deleted',
  award_created: 'Award added', award_updated: 'Award edited', award_deleted: 'Award deleted',
  free_nomination: 'Free nomination submitted', codes_purchased_online: 'Codes purchased online',
};
function actorLabel(row) {
  if (row.actor_type === 'main-admin') return 'Main Admin';
  if (row.actor_type === 'co-admin') return `Co-Admin · ${row.actor_name} (${row.actor_id})`;
  if (row.actor_type === 'agent') return `Agent · ${row.actor_name} (${row.actor_id})`;
  if (row.actor_type === 'online') return 'Online purchase';
  if (row.actor_type === 'public') return row.actor_name ? `Public · ${row.actor_name}` : 'Public';
  return 'System';
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [loginMode, setLoginMode] = useState('admin');
  const [adminExists, setAdminExists] = useState(true);

  useEffect(() => {
    (async () => {
      const [meRes, setupRes] = await Promise.all([
        fetch('/api/auth/me').then(r => r.json()),
        fetch('/api/auth/setup').then(r => r.json()),
      ]);
      setSession(meRes.session);
      setAdminExists(setupRes.exists);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Shell>
        <div className="gate"><div style={{ textAlign: 'center', color: 'var(--ink-soft)' }}><span className="loading-spin" /> Loading…</div></div>
        <Toast />
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <LoginGate
          loginMode={loginMode} setLoginMode={setLoginMode}
          adminExists={adminExists} setAdminExists={setAdminExists}
          onLoggedIn={setSession}
        />
        <Toast />
      </Shell>
    );
  }

  return (
    <Shell>
      {session.role === 'main-admin' || session.role === 'co-admin'
        ? <MainAdminDashboard role={session.role} onLogout={() => setSession(null)} />
        : <AgentDashboard session={session} onLogout={() => setSession(null)} />}
      <Toast />
    </Shell>
  );
}

/* ============================== LOGIN GATE ============================== */
function LoginGate({ loginMode, setLoginMode, adminExists, setAdminExists, onLoggedIn }) {
  const router = useRouter();
  return (
    <div className="gate">
      <div className="panel panel-pad">
        <Seal id="gate" />
        <h2 style={{ margin: '14px 0 4px', textAlign: 'center' }}>Committee &amp; agent access</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: '12.5px', textAlign: 'center', marginBottom: 20 }}>Role-based access — main admin, co-admins and sales agents sign in separately.</p>
        <div className="pill-tabs" style={{ marginBottom: 20 }}>
          <button className={loginMode === 'admin' ? 'active' : ''} onClick={() => setLoginMode('admin')}>Main Admin</button>
          <button className={loginMode === 'coadmin' ? 'active' : ''} onClick={() => setLoginMode('coadmin')}>Co-Admin</button>
          <button className={loginMode === 'agent' ? 'active' : ''} onClick={() => setLoginMode('agent')}>Sales Agent</button>
        </div>
        {loginMode === 'admin' && (adminExists ? <AdminLoginForm onLoggedIn={onLoggedIn} /> : <AdminSetupForm onDone={() => { setAdminExists(true); }} onLoggedIn={onLoggedIn} />)}
        {loginMode === 'coadmin' && <CoAdminLoginForm onLoggedIn={onLoggedIn} />}
        {loginMode === 'agent' && <AgentLoginForm onLoggedIn={onLoggedIn} />}
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 14, background: 'var(--parchment-2)', color: 'var(--ink)' }} onClick={() => router.push('/')}>
          ← Back to site
        </button>
      </div>
    </div>
  );
}

function AdminSetupForm({ onDone, onLoggedIn }) {
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [err, setErr] = useState('');
  async function submit() {
    if (p1.length < 6) { setErr('PIN must be at least 6 characters.'); return; }
    if (p1 !== p2) { setErr("PINs don't match."); return; }
    const res = await fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: p1 }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Something went wrong.'); return; }
    onDone(); onLoggedIn({ role: 'main-admin' }); toast('Main admin PIN created');
  }
  return (
    <div>
      <div className="banner banner-gold" style={{ marginBottom: 14 }}>No main admin PIN exists yet. Create one now — this is the only time it's set up.</div>
      <div className="field"><label>Choose a PIN (min. 6 characters)</label><input type="password" className="mono" value={p1} onChange={e => setP1(e.target.value)} /></div>
      <div className="field"><label>Confirm PIN</label><input type="password" className="mono" value={p2} onChange={e => setP2(e.target.value)} /></div>
      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Create main admin PIN →</button>
      {err && <div className="banner banner-bad" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

function AdminLoginForm({ onLoggedIn }) {
  const [pin, setPin] = useState(''); const [err, setErr] = useState('');
  async function submit() {
    const res = await fetch('/api/auth/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Incorrect PIN.'); return; }
    onLoggedIn({ role: 'main-admin' });
  }
  return (
    <div>
      <div className="field"><label>Main admin PIN</label><input type="password" className="mono" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Enter dashboard →</button>
      {err && <div className="banner banner-bad" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

function AgentLoginForm({ onLoggedIn }) {
  const [id, setId] = useState(''); const [pin, setPin] = useState(''); const [err, setErr] = useState('');
  async function submit() {
    const res = await fetch('/api/auth/agent-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: id, pin }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Login failed.'); return; }
    onLoggedIn({ role: 'agent', id: data.id, name: data.name });
  }
  return (
    <div>
      <div className="field"><label>Agent ID</label><input type="text" className="mono" style={{ textTransform: 'uppercase' }} placeholder="AGT-XXXX" value={id} onChange={e => setId(e.target.value)} /></div>
      <div className="field"><label>PIN</label><input type="password" className="mono" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Enter agent dashboard →</button>
      {err && <div className="banner banner-bad" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

function CoAdminLoginForm({ onLoggedIn }) {
  const [id, setId] = useState(''); const [pin, setPin] = useState(''); const [err, setErr] = useState('');
  async function submit() {
    const res = await fetch('/api/auth/coadmin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: id, pin }) });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Login failed.'); return; }
    onLoggedIn({ role: 'co-admin', id: data.id, name: data.name });
  }
  return (
    <div>
      <div className="field"><label>Co-Admin ID</label><input type="text" className="mono" style={{ textTransform: 'uppercase' }} placeholder="ADM-XXXX" value={id} onChange={e => setId(e.target.value)} /></div>
      <div className="field"><label>PIN</label><input type="password" className="mono" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Enter co-admin dashboard →</button>
      {err && <div className="banner banner-bad" style={{ marginTop: 12 }}>{err}</div>}
    </div>
  );
}

/* ========================== MAIN ADMIN DASHBOARD ========================== */
const STORAGE_NOTE_CAP_MB = null; // no artificial cap anymore — real Postgres + Blob storage

function MainAdminDashboard({ onLogout, role = 'main-admin' }) {
  const isMainAdmin = role === 'main-admin';
  const defaultTab = 'overview';
  const [tab, setTab] = useState(defaultTab);
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); onLogout(); }

  const tabs = [
    ['overview', 'Overview'], ['awards', 'Awards'], ['codes', 'Access Codes'],
    ['payments', 'Online Sales'], ['nominations', 'Nominations'], ['export', 'Export'],
    ...(isMainAdmin ? [['agents', 'Agents']] : []),
    ['audit', 'Audit Trail'],
    ...(isMainAdmin ? [['coadmins', 'Co-Admins'], ['settings', 'Settings']] : [['mypin', 'My PIN']]),
  ];

  return (
    <section className="block">
      <div className="wrap">
        <div className="section-head">
          <div><span className="section-tag">{isMainAdmin ? 'Main Admin' : 'Co-Admin'}</span><h2>Manage nominations</h2></div>
          <button className="btn btn-outline-dark" onClick={logout}>Log out</button>
        </div>
        <div className="admin-tabs">
          {tabs.map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'awards' && <AwardsTab />}
        {tab === 'codes' && <CodesTab role="main-admin" />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'nominations' && <NominationsTab />}
        {tab === 'export' && <ExportTab />}
        {isMainAdmin && tab === 'agents' && <AgentsTab />}
        {tab === 'audit' && <AuditTab />}
        {isMainAdmin && tab === 'coadmins' && <CoAdminsTab />}
        {isMainAdmin && tab === 'settings' && <SettingsTab />}
        {!isMainAdmin && tab === 'mypin' && <AgentPinTab />}
      </div>
    </section>
  );
}

function OverviewTab() {
  const [noms, setNoms] = useState([]);
  const [codes, setCodes] = useState([]);
  const [config, setConfig] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [n, c, cfg, cat] = await Promise.all([
        fetch('/api/nominations').then(r => r.json()),
        fetch('/api/codes').then(r => r.json()),
        fetch('/api/config').then(r => r.json()),
        fetch('/api/catalog').then(r => r.json()),
      ]);
      setNoms(n.nominations || []); setCodes(c.codes || []); setConfig(cfg.config);
      setSections(cat.sections || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading />;
  const price = config?.price_ghs ?? 10;
  const used = codes.filter(c => c.status === 'used').length;
  const unused = codes.filter(c => c.status === 'unused').length;
  const revenue = used * price;
  const bySection = {}; sections.forEach(s => bySection[s.key] = 0);
  noms.forEach(n => { bySection[n.section_key] = (bySection[n.section_key] || 0) + 1; });
  const paidNoms = noms.filter(n => (n.track || 'paid') === 'paid').length;
  const freeNoms = noms.filter(n => n.track === 'free').length;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi"><div className="n">{noms.length}</div><div className="l">Total Nominations</div></div>
        <div className="kpi"><div className="n">{paidNoms}</div><div className="l">Paid Track</div></div>
        <div className="kpi"><div className="n">{freeNoms}</div><div className="l">Free Track</div></div>
        <div className="kpi"><div className="n">{codes.length}</div><div className="l">Codes Issued</div></div>
        <div className="kpi"><div className="n">{unused}</div><div className="l">Unused / Unsold</div></div>
        <div className="kpi"><div className="n">GH₵{revenue}</div><div className="l">Confirmed Revenue (used codes)</div></div>
      </div>
      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Nominations by group</h3>
        {sections.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 170, fontSize: 13, fontWeight: 600 }}>{s.emoji} {s.label}</div>
            <div style={{ flex: 1, background: 'var(--parchment-2)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
              <div style={{ width: `${noms.length ? (bySection[s.key] / Math.max(1, noms.length) * 100) : 0}%`, background: s.color, height: '100%' }} />
            </div>
            <div style={{ width: 30, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>{bySection[s.key] || 0}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: 14 }}>
        Photos are stored in Vercel Blob and records in Postgres — no artificial storage ceiling like a Claude artifact.
        Keep an eye on your Neon and Blob usage dashboards as the event grows.
      </p>
    </div>
  );
}

function Loading() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}><span className="loading-spin" /> Loading…</div>;
}

function CodesTab({ role }) {
  const [codes, setCodes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState('1');
  const [genResult, setGenResult] = useState([]);
  const [filter, setFilter] = useState('');

  async function load() {
    setLoading(true);
    const [c, a] = await Promise.all([
      fetch('/api/codes').then(r => r.json()),
      role === 'main-admin' ? fetch('/api/agents').then(r => r.json()) : Promise.resolve({ agents: [] }),
    ]);
    setCodes(c.codes || []); setAgents(a.agents || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    const n = Math.max(1, Math.min(50, parseInt(count) || 1));
    const res = await fetch('/api/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: n }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to generate codes'); return; }
    setGenResult(data.codes);
    toast(`${n} code${n > 1 ? 's' : ''} generated`);
    load();
  }

  async function voidCode(code) {
    if (!confirm(`Void code ${code}? It will no longer be usable.`)) return;
    const res = await fetch(`/api/codes/${encodeURIComponent(code)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not void code'); return; }
    toast(`Code ${code} voided`);
    load();
  }

  if (loading) return <Loading />;
  let list = codes;
  if (filter === 'main-admin') list = list.filter(c => c.issued_by_type !== 'agent');
  else if (filter) list = list.filter(c => c.issued_by_type === 'agent' && c.issued_by_id === filter);

  return (
    <div>
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Generate codes after confirming payment</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Only generate a code once you've physically received payment — cash or MoMo.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 120 }}><label>How many?</label><input type="text" className="mono" value={count} onChange={e => setCount(e.target.value)} /></div>
          <button className="btn btn-gold" onClick={generate}>I've been paid — generate →</button>
        </div>
        <div className="tag-row">{genResult.map(c => <span key={c} className="code-chip">{c} <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(c); toast('Copied ' + c); }}>Copy</button></span>)}</div>
      </div>
      {role === 'main-admin' && (
        <div className="tag-row" style={{ marginBottom: 14 }}>
          <button className={`filter-chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>All issuers</button>
          <button className={`filter-chip ${filter === 'main-admin' ? 'active' : ''}`} onClick={() => setFilter('main-admin')}>Main Admin only</button>
          {agents.map(a => <button key={a.id} className={`filter-chip ${filter === a.id ? 'active' : ''}`} onClick={() => setFilter(a.id)}>{a.name}</button>)}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th>{role === 'main-admin' && <th>Issued by</th>}<th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No codes found.</td></tr> :
              list.map(c => (
                <tr key={c.code}>
                  <td className="mono" style={{ fontWeight: 700 }}>{c.code}</td>
                  {role === 'main-admin' && <td>{c.issued_by_type === 'agent' ? <span className="badge badge-agent">{c.issued_by_name}</span> : 'Main Admin'}</td>}
                  <td><Badge status={c.status} /></td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</td>
                  <td>{c.status !== 'used' && c.status !== 'void' && <button className="small-btn danger" onClick={() => voidCode(c.code)}>Void</button>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NominationsTab() {
  const [noms, setNoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState('section');
  const [trackFilter, setTrackFilter] = useState('');
  const [viewing, setViewing] = useState(null);

  useEffect(() => { fetch('/api/nominations').then(r => r.json()).then(d => { setNoms(d.nominations || []); setLoading(false); }); }, []);

  async function deleteNomination(id, name) {
    if (!confirm(`Permanently delete the nomination for "${name}"? This also deletes their photo. This cannot be undone.`)) return;
    const res = await fetch(`/api/nominations/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to delete'); return; }
    toast('Nomination deleted');
    setNoms(prev => prev.filter(n => n.id !== id));
    setViewing(null);
  }

  if (loading) return <Loading />;

  // Groups come from the nominations themselves, so a group the admin adds
  // later shows up here without any code change.
  const groups = [];
  noms.forEach(n => { if (!groups.some(g => g.key === n.section_key)) groups.push({ key: n.section_key, label: n.section_label || n.section_key, track: n.track || 'paid' }); });
  groups.sort((a, b) => (a.track + a.label).localeCompare(b.track + b.label));

  let list = [...noms];
  if (trackFilter) list = list.filter(n => (n.track || 'paid') === trackFilter);
  if (sectionFilter) list = list.filter(n => n.section_key === sectionFilter);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(n => (n.nominee_name || '').toLowerCase().includes(q) || (n.category || '').toLowerCase().includes(q) || (n.nominator_name || '').toLowerCase().includes(q));
  }
  if (sortBy === 'section') list.sort((a, b) => (a.section_label + a.category).localeCompare(b.section_label + b.category));
  else if (sortBy === 'name') list.sort((a, b) => (a.nominee_name || '').localeCompare(b.nominee_name || ''));
  else if (sortBy === 'recent') list.sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input type="text" placeholder="Search nominee, category, nominator…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', border: '1.5px solid var(--parchment-2)', borderRadius: 10, fontSize: '13.5px' }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '10px 12px', border: '1.5px solid var(--parchment-2)', borderRadius: 10, fontSize: 13 }}>
          <option value="section">Sort: Category</option>
          <option value="name">Sort: Nominee name</option>
          <option value="recent">Sort: Most recent</option>
        </select>
      </div>
      <div className="tag-row" style={{ marginBottom: 10 }}>
        <button className={`filter-chip ${trackFilter === '' ? 'active' : ''}`} onClick={() => setTrackFilter('')}>All tracks ({noms.length})</button>
        <button className={`filter-chip ${trackFilter === 'paid' ? 'active' : ''}`} onClick={() => setTrackFilter('paid')}>💰 Paid ({noms.filter(n => (n.track || 'paid') === 'paid').length})</button>
        <button className={`filter-chip ${trackFilter === 'free' ? 'active' : ''}`} onClick={() => setTrackFilter('free')}>🎁 Free ({noms.filter(n => n.track === 'free').length})</button>
      </div>
      <div className="tag-row" style={{ marginBottom: 16 }}>
        <button className={`filter-chip ${sectionFilter === '' ? 'active' : ''}`} onClick={() => setSectionFilter('')}>All groups</button>
        {groups.map(g => <button key={g.key} className={`filter-chip ${sectionFilter === g.key ? 'active' : ''}`} onClick={() => setSectionFilter(g.key)}>{g.label} ({noms.filter(n => n.section_key === g.key).length})</button>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Photo</th><th>Nominee</th><th>Category</th><th>Group</th><th>Track</th><th>Nominator</th><th>Submitted</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No nominations found.</td></tr> :
              list.map(n => (
                <tr key={n.id}>
                  <td>{n.photo_url ? <img className="thumb" src={n.photo_url} alt="" /> : <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>—</span>}</td>
                  <td><strong>{n.nominee_name}</strong>{n.nominee_class && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{n.nominee_class}</div>}</td>
                  <td>{n.category}</td>
                  <td>{n.section_label}</td>
                  <td><span className={`badge ${n.track === 'free' ? 'badge-unused' : 'badge-used'}`}>{n.track === 'free' ? 'free' : 'paid'}</span></td>
                  <td>{n.nominator_name}<div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{n.nominator_phone}</div></td>
                  <td>{n.submitted_at ? new Date(n.submitted_at).toLocaleDateString() : ''}</td>
                  <td><button className="small-btn" onClick={() => setViewing(n)}>View</button>{' '}<button className="small-btn danger" onClick={() => deleteNomination(n.id, n.nominee_name)}>Delete</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {viewing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewing(null)}>
          <div className="panel panel-pad modal-box">
            {viewing.photo_url && <img src={viewing.photo_url} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 14 }} />}
            <h3 style={{ margin: '0 0 4px' }}>{viewing.nominee_name}</h3>
            <div style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 10 }}>{viewing.category} · {viewing.section_label}</div>
            {viewing.nominee_class && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Class:</strong> {viewing.nominee_class}</div>}
            {viewing.nominee_house && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>House/Dept:</strong> {viewing.nominee_house}</div>}
            <div style={{ fontSize: 13, margin: '10px 0', lineHeight: 1.6 }}><strong>Why:</strong> {viewing.reason}</div>
            <div className="divider-label">nominator</div>
            <div style={{ fontSize: 13 }}>{viewing.nominator_name} · {viewing.nominator_phone} · {viewing.relation}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 10 }}>{viewing.track === 'free' ? 'Free nomination' : `Code ${viewing.code}`} · Submitted {new Date(viewing.submitted_at).toLocaleString()}</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn btn-outline-dark" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setViewing(null)}>Close</button>
              <button className="btn btn-burgundy" style={{ flex: 1, justifyContent: 'center', color: '#fff' }} onClick={() => deleteNomination(viewing.id, viewing.nominee_name)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  async function exportExcel() {
    const res = await fetch('/api/nominations');
    const data = await res.json();
    const noms = (data.nominations || []).sort((a, b) => (a.section_label + a.category + a.nominee_name).localeCompare(b.section_label + b.category + b.nominee_name));
    if (noms.length === 0) { toast('No nominations to export yet'); return; }
    const wb = XLSX.utils.book_new();
    const allRows = noms.map(n => ({
      'Group': n.section_label, 'Category': n.category, 'Nominee': n.nominee_name, 'Class/Form': n.nominee_class || '', 'House/Dept': n.nominee_house || '',
      'Track': n.track === 'free' ? 'Free' : 'Paid',
      'Why nominated': n.reason || '', 'Nominator': n.nominator_name, 'Nominator Phone': n.nominator_phone, 'Relationship': n.relation || n.nominator_role || '',
      'Access Code': n.code || '', 'Submitted At': n.submitted_at ? new Date(n.submitted_at).toLocaleString() : '', 'Photo URL': n.photo_url || '', 'Tracking ID': n.id,
    }));
    const wsAll = XLSX.utils.json_to_sheet(allRows);
    wsAll['!cols'] = [{ wch: 22 }, { wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 40 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsAll, 'All Nominations');
    const groups = [];
    noms.forEach(n => { if (!groups.some(g => g.key === n.section_key)) groups.push({ key: n.section_key, label: n.section_label || n.section_key }); });
    groups.forEach(s => {
      const rows = noms.filter(n => n.section_key === s.key).map(n => ({
        'Category': n.category, 'Nominee': n.nominee_name, 'Class/Form': n.nominee_class || '', 'House/Dept': n.nominee_house || '',
        'Why nominated': n.reason || '', 'Nominator': n.nominator_name, 'Nominator Phone': n.nominator_phone, 'Track': n.track === 'free' ? 'Free' : 'Paid', 'Submitted At': n.submitted_at ? new Date(n.submitted_at).toLocaleString() : '',
      }));
      if (rows.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 8 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, String(s.label).replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
    });
    const summary = groups.map(s => ({
      'Group': s.label,
      'Nominations Received': noms.filter(n => n.section_key === s.key).length,
      'Paid': noms.filter(n => n.section_key === s.key && (n.track || 'paid') === 'paid').length,
      'Free': noms.filter(n => n.section_key === s.key && n.track === 'free').length,
    }));
    const wsSum = XLSX.utils.json_to_sheet(summary);
    wsSum['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsSum, 'Summary');
    XLSX.writeFile(wb, 'Oguaa_Royal_Awards_Nominations.xlsx');
    toast('Excel file downloaded');
  }

  async function exportPhotosZip() {
    const res = await fetch('/api/nominations');
    const data = await res.json();
    const noms = (data.nominations || []).filter(n => n.photo_url);
    if (noms.length === 0) { toast('No photos to export yet'); return; }
    toast('Building ZIP… this may take a moment');
    const zip = new JSZip();
    await Promise.all(noms.map(async n => {
      try {
        const r = await fetch(n.photo_url);
        const blob = await r.blob();
        const folder = zip.folder(sanitizeFile(n.section_label));
        folder.file(`${sanitizeFile(n.category)}__${sanitizeFile(n.nominee_name)}.jpg`, blob);
      } catch (e) { /* skip failed fetches */ }
    }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Oguaa_Royal_Awards_Photos.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Photos ZIP downloaded');
  }

  return (
    <div className="two-col">
      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Export nomination list</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px' }}>Excel workbook — one sheet per recipient group plus a full sorted list, ready to share with judges.</p>
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={exportExcel}>⬇ Download Excel (.xlsx)</button>
      </div>
      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Export nominee photos</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px' }}>A ZIP of every photo, organized in folders by category — ready to drop into flyer templates.</p>
        <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={exportPhotosZip}>⬇ Download photos (.zip)</button>
      </div>
    </div>
  );
}

function AgentsTab() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [created, setCreated] = useState(null);

  async function load() { setLoading(true); const d = await fetch('/api/agents').then(r => r.json()); setAgents(d.agents || []); setLoading(false); }
  useEffect(() => { load(); }, []);

  async function createAgent() {
    if (!newName.trim()) { toast('Enter a name for this agent'); return; }
    const res = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not create agent'); return; }
    setCreated(data); setNewName(''); toast(`Agent ${data.name} created`); load();
  }
  async function resetPin(id, name) {
    if (!confirm(`Reset PIN for ${name}? Their old PIN will stop working immediately.`)) return;
    const res = await fetch(`/api/agents/${id}/reset-pin`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed'); return; }
    alert(`New PIN for ${name} (${id}): ${data.pin}\n\nShare this securely — it will not be shown again.`);
    toast(`PIN reset for ${name}`); load();
  }
  async function toggleAgent(id, active) {
    const res = await fetch(`/api/agents/${id}/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
    if (!res.ok) { toast('Failed'); return; }
    toast(active ? 'Agent reactivated' : 'Agent deactivated'); load();
  }
  async function renameAgent(id, oldName) {
    const newName = prompt('New name for this agent:', oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const res = await fetch(`/api/agents/${id}/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed to rename'); return; }
    toast('Agent renamed'); load();
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="panel panel-pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Create a sales agent / distribution point</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Each agent gets their own Agent ID and PIN, kept separate from the main admin PIN. Every code they generate is tagged with their name in the audit trail.</p>
        <div className="two-col">
          <div className="field" style={{ marginBottom: 0 }}><label>Agent / sales point name</label><input type="text" placeholder="e.g. Miss Adjei — Front Office" value={newName} onChange={e => setNewName(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={createAgent}>Create agent →</button></div>
        </div>
        {created && (
          <div className="banner banner-good" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginTop: 14 }}>
            <div>Agent created. Share these credentials with <strong>{created.name}</strong> now — the PIN won't be shown again:</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="code-chip">{created.id}</span>
              <span className="code-chip">{created.pin}</span>
            </div>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Agent</th><th>ID</th><th>Status</th><th>Codes sold / used</th><th>Last login</th><th>Actions</th></tr></thead>
          <tbody>
            {agents.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No agents yet — create one above.</td></tr> :
              agents.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td className="mono">{a.id}</td>
                  <td>{a.active ? <span className="badge badge-used">Active</span> : <span className="badge badge-inactive">Inactive</span>}</td>
                  <td>{a.total_codes} / {a.used_codes}</td>
                  <td>{a.last_login_at ? new Date(a.last_login_at).toLocaleString() : 'Never'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="small-btn" onClick={() => renameAgent(a.id, a.name)}>Rename</button>{' '}
                    <button className="small-btn" onClick={() => resetPin(a.id, a.name)}>Reset PIN</button>{' '}
                    {a.active
                      ? <button className="small-btn danger" onClick={() => toggleAgent(a.id, false)}>Deactivate</button>
                      : <button className="small-btn good" onClick={() => toggleAgent(a.id, true)}>Reactivate</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="security-note" style={{ marginTop: 16 }}>
        🔒 PINs are hashed with bcrypt on the server before they're ever stored — nobody, including you later, can read a PIN back out. When you create an agent or reset a PIN, the plaintext PIN is shown to you <strong>once</strong> — write it down immediately and hand it to the agent securely.
      </div>
    </div>
  );
}

function AuditTab() {
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/audit').then(r => r.json()).then(d => { setAudit(d.audit || []); setLoading(false); }); }, []);
  if (loading) return <Loading />;
  return (
    <div>
      <div className="banner banner-gold" style={{ marginBottom: 16 }}>📜 Log of every code, agent and settings action — most recent first. Nothing here can be edited or deleted from the UI.</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {audit.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 24 }}>No activity recorded yet.</td></tr> :
              audit.map(a => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.ts).toLocaleString()}</td>
                  <td>{actorLabel(a)}</td>
                  <td>{ACTION_LABELS[a.action] || a.action}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{JSON.stringify(a.details || {}).replace(/[{}"]/g, '').replace(/,/g, ', ')}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [curPin, setCurPin] = useState(''); const [newPin1, setNewPin1] = useState(''); const [newPin2, setNewPin2] = useState('');
  const [pinMsg, setPinMsg] = useState(null);

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(d => { setConfig(d.config || {}); setLoading(false); }); }, []);
  if (loading) return <Loading />;

  async function save() {
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      eventName: config.event_name, priceGHS: parseFloat(config.price_ghs) || 10,
      openDate: config.open_date || null, closeDate: config.close_date || null,
      momoName: config.momo_name, momoNumber: config.momo_number, momoNetwork: config.momo_network,
    }) });
    if (!res.ok) { setMsg({ ok: false, text: 'Failed to save.' }); return; }
    setMsg({ ok: true, text: 'Settings saved.' }); toast('Settings saved');
  }
  async function changePin() {
    if (newPin1.length < 6) { setPinMsg({ ok: false, text: 'New PIN must be at least 6 characters.' }); return; }
    if (newPin1 !== newPin2) { setPinMsg({ ok: false, text: "New PINs don't match." }); return; }
    const res = await fetch('/api/auth/change-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPin: curPin, newPin: newPin1 }) });
    const data = await res.json();
    if (!res.ok) { setPinMsg({ ok: false, text: data.error || 'Failed.' }); return; }
    setPinMsg({ ok: true, text: 'PIN changed.' }); toast('Main admin PIN changed'); setCurPin(''); setNewPin1(''); setNewPin2('');
  }

  return (
    <div>
      <div className="panel panel-pad" style={{ maxWidth: 560, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>Event settings</h3>
        <div className="two-col">
          <div className="field"><label>Nominations open on</label><input type="text" placeholder="YYYY-MM-DD" value={config.open_date || ''} onChange={e => setConfig({ ...config, open_date: e.target.value })} /></div>
          <div className="field"><label>Nominations close on</label><input type="text" placeholder="YYYY-MM-DD" value={config.close_date || ''} onChange={e => setConfig({ ...config, close_date: e.target.value })} /></div>
        </div>
        <div className="field"><label>Price per nomination (GH₵)</label><input type="text" value={config.price_ghs || ''} onChange={e => setConfig({ ...config, price_ghs: e.target.value })} /></div>
        <div className="divider-label">MoMo details (shown to nominators as info only)</div>
        <div className="field"><label>Network</label><input type="text" value={config.momo_network || ''} onChange={e => setConfig({ ...config, momo_network: e.target.value })} /></div>
        <div className="field"><label>MoMo number</label><input type="text" value={config.momo_number || ''} onChange={e => setConfig({ ...config, momo_number: e.target.value })} /></div>
        <div className="field"><label>Registered name</label><input type="text" value={config.momo_name || ''} onChange={e => setConfig({ ...config, momo_name: e.target.value })} /></div>
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>Save settings</button>
        {msg && <div className={`banner ${msg.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 12 }}>{msg.text}</div>}
      </div>
      <ExtraSettings />
      <div className="panel panel-pad" style={{ maxWidth: 560 }}>
        <h3 style={{ marginTop: 0 }}>Change main admin PIN</h3>
        <div className="field"><label>Current PIN</label><input type="password" className="mono" value={curPin} onChange={e => setCurPin(e.target.value)} /></div>
        <div className="two-col">
          <div className="field"><label>New PIN (min. 6 chars)</label><input type="password" className="mono" value={newPin1} onChange={e => setNewPin1(e.target.value)} /></div>
          <div className="field"><label>Confirm new PIN</label><input type="password" className="mono" value={newPin2} onChange={e => setNewPin2(e.target.value)} /></div>
        </div>
        <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={changePin}>Change PIN</button>
        {pinMsg && <div className={`banner ${pinMsg.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 12 }}>{pinMsg.text}</div>}
      </div>
      <div className="security-note" style={{ maxWidth: 560, marginTop: 20 }}>
        🔒 PINs are hashed with bcrypt server-side, sessions are signed httpOnly cookies verified on every request, and role checks happen on the server — not just in the browser. Still: rotate PINs if you ever suspect one has leaked, and keep your <code>DATABASE_URL</code> and <code>SESSION_SECRET</code> only in Vercel's environment variables, never in the repo.
      </div>
    </div>
  );
}

/* ========================== AGENT DASHBOARD ========================== */
function AgentDashboard({ session, onLogout }) {
  const [tab, setTab] = useState('sell');
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); onLogout(); }

  return (
    <section className="block">
      <div className="wrap">
        <div className="section-head">
          <div><span className="section-tag">Sales Agent · {session.name}</span><h2>Sell access codes</h2></div>
          <button className="btn btn-outline-dark" onClick={logout}>Log out</button>
        </div>
        <div className="admin-tabs">
          {[['sell', 'Sell Codes'], ['mycodes', 'My Codes'], ['pin', 'Change My PIN']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'sell' && <AgentSellTab />}
        {tab === 'mycodes' && <CodesTab role="agent" />}
        {tab === 'pin' && <AgentPinTab />}
      </div>
    </section>
  );
}

function AgentSellTab() {
  const [codes, setCodes] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState('1');
  const [genResult, setGenResult] = useState([]);

  async function load() {
    setLoading(true);
    const [c, cfg] = await Promise.all([fetch('/api/codes').then(r => r.json()), fetch('/api/config').then(r => r.json())]);
    setCodes(c.codes || []); setConfig(cfg.config); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    const n = Math.max(1, Math.min(50, parseInt(count) || 1));
    const res = await fetch('/api/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: n }) });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Failed'); return; }
    setGenResult(data.codes); toast(`${n} code${n > 1 ? 's' : ''} generated`); load();
  }

  if (loading) return <Loading />;
  const used = codes.filter(c => c.status === 'used').length;
  const price = config?.price_ghs ?? 10;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi"><div className="n">{codes.length}</div><div className="l">Codes You've Generated</div></div>
        <div className="kpi"><div className="n">{used}</div><div className="l">Used (redeemed)</div></div>
        <div className="kpi"><div className="n">GH₵{used * price}</div><div className="l">Revenue Collected</div></div>
      </div>
      <div className="panel panel-pad">
        <h3 style={{ marginTop: 0 }}>Generate a code — only after payment is in hand</h3>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Collect GH₵{price} in cash or via MoMo first. Then generate the code and give it to the buyer. Every code you make is logged under your name.</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginBottom: 0, maxWidth: 120 }}><label>How many?</label><input type="text" className="mono" value={count} onChange={e => setCount(e.target.value)} /></div>
          <button className="btn btn-gold" onClick={generate}>I've been paid — generate →</button>
        </div>
        <div className="tag-row">{genResult.map(c => <span key={c} className="code-chip">{c} <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(c); toast('Copied ' + c); }}>Copy</button></span>)}</div>
      </div>
    </div>
  );
}

function AgentPinTab() {
  const [curPin, setCurPin] = useState(''); const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [msg, setMsg] = useState(null);
  async function submit() {
    if (p1.length < 6) { setMsg({ ok: false, text: 'New PIN must be at least 6 characters.' }); return; }
    if (p1 !== p2) { setMsg({ ok: false, text: "New PINs don't match." }); return; }
    const res = await fetch('/api/auth/change-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPin: curPin, newPin: p1 }) });
    const data = await res.json();
    if (!res.ok) { setMsg({ ok: false, text: data.error || 'Failed.' }); return; }
    setMsg({ ok: true, text: 'PIN changed.' }); toast('PIN changed'); setCurPin(''); setP1(''); setP2('');
  }
  return (
    <div className="panel panel-pad" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Change my PIN</h3>
      <div className="field"><label>Current PIN</label><input type="password" className="mono" value={curPin} onChange={e => setCurPin(e.target.value)} /></div>
      <div className="two-col">
        <div className="field"><label>New PIN (min. 6 chars)</label><input type="password" className="mono" value={p1} onChange={e => setP1(e.target.value)} /></div>
        <div className="field"><label>Confirm new PIN</label><input type="password" className="mono" value={p2} onChange={e => setP2(e.target.value)} /></div>
      </div>
      <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Change PIN</button>
      {msg && <div className={`banner ${msg.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 12 }}>{msg.text}</div>}
    </div>
  );
}
