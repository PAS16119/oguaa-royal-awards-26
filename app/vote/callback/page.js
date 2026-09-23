'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../../components';

export default function VoteCallbackPage() {
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
      const res = await fetch(`/api/votes/verify?reference=${encodeURIComponent(ref)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');
      if (data.status === 'paid') { setState({ phase: 'paid', votes: data.votes, candidate: data.candidate }); return; }
      if (attempt < 4) { setTimeout(() => verify(ref, attempt + 1), 3000); setState({ phase: 'checking', retrying: true }); return; }
      setState({ phase: 'unpaid' });
    } catch (e) {
      setState({ phase: 'error', message: e.message });
    }
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 520 }}>
          <div className="panel panel-pad" style={{ textAlign: 'center' }}>
            {state.phase === 'checking' && (
              <>
                <Seal id="votecb" />
                <h2 style={{ margin: '14px 0 6px' }}>Confirming your payment…</h2>
                <p style={{ color: 'var(--ink-soft)', fontSize: 13.5 }}>
                  {state.retrying ? 'Still waiting on the network — mobile money can take a few seconds.' : 'One moment.'}
                </p>
              </>
            )}

            {state.phase === 'paid' && (
              <>
                <Seal id="votecb" />
                <h2 style={{ margin: '14px 0 6px' }}>Thank you! 🎉</h2>
                <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                  <strong>{state.votes} vote{state.votes === 1 ? '' : 's'}</strong> added for
                  {' '}<strong>{state.candidate?.nominee_name}</strong>
                  {state.candidate?.award_name && <> ({state.candidate.award_name})</>}.
                </p>
                {state.candidate && (
                  <div className="banner banner-good" style={{ margin: '18px 0', justifyContent: 'center' }}>
                    They now have <strong style={{ marginLeft: 6 }}>{state.candidate.votes}</strong> votes total.
                  </div>
                )}
                <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={() => router.push('/vote')}>
                  Vote again →
                </button>
                <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/vote/results')}>
                  See the leaderboard →
                </button>
                <p style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 14 }}>Reference <span className="mono">{reference}</span></p>
              </>
            )}

            {state.phase === 'unpaid' && (
              <>
                <h2 style={{ margin: '0 0 6px' }}>Payment not confirmed yet</h2>
                <div className="banner banner-gold" style={{ textAlign: 'left', marginBottom: 14 }}>
                  If money left your account, do not pay again. Wait a minute and check again — votes appear as soon as
                  Paystack confirms. Keep the reference <strong className="mono">{reference}</strong>.
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
                <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => router.push('/vote')}>
                  Back to voting
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
