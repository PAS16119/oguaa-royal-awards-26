# Oguaa Royal Awards — USSD Voting (v5)

Lets anyone with a basic phone vote by dialing a shortcode, without a
smartphone or data. It sits **on top of** the voting system you already
have (`schema-v4.sql`, `lib/votes.js`, `/vote`) rather than beside it —
same `vote_payments` table, same Paystack webhook, same idempotent
vote-crediting. USSD is just a second front door into the same room.

```
Caller dials *928*XXX#
        ↓
Arkesel routes the session to POST /api/ussd
        ↓
lib/ussd.js — menu: pick candidate code → pick vote count → confirm
        ↓
lib/momo.js — Paystack Charge API debits their MoMo directly (no browser)
        ↓
Same /api/paystack/webhook you already have → fulfilVotePayment()
        ↓
Vote credited — exactly the same code path a web vote takes
```

---

## 1. Reality check on the USSD side (do this before writing any code)

This was the open question in the original brief, and it's worth being
direct about: **you cannot self-provision `*928*XXX#`.** In Ghana, USSD
short codes are regulated by the NCA as Special Numbering Resources. Two
real paths exist:

- **Shared shortcode + extension** (e.g. `*928*105#`) — you ride on a code
  an aggregator (Arkesel, Hubtel, NALO, Nsano) already owns. Fast (days),
  cheap (~GH₵300/month for a 3-digit extension per the brief), no NCA
  paperwork on your end.
- **Dedicated shortcode** (`*928#` alone) — pricier, 6–10 week NCA process.

For a two-week fundraiser, shared/extension is the only realistic option.
This guide assumes that.

**Confirm directly with Arkesel before launch** (I can't verify these from
here — no live account to test against):
- Exact field names in their webhook payload. I've built against their
  publicly documented example (`sessionID`, `userID`, `newSession`,
  `msisdn`, `userData`, `network` in; `message`, `continueSession` out) —
  double-check this against your own dashboard's docs the moment you have
  an account, since aggregators sometimes vary field names between API
  versions.
- Whether their session billing is strictly per-dial as documented, or has
  additional metering — determines how close to your 20,000/month session
  cap you'll get.
- Whether Arkesel offers a webhook signature/shared-secret mechanism.
  Their USSD callback isn't HMAC-signed the way Paystack's is, so I've
  only been able to add a shared-secret query-string check as a stopgap
  (§5 below) — ask if they have anything better.

---

## 2. What's new in this repo

```
lib/schema-v5.sql          candidates.ballot_code, config.results_public, ussd_sessions table
lib/momo.js                 Paystack Charge API — direct MoMo debit + OTP submission
lib/ussd.js                 the USSD menu state machine
app/api/ussd/route.js       the webhook Arkesel calls
```

Changed: `lib/codegen.js` (added `genBallotCode()`), `app/api/candidates/route.js`
(assigns a ballot code when a nomination is promoted to the ballot),
`app/api/config/route.js` + `app/admin/manage.js` (results-visibility toggle,
ballot codes shown in the admin Ballot tab), `app/vote/page.js` +
`app/vote/results/page.js` (hide tallies gracefully when that toggle is off),
`.env.example`.

## 3. Put the files in place, then migrate

Same as previous upgrades — copy the new/changed files in, commit, push.
Then, **once**, in the Neon SQL Editor: run `lib/schema-v5.sql` (after
v2/v3/v4). It backfills a ballot code for every candidate already on the
ballot, so nothing needs re-adding.

## 4. Set up Arkesel

1. Create an account at `sms.arkesel.com`, go to **USSD**, request a shared
   shortcode extension.
2. Set the callback URL to:
   `https://ora26.vercel.app/api/ussd?key=YOUR_USSD_WEBHOOK_SECRET`
3. In Vercel: **Settings → Environment Variables** → add
   `USSD_WEBHOOK_SECRET` (generate with `openssl rand -base64 32`, same
   value as in the URL above) → redeploy.
4. **Test with the simulator first** (Dashboard → USSD → Test your USSD
   service) — no real shortcode or money touched. Walk the full menu:
   welcome → enter a ballot code → enter vote count → confirm → (approve
   or enter OTP, depending on network) → done. Reuse the Paystack test
   card/MoMo flow from `UPGRADE_V2_GUIDE.md` §5.5 for the payment part.
5. Only after that works end-to-end, buy the extension for real and point
   it at the same tested endpoint.

## 5. Turn on the results-visibility toggle (optional)

`/admin` → Main Admin → **Settings** → *paid voting* → **Show live vote
totals publicly**. Off hides tallies on `/vote`, `/vote/results`, and the
USSD "check votes" option — people can still vote, they just can't see the
running count. Admin/Co-Admin views always show real numbers regardless.

---

## 6. Security review

**1. No new payment-security surface.** USSD doesn't create a second way
to move money — it creates a second *front door* to the exact same
`vote_payments` → webhook → `fulfilVotePayment()` pipeline your web
voting already uses. Every guarantee in `UPGRADE_V2_GUIDE.md` §13
(server-computed price, idempotent-by-reference, amount actually paid is
checked, void-not-edit) applies to USSD votes unchanged, because it's
the same code.

