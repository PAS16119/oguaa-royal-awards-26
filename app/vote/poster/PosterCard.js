'use client';

// One poster design, used from two places: the admin "Print poster" modal,
// and the public /vote/poster/[code] page a nominee can be sent a link to
// directly — so a nominee never needs an admin login to get their own poster.
//
// The image layer and the content layer are two separate grid items sharing
// the same cell (grid-area: 1/1), rather than one "background: url(...)"
// property on a single box. That matters: a plain CSS background stretches
// to whatever height its box ends up — so a long name forcing two lines
// would also stretch/distort the square artwork behind it. Splitting them
// lets the image keep its own true 1:1 aspect ratio always, while the grid
// row grows to fit whichever is taller (the image, or a long name).
export default function PosterCard({ candidate, voteUrl, shortcode, bgUrl }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${encodeURIComponent(voteUrl)}`;
  const dial = shortcode || '*928*135#';
  // Just the site's host ("ora26.vercel.app") for the small line under the QR.
  let siteHost = 'ora26.vercel.app';
  try { siteHost = new URL(voteUrl).host || siteHost; } catch (e) { /* keep default */ }

  // The USSD path, matching the live flow: welcome -> 1 (Vote) -> candidate
  // code -> confirm name -> number of votes -> pay.
  const steps = [
    <>Dial <b style={{ color: 'var(--gold-light)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>{dial}</b></>,
    <>Select <b style={{ color: 'var(--gold-light)' }}>1</b> to Vote</>,
    <>Enter the <b style={{ color: 'var(--gold-light)' }}>nominee code</b> shown below</>,
    <>Confirm the <b style={{ color: 'var(--gold-light)' }}>nominee's name</b></>,
    <>Enter number of votes &amp; approve payment</>,
  ];

  return (
    <div
      id="poster-card"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        width: '100%',
        maxWidth: 480,
        margin: '0 auto',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(212,175,55,0.4)',
        boxShadow: '0 24px 60px -20px rgba(23,18,51,0.6)',
        background: 'var(--royal-3)',
        color: 'var(--parchment)',
      }}
    >
      {/* Image layer — always a true square, never stretched. If the
          content layer below ends up taller (a long name wrapping to two
          lines, say), this simply stays square at the top and the extra
          height is plain --royal-3, matching the fade's own end colour so
          the seam is invisible. */}
      <div style={{ gridArea: '1 / 1', aspectRatio: '1 / 1', position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: bgUrl
            ? `url(${bgUrl})`
            : 'radial-gradient(700px 380px at 15% -10%, rgba(212,175,55,0.28), transparent 60%),radial-gradient(600px 380px at 100% 0%, rgba(122,31,61,0.5), transparent 55%),linear-gradient(165deg, var(--royal-3), var(--royal) 55%, var(--royal-2))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        {/* Blends out a source image's own footer (payment-logo strips,
            watermarks, etc.) into plain royal-purple, rather than trying to
            crop an exact pixel boundary that breaks the moment the image
            changes. Only needed over custom artwork — the default gradient
            already ends in the same colour, so this would be invisible
            either way. */}
        {bgUrl && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%',
            background: 'linear-gradient(180deg, transparent, var(--royal-3) 55%)',
          }} />
        )}
      </div>

      {/* Content layer — normal flow, so it's exactly as tall as it needs
          to be. Shares the same grid cell as the image above, so it always
          overlays it rather than being pushed below. */}
      <div style={{ gridArea: '1 / 1', position: 'relative', display: 'flex', flexDirection: 'column', padding: '22px 24px 22px', minHeight: '100%' }}>

        {/* Top: event logo */}
        <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
          <img src="/logo-mark.png" alt="Oguaa Royal Awards" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
          <div style={{ fontSize: 13, letterSpacing: 2.4, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700, marginTop: 6 }}>
            Vote Now — Every Vote Counts
          </div>
        </div>

        {/* Middle: name/category (left) + oval photo (right) */}
        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0 16px' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 28, lineHeight: 1.18 }}>{candidate.nominee_name}</h2>
            <div style={{ display: 'inline-block', background: 'rgba(212,175,55,0.16)', border: '1px solid rgba(212,175,55,0.4)', color: 'var(--gold-light)', fontSize: 15, fontWeight: 700, padding: '6px 14px', borderRadius: 999 }}>
              {candidate.award_name}
            </div>
          </div>
          <div style={{
            flex: '0 0 auto', width: 172, height: 216, borderRadius: '50%', padding: 6,
            background: 'linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-deep))',
          }}>
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.nominee_name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', display: 'block', border: '4px solid var(--royal-3)' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%', border: '3px solid var(--royal-3)',
                background: 'var(--royal-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Playfair Display', serif", fontSize: 48, fontWeight: 700, color: 'var(--gold-light)',
              }}>
                {initials(candidate.nominee_name)}
              </div>
            )}
          </div>
        </div>

        {/* How to vote by phone */}
        <div style={{ flex: '0 0 auto', background: 'rgba(23,18,51,0.72)', border: '1px solid rgba(212,175,55,0.4)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 14, letterSpacing: 1.6, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 800 }}>How to vote</div>
            <div style={{ fontSize: 12.5, color: 'rgba(251,246,234,0.75)' }}>any phone, no data needed</div>
          </div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 17, lineHeight: 1.25, color: 'var(--parchment)' }}>
                <span style={{
                  flex: '0 0 auto', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: 'var(--royal-3)',
                  background: 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))',
                }}>{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Bottom: nominee code + QR, side by side */}
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 0', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 16, padding: '12px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 13, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(251,246,234,0.8)', marginBottom: 8, fontWeight: 700 }}>Nominee code</div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 46, letterSpacing: 4, lineHeight: 1.1,
              color: 'var(--royal-3)', background: 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))',
              borderRadius: 11, padding: '8px 4px',
            }}>
              {candidate.ballot_code}
            </div>
          </div>
          <div style={{ flex: '0 0 auto', width: 148, background: '#fff', borderRadius: 16, padding: 9, textAlign: 'center' }}>
            <img src={qrSrc} alt="Scan to vote online" width={130} height={130} style={{ display: 'block', margin: '0 auto', borderRadius: 6 }} />
            <div style={{ fontSize: 13, color: 'var(--royal-3)', marginTop: 5, fontWeight: 800 }}>scan to vote online</div>
            <div style={{ fontSize: 11.5, color: 'var(--royal-3)', opacity: 0.75, fontWeight: 600 }}>{siteHost}</div>
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
