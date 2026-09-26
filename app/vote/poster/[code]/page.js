'use client';
import { useEffect, useState } from 'react';
import { Shell } from '../../../components';
import PosterCard from '../PosterCard';

export default function NomineePosterPage({ params }) {
  const { code } = params;
  const [candidate, setCandidate] = useState(undefined); // undefined = loading, null = not found
  const [shortcode, setShortcode] = useState(null);
  const [bgUrl, setBgUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/candidates').then(r => r.json()).then(d => {
      const match = (d.candidates || []).find(c => c.ballot_code === code);
      setCandidate(match || null);
    }).catch(() => setCandidate(null));
    fetch('/api/public/summary').then(r => r.json()).then(d => {
      setShortcode(d?.config?.ussd_shortcode || null);
      setBgUrl(d?.config?.poster_bg_url || null);
    }).catch(() => {});
  }, [code]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ora26.vercel.app';
  const voteUrl = `${origin}/vote?code=${code}`;

  // Same on-demand html2canvas approach as the admin modal — see the comment
  // there for why it's loaded from a CDN rather than bundled.
  async function downloadPoster() {
    setDownloading(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const node = document.getElementById('poster-card');
      const canvas = await window.html2canvas(node, { useCORS: true, backgroundColor: null, scale: 2 });
      const link = document.createElement('a');
      link.download = `${(candidate.nominee_name || 'poster').replace(/[^a-z0-9]+/gi, '-')}-poster.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      // Long-press-to-save doesn't work on a composite element like this
      // poster (it's built from many layered elements, not one <img>), so a
      // screenshot is the one fallback that always works regardless of why
      // the canvas export failed.
      alert("Couldn't prepare a download — please take a screenshot of this page instead to share it.");
    }
    setDownloading(false);
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div>
              <span className="section-tag">Your Poster</span>
              <h2>Share this to get votes</h2>
              <p style={{ color: 'var(--ink-soft)', maxWidth: 440, margin: '8px auto 0' }}>
                Download it below, or just take a screenshot — either works great for WhatsApp, Status, or Instagram.
              </p>
            </div>
          </div>

          {candidate === undefined && <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Loading…</div>}
          {candidate === null && (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              We couldn't find a candidate with that code. Double-check the link, or ask the committee for your poster link again.
            </div>
          )}
          {candidate && (
            <>
              <div style={{ marginBottom: 20 }}>
                <PosterCard candidate={candidate} voteUrl={voteUrl} shortcode={shortcode} bgUrl={bgUrl} />
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={downloadPoster} disabled={downloading}>
                {downloading ? 'Preparing…' : '⬇ Download poster to share'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <a href={`/vote/poster/${code}/photo`} style={{ fontSize: 12.5, color: 'var(--ink-soft)', textDecoration: 'underline' }}>
                  Wrong photo? Update it →
                </a>
              </div>
            </>
          )}
        </div>
      </section>
    </Shell>
  );
}
