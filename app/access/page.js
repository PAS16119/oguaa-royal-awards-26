'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Toast } from '../components';

export default function AccessPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch('/api/public/summary').then(r => r.json()).then(d => setConfig(d.config)).catch(() => {});
  }, []);

  async function checkCode() {
    const raw = code.trim().toUpperCase();
    if (!raw) { setResult({ ok: false, msg: 'Enter a code first.' }); return; }
    setChecking(true);
    try {
      const res = await fetch(`/api/codes/${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!data.found) setResult({ ok: false, msg: 'Code not found. Check for typos.' });
      else if (data.status === 'used') setResult({ ok: false, msg: 'This code has already been used for a nomination.' });
      else if (data.status === 'void') setResult({ ok: false, msg: 'This code was voided by the committee. Please contact them.' });
      else setResult({ ok: true, msg: '✓ Valid code — ready to use.' });
    } catch {
      setResult({ ok: false, msg: 'Something went wrong. Try again.' });
    }
    setChecking(false);
  }

  const price = config?.price_ghs ?? 10;

  return (
    <Shell>
      <section className="block">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="section-tag">Step 1</span>
              <h2>How to get your access code</h2>
              <div className="sub">All payments are handled in person by the committee or a registered sales agent — codes are never self-issued online, so every nomination is tied to a confirmed payment.</div>
            </div>
          </div>
          <div className="two-col">
            <div className="panel panel-pad">
              <span className="section-tag">Pay in person</span>
              <h2 style={{ margin: '6px 0 14px', fontSize: 22 }}>Find a committee member or agent</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: '14.5px', lineHeight: 1.7 }}>
                Pay GH₵{price} — in cash, or via {config?.momo_network || 'MoMo'} to <strong>{config?.momo_number || '(set by admin)'}</strong> ({config?.momo_name || '(set by admin)'}) shown to you directly by the person collecting payment.
                Once they've confirmed your payment, they generate a unique access code for you from the official system, right there.
              </p>
              <div className="banner banner-gold" style={{ marginTop: 16 }}>
                🎫 Write your code down carefully — it can only be used <strong>once</strong>, for one nomination.
              </div>
              <div className="banner banner-bad" style={{ marginTop: 12 }}>
                ⚠️ Codes are only ever generated after payment is confirmed by a committee member or agent. Nobody can buy a code online by themselves — this keeps every entry honest.
              </div>
            </div>
            <div className="panel panel-pad">
              <span className="section-tag">Check a code</span>
              <h2 style={{ margin: '6px 0 14px', fontSize: 22 }}>Verify an access code</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px' }}>Already have a code? Confirm it's valid before you start filling the form.</p>
              <div className="field">
                <label>Access code</label>
                <input className="code-input mono" type="text" maxLength={12} placeholder="ORA-XXX-XXX"
                  value={code} onChange={e => setCode(e.target.value)} />
              </div>
              <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center' }} disabled={checking} onClick={checkCode}>
                {checking ? 'Checking…' : 'Verify code'}
              </button>
              {result && (
                <div className={`banner ${result.ok ? 'banner-good' : 'banner-bad'}`} style={{ marginTop: 16 }}>{result.msg}</div>
              )}
              <div className="divider-label">then</div>
              <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/nominate')}>Go to nomination form →</button>
            </div>
          </div>
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
