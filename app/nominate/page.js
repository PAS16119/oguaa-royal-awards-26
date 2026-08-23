'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Seal, Toast, toast } from '../components';
import { SECTIONS } from '@/lib/categories';

export default function NominatePage() {
  const router = useRouter();
  const [unlockCode, setUnlockCode] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(null); // code string once unlocked
  const [submitted, setSubmitted] = useState(null); // {nomineeName, category, sectionLabel, id}

  const [category, setCategory] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeClass, setNomineeClass] = useState('');
  const [nomineeHouse, setNomineeHouse] = useState('');
  const [reason, setReason] = useState('');
  const [yourName, setYourName] = useState('');
  const [yourPhone, setYourPhone] = useState('');
  const [relation, setRelation] = useState('Classmate / Friend');
  const [consent, setConsent] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  async function unlockForm() {
    const raw = unlockCode.trim().toUpperCase();
    if (!raw) { setUnlockErr('Enter your access code.'); return; }
    setUnlocking(true);
    setUnlockErr('');
    try {
      const res = await fetch(`/api/codes/${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!data.found) setUnlockErr('Code not found. Check for typos and try again.');
      else if (data.status === 'used') setUnlockErr('This code has already been used.');
      else if (data.status === 'void') setUnlockErr('This code was voided by the committee.');
      else { setUnlocked(raw); toast('Code unlocked — fill in the form below'); }
    } catch {
      setUnlockErr('Something went wrong. Try again.');
    }
    setUnlocking(false);
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
        setErrors(e => ({ ...e, photo: false }));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function submitNomination() {
    const errs = {};
    if (!category) errs.category = true;
    if (!nomineeName.trim()) errs.name = true;
    if (!photoDataUrl) errs.photo = true;
    if (!reason.trim()) errs.reason = true;
    if (!yourName.trim()) errs.yourName = true;
    if (!yourPhone.trim()) errs.yourPhone = true;
    if (!consent) errs.consent = true;
    setErrors(errs);
    if (Object.keys(errs).length > 0) { toast('Please complete all required fields'); return; }

    setSubmitting(true);
    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: photoDataUrl }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Photo upload failed');

      const [sectionKey, award] = category.split('|||');
      const section = SECTIONS.find(s => s.key === sectionKey);

      const res = await fetch('/api/nominations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: unlocked, sectionKey, sectionLabel: section.label, category: award,
          nomineeName: nomineeName.trim(), nomineeClass: nomineeClass.trim(), nomineeHouse: nomineeHouse.trim(),
          reason: reason.trim(), photoUrl: uploadData.url,
          nominatorName: yourName.trim(), nominatorPhone: yourPhone.trim(), relation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit nomination');

      setSubmitted({ nomineeName: nomineeName.trim(), category: award, sectionLabel: section.label, id: data.id });
    } catch (e) {
      toast(e.message || 'Something went wrong — please try again');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <Shell>
        <section className="block">
          <div className="wrap" style={{ maxWidth: 520 }}>
            <div className="panel panel-pad" style={{ textAlign: 'center' }}>
              <Seal id="conf" />
              <h2 style={{ margin: '14px 0 6px' }}>Nomination sealed 🎉</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.7 }}>
                <strong>{submitted.nomineeName}</strong> has been nominated for<br />
                <strong>{submitted.category}</strong> ({submitted.sectionLabel}).
              </p>
              <div className="banner banner-good" style={{ margin: '18px 0', justifyContent: 'center' }}>
                Tracking ID: <span className="mono" style={{ marginLeft: 6, fontWeight: 700 }}>{submitted.id}</span>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>The committee will review your submission. Good luck to your nominee!</p>
              <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={() => location.reload()}>
                Submit another (new code required) →
              </button>
            </div>
          </div>
        </section>
        <Toast />
      </Shell>
    );
  }

  if (!unlocked) {
    return (
      <Shell>
        <section className="block">
          <div className="wrap" style={{ maxWidth: 520 }}>
            <div className="panel panel-pad" style={{ textAlign: 'center' }}>
              <Seal id="nom" />
              <h2 style={{ margin: '14px 0 6px' }}>Enter your access code</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: '13.5px', marginBottom: 20 }}>One code unlocks exactly one nomination.</p>
              <div className="field">
                <input className="code-input mono" type="text" maxLength={12} placeholder="ORA-XXX-XXX"
                  value={unlockCode} onChange={e => setUnlockCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && unlockForm()} />
              </div>
              <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} disabled={unlocking} onClick={unlockForm}>
                {unlocking ? 'Checking…' : 'Unlock nomination form →'}
              </button>
              {unlockErr && <div className="banner banner-bad" style={{ marginTop: 14 }}>{unlockErr}</div>}
              <div className="divider-label">no code yet?</div>
              <button className="btn btn-outline-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={() => router.push('/access')}>
                How to get an access code
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
        <div className="wrap" style={{ maxWidth: 640 }}>
          <div className="section-head">
            <div>
              <span className="section-tag">Code {unlocked} · unlocked</span>
              <h2>Submit your nomination</h2>
              <div className="sub">Fields marked * are required. Take care with the photo — it will be used to make the nominee's flyer.</div>
            </div>
          </div>
          <div className="panel panel-pad">
            <div className={`field ${errors.category ? 'invalid' : ''}`}>
              <label>Award category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select a category…</option>
                {SECTIONS.map(s => (
                  <optgroup key={s.key} label={`${s.emoji} ${s.label}`}>
                    {s.awards.map(a => <option key={a} value={`${s.key}|||${a}`}>{a}</option>)}
                  </optgroup>
                ))}
              </select>
              {errors.category && <div className="err-msg">Please choose a category.</div>}
            </div>

            <div className={`field ${errors.name ? 'invalid' : ''}`}>
              <label>Nominee full name *</label>
              <input type="text" placeholder="e.g. Kwame Owusu" value={nomineeName} onChange={e => setNomineeName(e.target.value)} />
              {errors.name && <div className="err-msg">Please enter the nominee's name.</div>}
            </div>

            <div className="two-col">
              <div className="field">
                <label>Class / Form (if student)</label>
                <input type="text" placeholder="e.g. Form 3B" value={nomineeClass} onChange={e => setNomineeClass(e.target.value)} />
              </div>
              <div className="field">
                <label>House / Department (optional)</label>
                <input type="text" placeholder="e.g. Aggrey House" value={nomineeHouse} onChange={e => setNomineeHouse(e.target.value)} />
              </div>
            </div>

            <div className={`field ${errors.photo ? 'invalid' : ''}`}>
              <label>Nominee photo *</label>
              <div className="photo-drop" onClick={() => fileInputRef.current?.click()}>
                {photoDataUrl
                  ? <img src={photoDataUrl} alt="Preview" />
                  : <div className="ph-empty">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5A5478" strokeWidth="1.6"><path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" strokeLinecap="round" /></svg>
                      <br />Tap to upload a clear passport-style photo<br /><span style={{ fontSize: 11 }}>JPG or PNG · auto-optimized for flyers</span>
                    </div>}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              {errors.photo && <div className="err-msg">Please upload a photo of the nominee.</div>}
            </div>

            <div className={`field ${errors.reason ? 'invalid' : ''}`}>
              <label>Why do they deserve this title? *</label>
              <textarea placeholder="A few sentences the committee (and maybe the flyer) can use…" value={reason} onChange={e => setReason(e.target.value)} />
              {errors.reason && <div className="err-msg">Please tell us why they deserve it.</div>}
            </div>

            <div className="divider-label">nominator details</div>

            <div className="two-col">
              <div className={`field ${errors.yourName ? 'invalid' : ''}`}>
                <label>Your name *</label>
                <input type="text" placeholder="Your full name" value={yourName} onChange={e => setYourName(e.target.value)} />
                {errors.yourName && <div className="err-msg">Please enter your name.</div>}
              </div>
              <div className={`field ${errors.yourPhone ? 'invalid' : ''}`}>
                <label>Your phone number *</label>
                <input type="tel" placeholder="0XX XXX XXXX" value={yourPhone} onChange={e => setYourPhone(e.target.value)} />
                {errors.yourPhone && <div className="err-msg">Please enter a contact number.</div>}
              </div>
            </div>

            <div className="field">
              <label>Your relationship to the nominee</label>
              <select value={relation} onChange={e => setRelation(e.target.value)}>
                <option>Classmate / Friend</option>
                <option>Self-nomination</option>
                <option>Teacher / Staff</option>
                <option>Family</option>
                <option>Other</option>
              </select>
            </div>

            <div className={`field ${errors.consent ? 'invalid' : ''}`}>
              <label className="checkbox-row">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                I confirm the nominee is aware of this nomination and consents to their photo being used on campaign flyers and materials for this event. *
              </label>
              {errors.consent && <div className="err-msg">Consent is required to submit.</div>}
            </div>

            <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={submitting} onClick={submitNomination}>
              {submitting ? 'Sealing your nomination…' : 'Seal & submit nomination →'}
            </button>
          </div>
        </div>
      </section>
      <Toast />
    </Shell>
  );
}