**2. Money only moves with the phone owner's own approval.** The USSD
session never charges anyone directly — it asks Paystack to *prompt* the
dialing number's MoMo PIN (MTN) or a voucher/OTP (Vodafone). Even a
forged request claiming to be from Arkesel can, at worst, send an
unwanted payment prompt to some phone number — it cannot complete a
charge without that phone's owner approving it. That caps the damage
of the missing webhook signature (below) at "nuisance," not "theft."

**3. Known gap: the Arkesel webhook isn't cryptographically verified.**
Unlike the Paystack webhook (HMAC-SHA512, timing-safe compare), Arkesel's
USSD callback has no documented signature scheme. I've added a shared
secret in the URL as a floor — confirm with Arkesel whether they offer
anything stronger (IP allowlisting, a signed header) and use it if so.

**4. Session state can't be hijacked into someone else's payment.**
Session ID and MSISDN are both supplied by Arkesel on every request, not
guessable from outside, and short-lived (rows are deleted the moment a
session ends). Worst case of a guessed/replayed session ID is continuing
someone else's *menu navigation* — not their payment, since the actual
charge is bound to the MSISDN Arkesel reports for that session, and
`chargeMobileMoney()` always uses `session.msisdn`, never anything from
free-text input.

**5. Rate limiting.** Nothing in this build throttles how often the
`/api/ussd` endpoint can be hit. Vercel's platform DDoS protection covers
raw volume; I haven't added an application-level cooldown per MSISDN. If
you see abuse (repeated charge-initiation attempts against the same
number), that's the first thing to add — flag it and I can build it in.

**6. Data protection (Ghana's Data Protection Act, 2012 / Act 843).**
You're collecting phone numbers (and, on the web side, names/emails) tied
to real payments — that's personal data processing under Ghanaian law.
Two things worth checking with the Committee or someone who can advise on
compliance specifically (I'm not a lawyer, and this genuinely needs one
if you're spreading this beyond the school):
   - Whether this scale/purpose requires **registering as a data
     controller with Ghana's Data Protection Commission** — there are
     exemptions for small-scale/non-commercial processing, but a public
     multi-network fundraiser is a borderline case worth a direct check.
   - A **visible privacy note** on `/vote` (and ideally referenced in the
     USSD flow, space permitting) saying what's collected and why — you
     already don't show voter PII publicly (§13.8 of the upgrade guide),
     which is the right instinct; a short public-facing notice makes that
     explicit rather than assumed.

**7. Terms/refund clarity.** Votes are effectively small donations —
worth a one-line, unambiguous note somewhere a voter sees before paying
("votes are a donation to the anniversary fund and are not refundable")
so nobody disputes a payment thinking it bought something returnable.

## 7. Hosting notes

Nothing here changes your hosting story — same Vercel + Neon setup handles
the added `ussd_sessions` table fine at this scale. Two housekeeping
items:

- **Stale sessions.** A session row is deleted the moment it ends
  normally, but an abandoned dial (caller just hangs up) leaves its row
  behind. It's harmless — nothing reads it after ~2.5 minutes since
  Arkesel's own session timeout means no further requests will reference
  that `sessionID` — but if you want it tidy, run this periodically
  (a Vercel Cron job hitting a small cleanup route, or just by hand):
  ```sql
  DELETE FROM ussd_sessions WHERE updated_at < now() - interval '10 minutes';
  ```
- **Back up before migrating.** Standard advice, worth repeating since
  this migration touches the live `candidates` table (adding + backfilling
  `ballot_code`): Neon's point-in-time restore covers you, but confirm it's
  enabled on your plan before running `schema-v5.sql` against production.

## 8. What to check before announcing it

- [ ] Confirm the exact Arkesel field names against their live dashboard
      docs (§1) — the code assumes the publicly documented shape.
- [ ] Full simulator run: welcome → vote → code → count → confirm →
      approve on an MTN test number → webhook fires → vote count goes up
      **once**.
- [ ] Same, on a network that returns `send_otp` (Vodafone) — confirm the
      OTP re-entry step works inside one USSD session.
- [ ] Dial an invalid ballot code, confirm it re-prompts instead of
      crashing the session.
- [ ] Turn **Show live vote totals publicly** off, confirm `/vote`,
      `/vote/results`, and the USSD "check votes" option all agree
      (hidden everywhere, not just on the web).
- [ ] Check **Voting → Ballot** in admin shows a ballot code for every
      candidate, including ones added before this migration.
- [ ] One real, small live payment via USSD end-to-end before opening it
      publicly, the same way §5.5/§11 of `UPGRADE_V2_GUIDE.md` recommend
      for the web flow.

## 9. What this doesn't do yet

- No SMS confirmation back to the voter once their vote is credited — the
  USSD session tells them to expect the charge, but there's no follow-up
  message. Arkesel's SMS API is available on the same account if you want
  this; straightforward to add once USSD itself is confirmed working.
- No automatic fallback if a network can't be mapped (`mapNetworkToProvider`
  returns null for anything other than MTN/AirtelTigo/Vodafone) — the
  session just points the caller to the web link instead.
- Not tested against a live Arkesel account — everything above is built
  against their public documentation and needs a real end-to-end run
  before you trust it with real money.
