'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast } from './components';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function HomePage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [count, setCount] = useState(null);
  const [sections, setSections] = useState([]);

  useEffect(() => {
    fetch('/api/public/summary').then(r => r.json()).then(d => {
      setConfig(d.config);
      setCount(d.nominationCount);
    }).catch(() => {});
    fetch('/api/catalog').then(r => r.json()).then(d => setSections(d.sections || [])).catch(() => {});
  }, []);

  const price = config?.price_ghs ?? 10;
  const paidSections = sections.filter(s => s.track === 'paid');
  const freeSections = sections.filter(s => s.track === 'free');
  const PAID_AWARDS = paidSections.reduce((n, s) => n + s.awards.filter(a => a.nominable).length, 0);
  const FREE_AWARDS = freeSections.reduce((n, s) => n + s.awards.filter(a => a.nominable).length, 0);
  const TOTAL_AWARDS = PAID_AWARDS + FREE_AWARDS;
  const freeOpen = config ? config.free_enabled !== false : true;

  let statusBanner = null;
  if (config?.open_date || config?.close_date) {
    const now = new Date();
    const open = config.open_date ? new Date(config.open_date) : null;
    const close = config.close_date ? new Date(config.close_date + 'T23:59:59') : null;
    if (open && now < open) {
      statusBanner = <div className="banner banner-gold" style={{ marginTop: 26, maxWidth: 600 }}>⏳ Nominations open <strong>&nbsp;{fmtDate(config.open_date)}</strong>. Pay early and get your access code ready.</div>;
    } else if (close && now > close) {
      statusBanner = <div className="banner banner-bad" style={{ marginTop: 26, maxWidth: 600 }}>Nominations have closed. Thank you to everyone who took part!</div>;
    } else if (close) {
      const days = Math.ceil((close - now) / 86400000);
      statusBanner = <div className="banner banner-good" style={{ marginTop: 26, maxWidth: 600 }}>🕐 <strong>{days} day{days === 1 ? '' : 's'}</strong> left to nominate — closes {fmtDate(config.close_date)}.</div>;
    }
  }

  return (
    <Shell>
      <div className="hero">
        <div className="hero-inner">
          <span className="eyebrow">✦ Anniversary Edition · {TOTAL_AWARDS} Royal Titles</span>
          <h1>Nominate someone for a <em>royal</em> title this anniversary.</h1>
          <p className="lede">
            Two ways to take part. The <strong>Royal Awards</strong> ({PAID_AWARDS} popular titles) need an access code at GH₵{price} each.
            The <strong>Anniversary Merit Awards</strong> ({FREE_AWARDS} titles) are nominated completely free.
          </p>
          <div className="hero-cta">
            {config?.online_sales_enabled
              ? <button className="btn btn-gold" onClick={() => router.push('/buy')}>Buy an access code →</button>
              : <button className="btn btn-gold" onClick={() => router.push('/access')}>How to get an access code →</button>}
            {freeOpen && <button className="btn btn-ghost" onClick={() => router.push('/nominate-free')}>Nominate free →</button>}
            <button className="btn btn-ghost" onClick={() => router.push('/nominate')}>I already have a code</button>
          </div>
          {statusBanner}
          <div className="stat-strip">
            <div className="stat"><div className="n">{TOTAL_AWARDS}</div><div className="l">Award Categories</div></div>
            <div className="stat"><div className="n">{sections.length}</div><div className="l">Recipient Groups</div></div>
            <div className="stat"><div className="n">GH₵{price}</div><div className="l">Per Nomination</div></div>
            <div className="stat"><div className="n">{count === null ? '—' : count}</div><div className="l">Nominations So Far</div></div>
          </div>
        </div>
      </div>
      <div className="kente" />
      <section className="block">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="section-tag">The Titles</span>
              <h2>Browse every category</h2>
              <div className="sub">Grouped by recipient type, exactly as they'll appear on the nomination form. Paid groups need a code; free groups do not.</div>
            </div>
          </div>
          <div className="cat-grid">
            {sections.map(s => (
              <div className="cat-card" key={s.key}>
                <div className="icon">{s.emoji}</div>
                <h3>{s.label}</h3>
                <div className="cnt">{s.awards.length} awards · {s.track === 'free' ? 'free' : `GH₵${price}`}</div>
                <div className="bar" style={{ background: s.color }} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="kente" />
      <section className="block">
        <div className="wrap">
          <div className="panel panel-pad" style={{ display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 2, minWidth: 260 }}>
              <span className="section-tag">How it works</span>
              <h2 style={{ margin: '6px 0 16px' }}>Three simple steps</h2>
              <ol style={{ paddingLeft: 18, color: 'var(--ink-soft)', lineHeight: 1.9, fontSize: '14.5px' }}>
                <li><strong style={{ color: 'var(--ink)' }}>Royal Awards — pay GH₵{price}</strong>{config?.online_sales_enabled ? ' online with MoMo or card, or in person to a committee member or sales agent.' : ' in person — cash or MoMo — to a committee member or registered sales agent.'}</li>
                <li><strong style={{ color: 'var(--ink)' }}>You get an access code</strong> — one code, one nomination. Enter it on the nomination form.</li>
                <li><strong style={{ color: 'var(--ink)' }}>Merit Awards — nominate free.</strong> No code, no payment. Just your name and number, so each person votes once per award.</li>
              </ol>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-dark" onClick={() => router.push('/access')}>Paid awards →</button>
                <button className="btn btn-outline-dark" onClick={() => router.push('/nominate-free')}>Free awards →</button>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <Seal id="home" caption="Every access code is uniquely sealed" />
            </div>
          </div>
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
