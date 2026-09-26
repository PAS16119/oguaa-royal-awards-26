'use client';
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
