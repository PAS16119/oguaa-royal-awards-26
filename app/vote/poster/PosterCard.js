'use client';

import { useEffect, useRef, useState } from 'react';

// One poster design, used from two places: the admin "Print poster" modal,
// and the public /vote/poster/[code] page a nominee can be sent a link to
// directly — so a nominee never needs an admin login to get their own poster.
//
// The poster is always a true square. It is laid out once on a fixed
// 540 x 540 canvas and the whole canvas is scaled to fit whatever width the
// card is given (a phone screen, the admin modal, a print view), so the
// layout never reflows and nothing can spill out of the square.
//
// Legibility rule: text never sits directly on the artwork. The artwork is
// dimmed under a dark overlay, and every block of text is either on that
// overlay or inside a solid dark / white panel.
const BASE = 540;

const GOLD_TEXT = 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))';
const PANEL = 'rgba(23,18,51,0.9)';
const PANEL_BORDER = '1px solid rgba(212,175,55,0.5)';

export default function PosterCard({ candidate, voteUrl, shortcode, bgUrl }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(voteUrl)}`;
  const dial = shortcode || '*928*135#';
  // Just the site's host ("ora26.vercel.app") for the small line under the QR.
  let siteHost = 'ora26.vercel.app';
  try { siteHost = new URL(voteUrl).host || siteHost; } catch (e) { /* keep default */ }

  // Scale the fixed canvas to the card's actual width.
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => setScale(el.clientWidth / BASE);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hi = { color: 'var(--gold-light)' };

  // The USSD path, matching the live flow: welcome -> 1 (Vote) -> candidate
  // code -> confirm name -> number of votes -> pay.
  const steps = [
    <>Dial <b style={{ ...hi, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{dial}</b></>,
    <>Select <b style={hi}>1</b> to Vote</>,
    <>Enter the <b style={hi}>nominee code</b> below</>,
    <>Confirm the <b style={hi}>nominee&apos;s name</b></>,
    <>Enter votes &amp; approve payment</>,
  ];

  return (
    <div
      id="poster-card"
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: BASE,
        aspectRatio: '1 / 1',
        margin: '0 auto',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(212,175,55,0.4)',
        boxShadow: '0 24px 60px -20px rgba(23,18,51,0.6)',
        background: 'var(--royal-3)',
        color: 'var(--parchment)',
        visibility: scale ? 'visible' : 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, width: BASE, height: BASE,
        transform: `scale(${scale || 1})`, transformOrigin: 'top left',
        boxSizing: 'border-box',
      }}>
        {/* Artwork layer */}
        <div style={{
          position: 'absolute', inset: 0,
          background: bgUrl
            ? `url(${bgUrl})`
            : 'radial-gradient(700px 380px at 15% -10%, rgba(212,175,55,0.28), transparent 60%),radial-gradient(600px 380px at 100% 0%, rgba(122,31,61,0.5), transparent 55%),linear-gradient(165deg, var(--royal-3), var(--royal) 55%, var(--royal-2))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Dark overlay: keeps every piece of text readable over any artwork,
            and ends in solid --royal-3 so the footer is always clean. */}
        {bgUrl && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(23,18,51,0.8) 0%, rgba(23,18,51,0.6) 24%, rgba(23,18,51,0.68) 55%, rgba(23,18,51,0.96) 82%, var(--royal-3) 100%)',
          }} />
        )}

        {/* Content layer */}
        <div style={{
          position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', padding: '20px 22px 14px',
        }}>

          {/* Header: logo, then the event name */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 46 }}>
            <img src="/logo-mark.png" alt="" style={{ height: 44, width: 'auto', objectFit: 'contain', borderRadius: 4 }} />
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: 27, fontWeight: 700, lineHeight: 1.05,
              color: 'var(--gold-light)', letterSpacing: 0.4, textShadow: '0 2px 8px rgba(0,0,0,0.75)',
            }}>
              Oguaa Royal Awards
            </div>
          </div>

          {/* Main: name + steps (left), oval photo + QR (right) */}
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', gap: 14, marginTop: 10 }}>

            <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingBottom: 8 }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 27, lineHeight: 1.15, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                  {candidate.nominee_name}
                </h2>
                <div style={{ alignSelf: 'flex-start', background: PANEL, border: PANEL_BORDER, color: 'var(--gold-light)', fontSize: 15, fontWeight: 700, padding: '5px 14px', borderRadius: 999 }}>
                  {candidate.award_name}
                </div>
              </div>

              <div style={{ flex: '0 0 auto', background: PANEL, border: PANEL_BORDER, borderRadius: 16, padding: '11px 14px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 800 }}>How to vote</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(251,246,234,0.85)' }}>any phone, no data</div>
                </div>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {steps.map((s, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, lineHeight: 1.2, color: 'var(--parchment)' }}>
                      <span style={{
                        flex: '0 0 auto', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: 'var(--royal-3)', background: GOLD_TEXT,
                      }}>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div style={{ flex: '0 0 auto', width: 158, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 150, height: 186, borderRadius: '50%', padding: 6, boxSizing: 'border-box', background: GOLD_TEXT, boxShadow: '0 6px 18px rgba(0,0,0,0.5)' }}>
                {candidate.photo_url ? (
                  <img
                    src={candidate.photo_url}
                    alt={candidate.nominee_name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', display: 'block', border: '4px solid var(--royal-3)', boxSizing: 'border-box' }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%', border: '4px solid var(--royal-3)', boxSizing: 'border-box',
                    background: 'var(--royal-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 700, color: 'var(--gold-light)',
                  }}>
                    {initials(candidate.nominee_name)}
                  </div>
                )}
              </div>

              <div style={{ width: 158, boxSizing: 'border-box', background: '#fff', borderRadius: 16, padding: '8px 8px 7px', textAlign: 'center' }}>
                <img src={qrSrc} alt="Scan to vote online" width={100} height={100} style={{ display: 'block', margin: '0 auto', borderRadius: 5 }} />
                <div style={{ fontSize: 12.5, color: 'var(--royal-3)', marginTop: 3, fontWeight: 800 }}>scan to vote online</div>
                <div style={{ fontSize: 11, color: 'var(--royal-3)', fontWeight: 600 }}>{siteHost}</div>
              </div>
            </div>
          </div>

          {/* Nominee code */}
          <div style={{ flex: '0 0 auto', marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, background: PANEL, border: PANEL_BORDER, borderRadius: 16, padding: '7px 10px 7px 16px' }}>
            <div style={{ fontSize: 14, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 800, lineHeight: 1.25 }}>
              Nominee<br />code
            </div>
            <div style={{
              flex: '1 1 auto', textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 40, letterSpacing: 6, lineHeight: 1.1,
              color: 'var(--royal-3)', background: GOLD_TEXT, borderRadius: 11, padding: '4px 4px',
            }}>
              {candidate.ballot_code}
            </div>
          </div>

          {/* Bottom: call to action */}
          <div style={{ flex: '0 0 auto', marginTop: 9, textAlign: 'center', fontSize: 14, letterSpacing: 2.6, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 800, textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>
            Vote Now — Every Vote Counts
          </div>
        </div>
      </div>
    </div>
  );
}

// "Yahaya Dabre Zulaiha" -> "YD" — a same simple two-initial fallback used
// wherever a photo is missing (poster, and see components.js for the same
// idea on candidate cards elsewhere).
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
