'use client';
import { Seal } from '../../components';

// One poster design, used from two places: the admin "Print poster" modal,
// and the public /vote/poster/[code] page a nominee can be sent a link to
// directly — so a nominee never needs an admin login to get their own poster.
export default function PosterCard({ candidate, voteUrl, shortcode }) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(voteUrl)}`;

  return (
    <div
      id="poster-card"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        borderRadius: 22,
        overflow: 'hidden',
        background: 'radial-gradient(700px 380px at 15% -10%, rgba(212,175,55,0.28), transparent 60%),radial-gradient(600px 380px at 100% 0%, rgba(122,31,61,0.5), transparent 55%),linear-gradient(165deg, var(--royal-3), var(--royal) 55%, var(--royal-2))',
        border: '1px solid rgba(212,175,55,0.4)',
        boxShadow: '0 24px 60px -20px rgba(23,18,51,0.6)',
        color: 'var(--parchment)',
      }}
    >
      <div className="kente" />

      <div style={{ padding: '26px 26px 10px', textAlign: 'center' }}>
        <Seal id={candidate.id} caption={null} />
      </div>

      <div style={{ padding: '4px 26px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--gold-light)', fontWeight: 700 }}>
          Vote Now — Every Vote Counts
        </div>
      </div>

      <div style={{ padding: '18px 26px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 168, height: 168, borderRadius: '50%', padding: 5,
          background: 'linear-gradient(135deg, var(--gold-light), var(--gold) 55%, var(--gold-deep))',
        }}>
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={candidate.nominee_name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'top center', display: 'block', border: '3px solid var(--royal-3)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--royal-3)', border: '3px solid var(--royal-3)' }} />
          )}
        </div>
      </div>

      <div style={{ padding: '18px 26px 0', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 25, lineHeight: 1.15 }}>{candidate.nominee_name}</h2>
        <div style={{ display: 'inline-block', background: 'rgba(212,175,55,0.16)', border: '1px solid rgba(212,175,55,0.4)', color: 'var(--gold-light)', fontSize: 12.5, fontWeight: 700, padding: '5px 14px', borderRadius: 999 }}>
          {candidate.award_name}
        </div>
      </div>

      <div style={{ padding: '24px 26px 8px', display: 'flex', gap: 18, alignItems: 'stretch', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 16, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(251,246,234,0.65)', marginBottom: 8 }}>Dial to vote</div>
          {shortcode && <div style={{ fontSize: 12.5, color: 'var(--gold-light)', marginBottom: 6, fontWeight: 700 }}>{shortcode}</div>}
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, fontSize: 30, letterSpacing: 3,
            color: 'var(--royal-3)', background: 'linear-gradient(135deg,var(--gold-light),var(--gold) 60%,var(--gold-deep))',
            borderRadius: 10, padding: '6px 4px',
          }}>
            {candidate.ballot_code}
          </div>
          <div style={{ fontSize: 10.5, color: 'rgba(251,246,234,0.6)', marginTop: 8 }}>works on any phone — no data needed</div>
        </div>
        <div style={{ flex: '1 1 140px', background: '#fff', borderRadius: 16, padding: 14, textAlign: 'center' }}>
          <img src={qrSrc} alt="Scan to vote online" width={140} height={140} style={{ display: 'block', margin: '0 auto', borderRadius: 6 }} />
          <div style={{ fontSize: 10.5, color: 'var(--royal-3)', marginTop: 8, fontWeight: 600 }}>scan to vote online</div>
        </div>
      </div>

      <div style={{ padding: '10px 26px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 11.5, color: 'rgba(251,246,234,0.65)' }}>
          Supporting OSTECH's 35th Anniversary — Oguaa Royal Awards
        </div>
      </div>

      <div className="kente" />
    </div>
  );
}
