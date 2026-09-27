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
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(voteUrl)}`;

  return (
    <div
      id="poster-card"
      style={{
        display: 'grid',
        width: '100%',
        maxWidth: 440,
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
      <div style={{ gridArea: '1 / 1', position: 'relative', display: 'flex', flexDirection: 'column', padding: '20px 22px 18px', minHeight: '100%' }}>

        {/* Top: event logo */}
        <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
          <img src="/logo-mark.png" alt="Oguaa Royal Awards" style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
          <div style={{ fontSize: 9.5, letterSpacing: 2.2, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700, marginTop: 4 }}>
            Vote Now — Every Vote Counts
          </div>
        </div>

        {/* Middle: name/category (left) + oval photo (right) */}
        <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 19, lineHeight: 1.22 }}>{candidate.nominee_name}</h2>
            <div style={{ display: 'inline-block', background: 'rgba(212,175,55,0.16)', border: '1px solid rgba(212,175,55,0.4)', color: 'var(--gold-light)', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>
              {candidate.award_name}
            </div>
          </div>
          <div style={{
            flex: '0 0 auto', width: 108, height: 138, borderRadius: '50%', padding: 5,
            background: 'linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-deep))',
          }}>
            {candidate.photo_url ? (
              <img
                src={candidate.photo_url}
                alt={candidate.nominee_name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', display: 'block', border: '3px solid var(--royal-3)' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%', border: '3px solid var(--royal-3)',
                background: 'var(--royal-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: 'var(--gold-light)',
              }}>
                {initials(candidate.nominee_name)}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: dial code + QR, side by side */}
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 0', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,175,55,0.35)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 9.5, letterSpacing: 1.3, textTransform: 'uppercase', color: 'rgba(251,246,234,0.65)', marginBottom: 6 }}>Dial to vote</div>
            {shortcode && <div style={{ fontSize: 11, color: 'var(--gold-light)', marginBottom: 5, fontWeight: 700 }}>{shortcode}</div>}
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 24, letterSpacing: 2.5,
              color: 'var(--royal-3)', background: 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))',
              borderRadius: 9, padding: '5px 4px',
            }}>
              {candidate.ballot_code}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(251,246,234,0.6)', marginTop: 6 }}>any phone, no data needed</div>
          </div>
          <div style={{ flex: '0 0 auto', width: 100, background: '#fff', borderRadius: 14, padding: 8, textAlign: 'center' }}>
            <img src={qrSrc} alt="Scan to vote online" width={84} height={84} style={{ display: 'block', margin: '0 auto', borderRadius: 5 }} />
            <div style={{ fontSize: 8.5, color: 'var(--royal-3)', marginTop: 5, fontWeight: 600 }}>scan to vote</div>
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
