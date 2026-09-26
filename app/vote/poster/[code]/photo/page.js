'use client';
import { useEffect, useState } from 'react';
import { Shell, Toast, toast, compressImageFile } from '../../../../components';

export default function NomineePhotoPage({ params }) {
  const { code } = params;
  const [candidate, setCandidate] = useState(undefined); // undefined = loading, null = not found
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  function load() {
    fetch(`/api/candidates/by-code/${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => setCandidate(d.candidate || null))
      .catch(() => setCandidate(null));
  }
  useEffect(load, [code]);

  async function onPick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file);
      setPreview(dataUrl);
      const res = await fetch(`/api/candidates/by-code/${encodeURIComponent(code)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update your photo.');
      toast('Photo updated — your poster and the vote page will show it shortly');
      load();
    } catch (e) { toast(e.message); setPreview(null); }
    setBusy(false);
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 480 }}>
          <div className="section-head" style={{ justifyContent: 'center', textAlign: 'center' }}>
            <div>
              <span className="section-tag">Nominee Photo</span>
              <h2>Update your photo</h2>
              <p style={{ color: 'var(--ink-soft)', maxWidth: 420, margin: '8px auto 0' }}>
                Only you and the committee know this code — anyone else can't change it. Pick a clear, forward-facing
                photo; it's what appears on your poster and the vote page.
              </p>
            </div>
          </div>

          {candidate === undefined && <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Loading…</div>}
          {candidate === null && (
            <div className="panel panel-pad" style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
              We couldn't find a candidate with that code. Double-check the link, or ask the committee for it again.
            </div>
          )}
          {candidate && (
            <div className="panel panel-pad" style={{ textAlign: 'center' }}>
              <img
                src={preview || candidate.photo_url || ''}
                alt={candidate.nominee_name}
                style={{
                  width: 140, height: 140, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px',
                  background: 'var(--panel-2)', display: candidate.photo_url || preview ? 'block' : 'none',
                }}
              />
              {!candidate.photo_url && !preview && (
                <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'var(--panel-2)', margin: '0 auto 14px' }} />
              )}
              <div style={{ fontWeight: 700, fontSize: 16 }}>{candidate.nominee_name}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 18 }}>{candidate.award_name}</div>

              <label className="btn btn-gold" style={{ justifyContent: 'center', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Uploading…' : '📷 Choose a new photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={busy} onChange={onPick} />
              </label>

              <div style={{ marginTop: 16 }}>
                <a href={`/vote/poster/${encodeURIComponent(code)}`} style={{ fontSize: 12.5, color: 'var(--ink-soft)', textDecoration: 'underline' }}>
                  ← back to your poster
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
