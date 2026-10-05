'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Shell } from '../../components';

// "The nominees are......." reveal slides, made for screen-recording the
// pre-result announcement video. One category at a time: an intro slide, then
// one BIG square photo slide per nominee. Shows names and photos only, never any
// votes, ranks or results.
//
//   /vote/reveal            pick a category, press Play (or use the arrow keys)
//   "Clean view"            hides every control so you can record just the square
//
// Like the poster, each slide is laid out once on a fixed 540 x 540 canvas and
// the whole canvas is scaled, so it is always a true square and never reflows.
const BASE = 540;
const GOLD = 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))';

function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function Slide({ intro, award, nominee, size }) {
  const scale = size / BASE;
  return (
    <div
      id="reveal-card"
      style={{
        position: 'relative', width: size, height: size, overflow: 'hidden',
        background: 'var(--royal-3)', color: '#fff', margin: '0 auto',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: BASE, height: BASE, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {intro ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 40px',
            background: 'radial-gradient(700px 380px at 15% -10%, rgba(212,175,55,0.28), transparent 60%),radial-gradient(600px 380px at 100% 0%, rgba(122,31,61,0.5), transparent 55%),linear-gradient(165deg, var(--royal-3), var(--royal) 55%, var(--royal-2))',
          }}>
            <img src="/logo-mark.png" alt="" style={{ height: 92, width: 'auto', marginBottom: 18 }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: 'var(--gold-light)', letterSpacing: 0.5, lineHeight: 1.1 }}>
              Oguaa Royal Awards 2026
            </div>
            <div style={{ width: 90, height: 3, background: GOLD, margin: '20px 0', borderRadius: 2 }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 700, lineHeight: 1.15, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
              {award}
            </div>
            <div style={{ marginTop: 26, fontSize: 28, fontStyle: 'italic', color: 'var(--gold-light)', letterSpacing: 1 }}>
              the nominees are.......
            </div>
          </div>
        ) : (
          <>
            {nominee.photo_url ? (
              <img
                src={nominee.photo_url} alt={nominee.nominee_name} crossOrigin="anonymous"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(165deg, var(--royal-3), var(--royal) 55%, var(--royal-2))',
                fontFamily: "'Playfair Display', serif", fontSize: 200, fontWeight: 700, color: 'var(--gold-light)',
              }}>{initials(nominee.nominee_name)}</div>
            )}
            {/* Top band: event and award, on a dark fade so it reads over any photo */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '22px 26px 54px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(23,18,51,0.92) 0%, rgba(23,18,51,0.6) 60%, rgba(23,18,51,0) 100%)' }}>
              <div style={{ fontSize: 15, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 800 }}>Oguaa Royal Awards 2026</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 25, fontWeight: 700, marginTop: 5, lineHeight: 1.15, textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{award}</div>
            </div>
            {/* Bottom band: the nominee's name */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '70px 26px 28px', textAlign: 'center', background: 'linear-gradient(0deg, rgba(23,18,51,0.96) 0%, rgba(23,18,51,0.8) 55%, rgba(23,18,51,0) 100%)' }}>
              <div style={{ width: 70, height: 3, background: GOLD, margin: '0 auto 12px', borderRadius: 2 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: nominee.nominee_name.length > 24 ? 34 : 42, fontWeight: 700, lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                {nominee.nominee_name}
              </div>
              {(nominee.nominee_class || nominee.nominee_house) && (
                <div style={{ marginTop: 6, fontSize: 17, color: 'var(--gold-light)', fontWeight: 600 }}>
                  {[nominee.nominee_class, nominee.nominee_house].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </>
        )}
        <div style={{ position: 'absolute', inset: 8, border: '2px solid rgba(212,175,55,0.55)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

export default function RevealPage() {
  const [all, setAll] = useState(null);
  const [cat, setCat] = useState('');
  const [i, setI] = useState(0); // 0 = intro slide, then 1..n = nominees
  const [playing, setPlaying] = useState(false);
  const [secs, setSecs] = useState(3);
  const [clean, setClean] = useState(false);
  const [win, setWin] = useState({ w: 600, h: 800 });
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => setAll(d.candidates || [])).catch(() => setAll([]));
    const upd = () => setWin({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const cats = useMemo(() => {
    const m = new Map();
    (all || []).forEach(c => {
      const key = `${c.section_label || ''}|||${c.award_name || ''}`;
      if (!m.has(key)) m.set(key, { key, section: c.section_label || '', award: c.award_name || '', list: [] });
      m.get(key).list.push(c);
    });
    m.forEach(g => g.list.sort((a, b) => a.nominee_name.localeCompare(b.nominee_name)));
    return [...m.values()];
  }, [all]);

  useEffect(() => { if (!cat && cats.length) setCat(cats[0].key); }, [cats, cat]);
  const group = cats.find(g => g.key === cat) || null;
  const total = group ? group.list.length : 0;

  const next = () => setI(x => Math.min(total, x + 1));
  const prev = () => setI(x => Math.max(0, x - 1));

  // Auto-play: advance every `secs` seconds, stop on the last nominee.
  useEffect(() => {
    clearInterval(timer.current);
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setI(x => {
        if (x >= total) { setPlaying(false); return x; }
        return x + 1;
      });
    }, Math.max(1, secs) * 1000);
    return () => clearInterval(timer.current);
  }, [playing, secs, total]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') setClean(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { setI(0); setPlaying(false); }, [cat]);

  const size = clean ? Math.floor(Math.min(win.w, win.h)) : Math.floor(Math.min(win.w - 32, 640));
  const nominee = group && i > 0 ? group.list[i - 1] : null;

  async function download() {
    setBusy(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const node = document.getElementById('reveal-card');
      const canvas = await window.html2canvas(node, { useCORS: true, backgroundColor: null, scale: 1080 / node.clientWidth });
      const a = document.createElement('a');
      a.download = `${(nominee ? nominee.nominee_name : 'nominees-intro').replace(/[^a-z0-9]+/gi, '-')}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      alert("Couldn't prepare the image. Use Clean view and screen-record instead.");
    }
    setBusy(false);
  }

  const card = group ? <Slide key={i} intro={i === 0} award={group.award} nominee={nominee} size={size} /> : null;

  if (clean) {
    return (
      <div onClick={next} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none' }}>
        <style>{'@keyframes revealIn{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:scale(1)}}'}</style>
        <div style={{ animation: 'revealIn .6s ease' }} key={i}>{card}</div>
      </div>
    );
  }

  return (
    <Shell>
      <style>{'@keyframes revealIn{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:scale(1)}}'}</style>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 700 }}>
          <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div>
              <span className="section-tag">Announcement</span>
              <h2>Nominee reveal slides</h2>
              <p style={{ color: 'var(--ink-soft)', margin: '8px auto 0', maxWidth: 480 }}>
                Pick a category, then press Play or use the arrow keys. Use Clean view to record just the square.
              </p>
            </div>
          </div>

          {all === null && <div className="panel panel-pad" style={{ textAlign: 'center' }}>Loading…</div>}
          {all && all.length === 0 && <div className="panel panel-pad" style={{ textAlign: 'center' }}>No nominees on the ballot yet.</div>}

          {group && (
            <>
              <div className="field" style={{ marginBottom: 12 }}>
                <label>Category</label>
                <select value={cat} onChange={e => setCat(e.target.value)}>
                  {cats.map(g => <option key={g.key} value={g.key}>{g.section ? `${g.section} · ` : ''}{g.award} ({g.list.length})</option>)}
                </select>
              </div>

              <div style={{ animation: 'revealIn .6s ease', marginBottom: 14 }} key={`${cat}-${i}`}>{card}</div>

              <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 10 }}>
                {i === 0 ? 'Intro slide' : `Nominee ${i} of ${total}`}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 12 }}>
                <button className="small-btn" onClick={prev} disabled={i === 0}>← Back</button>
                <button className="btn btn-gold" onClick={() => { if (i >= total) setI(0); setPlaying(p => !p); }}>
                  {playing ? '⏸ Pause' : i >= total && total > 0 ? '↺ Replay' : '▶ Play'}
                </button>
                <button className="small-btn" onClick={next} disabled={i >= total}>Next →</button>
                <button className="small-btn" onClick={() => setClean(true)}>🎬 Clean view</button>
                <button className="small-btn" onClick={download} disabled={busy}>{busy ? 'Preparing…' : '⬇ Save slide (1080px)'}</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
                Seconds per slide
                <input type="number" min={1} max={30} value={secs} onChange={e => setSecs(Number(e.target.value) || 3)} style={{ width: 64 }} />
              </div>
              <div className="hint" style={{ textAlign: 'center', marginTop: 10 }}>
                Clean view: click or press → for the next slide, ← for the previous, Esc to leave.
              </div>
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}
