'use client';
import { useEffect, useRef, useState } from 'react';
import { Shell, Seal, Toast, toast } from '../components';

const ID_KEY = 'ora_free_nominator';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function FreeNominatePage() {
  const [sections, setSections] = useState(null);
  const [config, setConfig] = useState(null);
  const [freeCount, setFreeCount] = useState(null);

  // nominator identity — kept in the browser so one person can nominate
  // for several awards without retyping their details each time
  const [yourName, setYourName] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [yourRole, setYourRole] = useState('Student');
  const [identified, setIdentified] = useState(false);

  const [awardId, setAwardId] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeClass, setNomineeClass] = useState('');
  const [nomineeHouse, setNomineeHouse] = useState('');
  const [reason, setReason] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch('/api/catalog?track=free').then(r => r.json()).then(d => setSections(d.sections || [])).catch(() => setSections([]));
    fetch('/api/public/summary').then(r => r.json()).then(d => { setConfig(d.config); setFreeCount(d.freeCount); }).catch(() => {});
    try {
      const saved = JSON.parse(localStorage.getItem(ID_KEY) || 'null');
      if (saved?.phone) { setYourName(saved.name || ''); setYourPhone(saved.phone); setYourRole(saved.role || 'Student'); }
    } catch {}
  }, []);

  const nominable = (sections || []).map(s => ({ ...s, awards: s.awards.filter(a => a.nominable) })).filter(s => s.awards.length);
  const onRecord = (sections || []).map(s => ({ ...s, awards: s.awards.filter(a => !a.nominable) })).filter(s => s.awards.length);
  const selected = (sections || []).flatMap(s => s.awards).find(a => a.id === awardId);

  // window state
  let closedMsg = null;
  if (config) {
    const now = new Date();
    if (config.free_enabled === false) closedMsg = 'Free nominations are closed at the moment.';
    else if (config.free_open_date && now < new Date(String(config.free_open_date).slice(0, 10))) {
      closedMsg = `Free nominations open on ${fmtDate(config.free_open_date)}.`;
    } else if (config.free_close_date && now > new Date(String(config.free_close_date).slice(0, 10) + 'T23:59:59')) {
      closedMsg = `Free nominations closed on ${fmtDate(config.free_close_date)}. Thank you for taking part.`;
    }
  }

  function saveIdentity() {
    const errs = {};
    if (!yourName.trim()) errs.yourName = true;
    if (yourPhone.replace(/\D/g, '').length < 9) errs.yourPhone = true;
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please complete your details'); return; }
    try { localStorage.setItem(ID_KEY, JSON.stringify({ name: yourName.trim(), phone: yourPhone.trim(), role: yourRole })); } catch {}
    setIdentified(true);
  }

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    const errs = {};
    if (!awardId) errs.award = true;
    if (!nomineeName.trim()) errs.name = true;
    if (reason.trim().length < 10) errs.reason = true;
    if (config?.free_photo_required && !photoDataUrl) errs.photo = true;
    setErrors(errs);
    if (Object.keys(errs).length) { toast('Please complete all required fields'); return; }

    setSubmitting(true);
    try {
      let photoUrl = null;
      if (photoDataUrl) {
        const up = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: photoDataUrl }),
        });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || 'Photo upload failed');
        photoUrl = upData.url;
      }

      const res = await fetch('/api/nominations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track: 'free', awardId,
          nomineeName: nomineeName.trim(), nomineeClass: nomineeClass.trim(), nomineeHouse: nomineeHouse.trim(),
          reason: reason.trim(), photoUrl,
          nominatorName: yourName.trim(), nominatorPhone: yourPhone.trim(),
          nominatorRole: yourRole, relation: yourRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit nomination');
      setDone({ nomineeName: nomineeName.trim(), category: selected?.name, remaining: data.remaining, id: data.id });
    } catch (e) {
      toast(e.message || 'Something went wrong — please try again');
    }
    setSubmitting(false);
  }

  function nominateAnother() {
    setDone(null); setAwardId(''); setNomineeName(''); setNomineeClass('');
    setNomineeHouse(''); setReason(''); setPhotoDataUrl(null); setErrors({});
  }

  /* --------------------------------------------------------------- render */
  if (sections === null) {
    return <Shell><section className="block"><div className="wrap"><p style={{ color: 'var(--ink-soft)' }}>Loading the award list…</p></div></section><Toast /></Shell>;
  }

  if (done) {
    return (
      <Shell>
        <section className="block">
          <div className="wrap" style={{ maxWidth: 520 }}>
            <div className="panel panel-pad" style={{ textAlign: 'center' }}>
              <Seal id="freeconf" />
              <h2 style={{ margin: '14px 0 6px' }}>Nomination received ✅</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.7 }}>
                <strong>{done.nomineeName}</strong> has been nominated for<br /><strong>{done.category}</strong>.
              </p>
              <div className="banner banner-good" style={{ margin: '18px 0', justifyContent: 'center' }}>
                Reference: <span className="mono" style={{ marginLeft: 6, fontWeight: 700 }}>{String(done.id).slice(0, 8)}</span>
              </div>
              {typeof done.remaining === 'number' && (
                <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
                  You can still nominate for <strong>{done.remaining}</strong> more award{done.remaining === 1 ? '' : 's'} from this number.
                </p>
              )}
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={nominateAnother}>
                Nominate for another award →
              </button>
            </div>
          </div>
        </section>
        <Toast />
      </Shell>
    );
  }

  return (
    <Shell>
      <section className="block">
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Free · no payment, no code</span>
              <h2>Anniversary Merit Awards — nominate</h2>
              <div className="sub">
                Students and staff put names forward for the 35th Anniversary merit awards. The Awards Committee makes the
                final decision; your nomination tells them who the school thinks deserves it.
              </div>
            </div>
          </div>

          {closedMsg && <div className="banner banner-bad" style={{ marginBottom: 20 }}>{closedMsg}</div>}

          {!closedMsg && config?.free_close_date && (
            <div className="banner banner-gold" style={{ marginBottom: 20 }}>
              🕐 Nominations close {fmtDate(config.free_close_date)}
              {freeCount !== null && <> · {freeCount} nomination{freeCount === 1 ? '' : 's'} so far</>}
            </div>
          )}

          {/* ---------------------------------------------- step 1: identity */}
          {!identified ? (
            <div className="panel panel-pad">
              <span className="section-tag">Step 1 of 2</span>
              <h3 style={{ margin: '6px 0 4px' }}>Who is nominating?</h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px', marginBottom: 18 }}>
                Your number is used only to keep the vote honest: one nomination per person per award. It is never published.
              </p>
              <div className={`field ${errors.yourName ? 'invalid' : ''}`}>
                <label>Your full name *</label>
                <input type="text" value={yourName} onChange={e => setYourName(e.target.value)} placeholder="e.g. Ama Mensah" />
                {errors.yourName && <div className="err-msg">Please enter your name.</div>}
              </div>
              <div className="two-col">
                <div className={`field ${errors.yourPhone ? 'invalid' : ''}`}>
                  <label>Phone number *</label>
                  <input type="tel" value={yourPhone} onChange={e => setYourPhone(e.target.value)} placeholder="0XX XXX XXXX" />
                  {errors.yourPhone && <div className="err-msg">Please enter a working number.</div>}
                </div>
                <div className="field">
                  <label>You are a…</label>
                  <select value={yourRole} onChange={e => setYourRole(e.target.value)}>
                    <option>Student</option>
                    <option>Teaching Staff</option>
                    <option>Non-Teaching Staff</option>
                    <option>Old Student</option>
                    <option>Parent / Guardian</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={!!closedMsg} onClick={saveIdentity}>
                Continue →
              </button>
            </div>
          ) : (
            <div className="panel panel-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <span className="section-tag">Step 2 of 2</span>
                  <h3 style={{ margin: '4px 0 0' }}>Your nomination</h3>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                    Nominating as {yourName} · {yourRole}
                  </div>
                </div>
                <button className="small-btn" onClick={() => setIdentified(false)}>Change details</button>
              </div>

              <div className="divider-label">the award</div>

              <div className={`field ${errors.award ? 'invalid' : ''}`}>
                <label>Award *</label>
                <select value={awardId} onChange={e => setAwardId(e.target.value)}>
                  <option value="">Select an award…</option>
                  {nominable.map(s => (
                    <optgroup key={s.key} label={`${s.emoji || ''} ${s.label}`}>
                      {s.awards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </optgroup>
                  ))}
                </select>
                {errors.award && <div className="err-msg">Please choose an award.</div>}
                {selected?.notes && <div className="hint" style={{ fontSize: '11.5px', color: 'var(--ink-soft)', marginTop: 6 }}>📌 {selected.notes}</div>}
              </div>

              <div className={`field ${errors.name ? 'invalid' : ''}`}>
                <label>Who are you nominating? *</label>
                <input type="text" value={nomineeName} onChange={e => setNomineeName(e.target.value)} placeholder="Full name" />
                {errors.name && <div className="err-msg">Please enter the nominee's name.</div>}
              </div>

              <div className="two-col">
                <div className="field">
                  <label>Class / Form (if a student)</label>
                  <input type="text" value={nomineeClass} onChange={e => setNomineeClass(e.target.value)} placeholder="e.g. 2 Science B" />
                </div>
                <div className="field">
                  <label>House / Department</label>
                  <input type="text" value={nomineeHouse} onChange={e => setNomineeHouse(e.target.value)} placeholder="e.g. Business Dept" />
                </div>
              </div>

              <div className={`field ${errors.reason ? 'invalid' : ''}`}>
                <label>Why do they deserve it? *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Give the committee something concrete — what they actually did this year." />
                {errors.reason && <div className="err-msg">Please write at least a sentence.</div>}
              </div>

              <div className={`field ${errors.photo ? 'invalid' : ''}`}>
                <label>Photo {config?.free_photo_required ? '*' : '(optional)'}</label>
                <div className="photo-drop" onClick={() => fileInputRef.current?.click()}>
                  {photoDataUrl
                    ? <img src={photoDataUrl} alt="Preview" />
                    : <div className="ph-empty">Tap to add a photo of the nominee<br /><span style={{ fontSize: 11 }}>Helpful for the awards programme, not required</span></div>}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" style={{ display: 'none' }} onChange={handlePhoto} />
                {errors.photo && <div className="err-msg">A photo is required for this round.</div>}
              </div>

              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting || !!closedMsg} onClick={submit}>
                {submitting ? 'Submitting…' : 'Submit nomination →'}
              </button>
            </div>
          )}

          {/* ------------------------------------------- awarded on record */}
          {onRecord.length > 0 && (
            <div className="panel panel-pad" style={{ marginTop: 22 }}>
              <span className="section-tag">No nomination needed</span>
              <h3 style={{ margin: '6px 0 6px' }}>Awarded from official records</h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px' }}>
                These are settled by examination results and service records, so there is nothing to nominate.
                Heads of Department and the ICT Unit compile them for the Awards Committee.
              </p>
              {onRecord.map(s => (
                <div key={s.key} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.emoji} {s.label}</div>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--ink-soft)', fontSize: 13, lineHeight: 1.8 }}>
                    {s.awards.map(a => <li key={a.id}>{a.name}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
