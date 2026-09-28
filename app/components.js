'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Shared client-side compression: shrink to maxDim on the long edge and
// re-encode as JPEG, so photos from any phone camera stay well under the
// 3MB ceiling in app/api/upload/route.js. Used anywhere a person picks a
// photo — nomination forms, the admin ballot, and the self-service photo page.
export function compressImageFile(file, { maxDim = 900, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file selected.')); return; }
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Please choose an image file.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadPhotoDataUrl(dataUrl) {
  const res = await fetch('/api/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data.url;
}

export function Crest() {
  return (
    <img
      src="/logo-mark.png"
      alt="Oguaa Royal Awards"
      className="crest"
      style={{ width: 38, height: 38, flex: 'none', objectFit: 'contain' }}
    />
  );
}

export function Seal({ id = 'seal', caption }) {
  return (
    <div className="seal-wrap">
      <img
        src="/logo-mark.png"
        alt="Oguaa Royal Awards"
        style={{ width: 120, height: 120, flex: 'none', objectFit: 'contain' }}
      />
      {caption && <div className="seal-caption">{caption}</div>}
    </div>
  );
}

const NAV_TABS = [
  ['/', 'Home'],
  ['/access', 'Get Access'],
  ['/nominate', 'Nominate'],
  ['/nominate-free', 'Free Awards'],
  ['/vote', 'Vote'],
];

export function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div id="app">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--parchment)' }}>
            <Crest />
            <div className="brand-text">
              <span className="k1">Oguaa Royal Awards</span>
              <span className="k2">OSTECH 35th Anniversary</span>
            </div>
          </div>
          <div className="nav">
            {NAV_TABS.map(([href, label]) => (
              <button key={href} className={pathname === href ? 'active' : ''} onClick={() => router.push(href)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main>{children}</main>
      <footer>
        <div className="wrap">
          <div>© {new Date().getFullYear()} Oguaa Royal Awards · OSTECH 35th Anniversary Committee</div>
          <a className="admin-link" href="/admin">Committee &amp; agent access →</a>
        </div>
      </footer>
      <div className="mobile-nav">
        <div className="row">
          {NAV_TABS.map(([href, label]) => (
            <button key={href} className={pathname === href ? 'active' : ''} onClick={() => router.push(href)}>
              {label.replace('Get ', '').replace('Free Awards', 'Free')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function Toast() {
  return <div className="toast" id="toast" />;
}

export function esc(s) {
  return s == null ? '' : String(s);
}

// ---------------------------------------------------------------------------
// Candidate search — shared by the vote page, the leaderboard and the admin
// ballot. Typing narrows the list as you go; matching ignores case, accents
// and punctuation, matches any word in a name ("kofi" finds "Kwame Kofi
// Mensah"), also looks at class, house, ballot code and award, and forgives
// a small typo ("mensha" still finds "Mensah").
// ---------------------------------------------------------------------------
function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function editDistance(a, b) {
  // Optimal string alignment: a swapped pair of letters ("mensha" for "mensah") counts as one slip.
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d = [];
  for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

function scoreCandidate(c, tokens, rawQuery) {
  const name = normText(c.nominee_name);
  const words = name.split(' ');
  const other = normText([c.nominee_class, c.nominee_house, c.award_name || c.category, c.section_label].join(' '));
  const code = normText(c.ballot_code);
  if (code && code === normText(rawQuery)) return 100;

  let total = 0;
  for (const t of tokens) {
    let best = 0;
    if (words[0] && words[0].startsWith(t)) best = 5;
    else if (words.some(w => w.startsWith(t))) best = 4;
    else if (name.includes(t)) best = 3;
    else if (code && code.startsWith(t)) best = 3;
    else if (other.includes(t)) best = 1;
    else if (t.length >= 3) {
      const tol = t.length >= 7 ? 2 : 1;
      const close = words.some(w => editDistance(t, w) <= tol || editDistance(t, w.slice(0, t.length)) <= tol);
      if (close) best = 2;
    }
    if (best === 0) return 0; // every typed word has to match something
    total += best;
  }
  return total;
}

export function matchCandidates(list, query, limit) {
  const q = normText(query);
  if (!q) return list;
  const tokens = q.split(' ');
  const scored = [];
  for (const c of list || []) {
    const s = scoreCandidate(c, tokens, query);
    if (s > 0) scored.push([s, c]);
  }
  scored.sort((a, b) => b[0] - a[0] || String(a[1].nominee_name).localeCompare(String(b[1].nominee_name)));
  const out = scored.map(x => x[1]);
  return limit ? out.slice(0, limit) : out;
}

function Highlight({ text, query }) {
  const tokens = normText(query).split(' ').filter(Boolean);
  const str = String(text == null ? '' : text);
  if (!tokens.length) return str;
  const lower = str.toLowerCase();
  const marks = new Array(str.length).fill(false);
  tokens.forEach(t => {
    let from = 0;
    while (t && (from = lower.indexOf(t, from)) !== -1) {
      for (let i = from; i < from + t.length; i++) marks[i] = true;
      from += t.length;
    }
  });
  const parts = [];
  let i = 0;
  while (i < str.length) {
    let j = i;
    while (j < str.length && marks[j] === marks[i]) j++;
    parts.push(marks[i] ? <strong key={i} style={{ background: 'rgba(201,162,39,.28)', borderRadius: 3 }}>{str.slice(i, j)}</strong> : str.slice(i, j));
    i = j;
  }
  return parts;
}

// Search box with a live suggestion list. onSelect(candidate) fires when the
// person taps a suggestion (or presses Enter on the highlighted one).
export function CandidateSearch({ candidates, onSelect, placeholder = 'Search a nominee by name…', showVotes = true }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    function away(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away); };
  }, []);

  const results = q.trim() ? matchCandidates(candidates || [], q, 8) : [];
  const showList = open && q.trim().length > 0;

  function pick(c) {
    setQ(''); setOpen(false); setHi(0);
    onSelect(c);
  }

  function onKeyDown(e) {
    if (!showList) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[hi]) pick(results[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', marginBottom: 20 }}>
      <div style={{ position: 'relative' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.55, pointerEvents: 'none' }}>🔍</span>
        <input
          type="search"
          value={q}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-label="Search nominees"
          onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 40px', fontSize: 15, border: '1.5px solid var(--parchment-2)', borderRadius: 12, background: '#fff' }}
        />
      </div>

      {showList && (
        <div role="listbox" style={{
          position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', zIndex: 30, background: '#fff',
          border: '1.5px solid var(--parchment-2)', borderRadius: 12, boxShadow: '0 12px 30px rgba(0,0,0,.14)',
          maxHeight: 360, overflowY: 'auto',
        }}>
          {results.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13.5, color: 'var(--ink-soft)' }}>
              No nominee found for “{q.trim()}”. Try just the first or last name.
            </div>
          ) : results.map((c, i) => (
            <button
              key={c.id}
              role="option"
              aria-selected={i === hi}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(c)}
              onMouseEnter={() => setHi(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: '10px 14px', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--parchment-2)' : 'none',
                background: i === hi ? 'rgba(201,162,39,.12)' : 'transparent', font: 'inherit', color: 'inherit',
              }}
            >
              {c.photo_url
                ? <img src={c.photo_url} alt="" width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', flex: 'none' }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--panel-2)', flex: 'none' }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}><Highlight text={c.nominee_name} query={q} /></div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.award_name}{c.nominee_class ? ` · ${c.nominee_class}` : ''}{c.nominee_house ? ` · ${c.nominee_house}` : ''}
                </div>
              </div>
              {showVotes && c.votes !== null && c.votes !== undefined && (
                <span style={{ fontSize: 11.5, color: 'var(--ink-soft)', flex: 'none' }}>{c.votes} vote{c.votes === 1 ? '' : 's'}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
