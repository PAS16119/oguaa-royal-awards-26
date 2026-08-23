'use client';
import { usePathname, useRouter } from 'next/navigation';

export function Crest() {
  return (
    <svg className="crest" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 38, height: 38, flex: 'none' }}>
      <circle cx="20" cy="20" r="19" stroke="url(#g1)" strokeWidth="1.6" />
      <path d="M20 8 L23 16 L31 16 L24.5 21 L27 29 L20 24.2 L13 29 L15.5 21 L9 16 L17 16 Z" fill="url(#g1)" />
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#F1D98B" />
          <stop offset="1" stopColor="#9C7A1E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Seal({ id = 'seal', caption }) {
  const gid = 'sg' + id;
  return (
    <div className="seal-wrap">
      <svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" style={{ width: 120, height: 120, flex: 'none' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="140" y2="140">
            <stop stopColor="#F1D98B" />
            <stop offset="0.5" stopColor="#D4AF37" />
            <stop offset="1" stopColor="#8A6B18" />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="66" fill="none" stroke={`url(#${gid})`} strokeWidth="2.5" />
        <circle cx="70" cy="70" r="57" fill="none" stroke={`url(#${gid})`} strokeWidth="1" />
        <path id={`tp${gid}`} d="M 20 70 A 50 50 0 1 1 120 70" fill="none" />
        <text fontFamily="Playfair Display, serif" fontSize="10.5" letterSpacing="2.5" fill="#D4AF37">
          <textPath href={`#tp${gid}`} startOffset="2">OGUAA ROYAL AWARDS</textPath>
        </text>
        <path d="M70 46 L76 60 L91 60 L79 69 L84 84 L70 75 L56 84 L61 69 L49 60 L64 60 Z" fill={`url(#${gid})`} />
        <text x="70" y="104" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="8" letterSpacing="2" fill="#D4AF37">EST. ANNIVERSARY ED.</text>
      </svg>
      {caption && <div className="seal-caption">{caption}</div>}
    </div>
  );
}

const NAV_TABS = [
  ['/', 'Home'],
  ['/access', 'Get Access'],
  ['/nominate', 'Nominate'],
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
              {label.replace('Get ', '')}
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
