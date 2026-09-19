'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../components';

export default function BuyPage() {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/public/summary').then(r => r.json()).then(d => { setConfig(d.config); setReady(true); }).catch(() => setReady(true));
  }, []);

  const price = Number(config?.price_ghs ?? 10);
  const maxQty = parseInt(config?.max_codes_per_purchase) || 10;
  const total = (price * qty).toFixed(2);
  const online = Boolean(config?.online_sales_enabled);

  async function pay() {
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/paystack/init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the payment.');
      window.location.href = data.authorization_url;
    } catch (e) {
      setErr(e.message);
      toast(e.message);
      setBusy(false);
    }
  }

  if (!ready) {
    return <Shell><section className="block"><div className="wrap"><p style={{ color: 'var(--ink-soft)' }}>Loading…</p></div></section><Toast /></Shell>;
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Royal Awards · paid entry</span>
              <h2>Buy an access code</h2>
              <div className="sub">Pay with MoMo or card and your code appears on the screen straight away — no queuing, no waiting for an agent.</div>
            </div>
          </div>

          {!online ? (
            <div className="panel panel-pad">
              <div className="banner banner-gold">
                Online purchase is switched off right now. Get your code from a committee member or a registered sales agent.
              </div>
              <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => router.push('/access')}>
                How to get a code in person →
              </button>
            </div>
          ) : (
            <div className="panel panel-pad">
              <div className="field">
                <label>How many nominations? *</label>
                <select value={qty} onChange={e => setQty(parseInt(e.target.value))}>
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} code{n > 1 ? 's' : ''} — GH₵{(price * n).toFixed(2)}</option>
                  ))}
                </select>
                <div className="hint">One code = one nomination. Buy several if you want to nominate in several categories.</div>
              </div>

              <div className="field">
                <label>Your name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kofi Annan" />
              </div>
              <div className="two-col">
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  <div className="hint">Paystack sends your receipt here.</div>
                </div>
                <div className="field">
                  <label>Phone (MoMo) *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0XX XXX XXXX" />
                </div>
              </div>

              <div className="banner banner-gold" style={{ marginBottom: 16 }}>
                Total to pay: <strong style={{ marginLeft: 6 }}>GH₵{total}</strong>
              </div>

              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={busy} onClick={pay}>
                {busy ? 'Opening secure checkout…' : `Pay GH₵${total} with Paystack →`}
              </button>
              {err && <div className="banner banner-bad" style={{ marginTop: 14 }}>{err}</div>}

              <div className="divider-label">or</div>
              <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/access')}>
                Pay a committee member in person instead
              </button>

              <div style={{ marginTop: 22, textAlign: 'center' }}>
                <Seal id="buy" caption="Codes are issued the moment Paystack confirms payment" />
              </div>
            </div>
          )}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
