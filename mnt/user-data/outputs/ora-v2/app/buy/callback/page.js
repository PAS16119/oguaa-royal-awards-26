'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../../components';

export default function BuyCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState({ phase: 'checking' });
  const [reference, setReference] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference') || params.get('trxref') || '';
    setReference(ref);
    if (!ref) { setState({ phase: 'error', message: 'No payment reference in the link.' }); return; }
    verify(ref, 0);
  }, []);

  async function verify(ref, attempt) {
    try {
      const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      if (data.status === 'paid') { setState({ phase: 'paid', codes: data.codes || [], buyer: data.buyer }); return; }
      // Mobile money can take a few seconds to settle — retry a little.
      if (attempt < 4) { setTimeout(() => verify(ref, attempt + 1), 3000); setState({ phase: 'checking', retrying: true }); return; }
      setState({ phase: 'unpaid' });
    } catch (e) {
      setState({ phase: 'error', message: e.message });
    }
  }

  function copyAll(codes) {
    navigator.clipboard?.writeText(codes.join('\n'));
    toast('Codes copied');
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="panel panel-pad" style={{ textAlign: 'center' }}>
            {state.phase === 'checking' && (
              <>
                <Seal id="cb" />
                <h2 style={{ margin: '14px 0 6px' }}>Confirming your payment…</h2>
                <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
                  {state.retrying ? 'Still waiting on the network — mobile money can take a few seconds.' : 'One moment.'}
                </p>
              </>
            )}

            {state.phase === 'paid' && (
              <>
                <Seal id="cb" />
                <h2 style={{ margin: '14px 0 6px' }}>Payment confirmed 🎉</h2>
                <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                  Here {state.codes.length === 1 ? 'is your access code' : 'are your access codes'}. Write them down — each one unlocks one nomination.
                </p>
                <div className="tag-row" style={{ justifyContent: 'center', margin: '18px 0' }}>
                  {state.codes.map(c => (
                    <span key={c} className="code-chip mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {c} <button className="copy-btn" onClick={() => { navigator.clipboard?.writeText(c); toast('Copied ' + c); }}>Copy</button>
                    </span>
                  ))}
                </div>
                {state.codes.length > 1 && (
                  <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={() => copyAll(state.codes)}>
                    Copy all codes
                  </button>
                )}
                <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/nominate')}>
                  Go to the nomination form →
                </button>
                <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 14 }}>
                  Keep this link. Reference <span className="mono">{reference}</span> will always show your codes again.
                </p>
              </>
            )}

            {state.phase === 'unpaid' && (
              <>
                <h2 style={{ margin: '0 0 6px' }}>Payment not confirmed yet</h2>
                <div className="banner banner-gold" style={{ textAlign: 'left', marginBottom: 14 }}>
                  If money left your account, do not pay again. Wait a minute and reload this page — the codes appear as
                  soon as Paystack confirms. Keep the reference <strong className="mono">{reference}</strong>.
                </div>
                <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={() => verify(reference, 0)}>
                  Check again
                </button>
              </>
            )}

            {state.phase === 'error' && (
              <>
                <h2 style={{ margin: '0 0 6px' }}>Something went wrong</h2>
                <div className="banner banner-bad" style={{ textAlign: 'left' }}>{state.message}</div>
                <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => router.push('/buy')}>
                  Back to purchase
                </button>
              </>
            )}
          </div>
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
