# Oguaa Royal Awards — Version 2

Free nominations, online payment with Paystack, and an award list you can edit
yourself from the admin panel.

This guide assumes the site is already live at `ora26.vercel.app` and that you
followed `DEPLOYMENT_GUIDE.md` the first time. Everything here is an addition —
nothing you already have is thrown away, and nominations already in the database
stay exactly where they are.

---

## 1. What changed, in plain terms

**Two tracks now run side by side.**

| | Royal Awards (paid) | Anniversary Merit Awards (free) |
|---|---|---|
| Who nominates | Anyone with an access code | Any student, teacher or staff member |
| Cost | GH₵ per nomination (you set it) | Nothing |
| How they get in | Code from an agent, or bought online | Just name + phone number |
| Pages | `/access`, `/buy`, `/nominate` | `/nominate-free` |
| Fair-play rule | One code = one nomination | One person = one nomination per award |

**Not every award takes nominations.** Each award now carries a flag:

- **Open** — shows on the nomination form.
- **Records only** — appears on the site under “Awarded from official records”,
  with no form. Used for the subject and departmental bests, overall best
  student, best graduating student, retired staff and special honours, which
  come from exam records, service records or the Committee's own list.

You can flip any award between the two with one button in the admin panel, so
if the Committee decides that, say, Best Graduating Student should also take
nominations, you do not need me or a code change.

**The award list lives in the database now.** Admin → Awards lets you add,
rename, reorder, hide and delete groups and awards on either track, and paste a
whole list of awards at once. The nomination forms, the home page and the Excel
export all read from that list, so they update the moment you save.

**People can buy codes themselves.** If you switch it on, a buyer picks how many
codes they want, pays with MoMo or card through Paystack, and the codes appear
on screen the second Paystack confirms. Agents still work exactly as before —
this sits next to them, it does not replace them.

---

## 2. Files

New:

```
lib/schema-v2.sql              database migration + the seeded award list
lib/catalog.js                 reads the award list out of Postgres
lib/paystack.js                Paystack calls + code fulfilment
lib/seed-free.js               the free award list, as first seeded
app/api/catalog/route.js       award list for the public pages
app/api/catalog/sections/…     admin: add/edit/delete groups
app/api/catalog/awards/…       admin: add/edit/delete awards
app/api/payments/route.js      admin: online sales list
app/api/paystack/init/…        starts a checkout
app/api/paystack/verify/…      confirms a payment and issues codes
app/api/paystack/webhook/…     Paystack's own confirmation (the safety net)
app/buy/page.js                buy-a-code page
app/buy/callback/page.js       the "here are your codes" page
app/nominate-free/page.js      the free nomination form
app/admin/manage.js            Awards tab, Online Sales tab, new settings
```

Changed: `app/page.js`, `app/access/page.js`, `app/nominate/page.js`,
`app/components.js`, `app/admin/page.js`, `app/api/nominations/route.js`,
`app/api/config/route.js`, `app/api/public/summary/route.js`, `.env.example`.

`lib/categories.js` is no longer read by the app. It stays in the repo only as
the record of what the paid list looked like when it was seeded.

---

## 3. Put the new files in place

**If you use GitHub Desktop:** copy the new and changed files into your local
`oguaa-royal-awards-26` folder, overwriting when asked. GitHub Desktop will show
the changes. Write a summary like `v2: free nominations, Paystack, editable
awards`, click **Commit to main**, then **Push origin**.

**If you use the terminal:**

```bash
cd oguaa-royal-awards-26
# copy the files in, then:
git add .
git commit -m "v2: free nominations, Paystack, editable awards"
git push
```

Vercel starts building the moment you push. Give it about a minute. Do **not**
open the site yet — run the database step first, or the new pages will error.

---

## 4. Run the database migration (once)

1. Go to [neon.tech](https://neon.tech) → your project → **SQL Editor**
   (or open the database from your Vercel project's **Storage** tab).
2. Open `lib/schema-v2.sql`, copy **everything** in it.
3. Paste into the SQL Editor and click **Run**.
4. You should see a pile of `CREATE TABLE` / `INSERT` results with no red errors.

Check it worked:

```sql
SELECT s.track, count(*) FROM awards a
JOIN award_sections s ON s.key = a.section_key
GROUP BY 1;
```

You should get `paid` (the 42 Royal Award titles) and `free` (the 23 merit
awards from the criteria document).

The file is safe to run twice. It will not duplicate anything, and it will not
undo edits you have made in the admin panel.

---

## 5. Set up Paystack (skip if you only want free nominations)

Paystack is Ghana-friendly and settles to a local bank account. Fees are taken
per transaction, so decide with the Finance sub-committee whether the GH₵ price
should absorb the fee or be nudged up to cover it.

### 5.1 Get your keys

1. Create a business account at **paystack.com** and finish the KYC
   (certificate of registration, ID, settlement bank account). This is the part
   that takes time — start it days before you plan to open sales.
2. In the dashboard: **Settings → API Keys & Webhooks**.
3. Copy the **Secret Key**. Use `sk_test_…` first for testing; switch to
   `sk_live_…` when you go live.

### 5.2 Add the key to Vercel

1. Vercel → your project → **Settings → Environment Variables**.
2. Add:
   - Name: `PAYSTACK_SECRET_KEY`
   - Value: your `sk_test_…` key
   - Environments: tick **Production**, **Preview** and **Development**.
3. Save, then **Deployments → ⋯ on the latest one → Redeploy**. Environment
   variables only take effect on a fresh deploy.

The public key is never needed — the checkout is opened by Paystack itself, not
by the browser, so the secret key never leaves your server.

### 5.3 Add the webhook

1. Paystack dashboard → **Settings → API Keys & Webhooks → Webhook URL**.
2. Enter: `https://ora26.vercel.app/api/paystack/webhook`
   (use your custom domain instead if you have one).
3. Save.

This is the safety net. If a buyer's phone dies right after they approve the
MoMo prompt, Paystack still tells your server, the codes are still created, and
the buyer can open their callback link later to collect them.

### 5.4 Switch it on

Live site → **Committee & agent access** → Main Admin → **Settings** → *Free
nominations & online sales* → tick **Let people buy access codes themselves with
Paystack** → Save. If the tick box is greyed out, the key is missing or the
project has not been redeployed since you added it.

### 5.5 Test with a test card

With `sk_test_…` in place, go to `/buy`, buy one code, and at the Paystack
screen choose **Card** and use `4084 0840 8408 4081`, any future expiry, CVV
`408`, OTP `123456`. You should land back on your site with a real code. Check
**Admin → Online Sales** — the payment should read `paid`.

Then swap in the `sk_live_…` key, redeploy, and do **one** small real purchase
yourself (you can void that code afterwards from Admin → Access Codes).

---

## 6. Set up the free track

Admin → **Settings** → *Free nominations & online sales*:

- **Free merit-award nominations are open** — the master switch.
- **Opens / closes** — dates in `YYYY-MM-DD`. The form refuses submissions
  outside the window and shows people why.
- **Max free nominations per phone** — 6 by default. On top of this, the
  database itself refuses a second nomination from the same number for the same
  award, so nobody can stack a category.
- **Require a photo on free nominations** — leave off unless you want photos for
  the awards programme. Off is kinder to students on small data bundles.

Then Admin → **Awards** → **Free track** and go through the list with the Awards
sub-committee. Check that the Open / Records-only split matches what the
Committee agreed, add anything missing, hide anything dropped.

Suggested wording when you announce it:

> Merit Award nominations are free and open to every student and staff member.
> Go to ora26.vercel.app, tap **Free Awards**, enter your name and number once,
> then nominate for as many awards as you like — one nomination per award. The
> Awards Committee makes the final decision.

---

## 7. What to check before you announce anything

Work through this on the live site, in this order.

- [ ] Home page loads and shows both tracks with sensible numbers.
- [ ] `/nominate-free` lists the free awards, grouped, with the records-only
      ones in the panel at the bottom and no form.
- [ ] Submit one free nomination. It succeeds.
- [ ] Submit a second free nomination **for the same award from the same phone**.
      It is refused. This is the test that matters most.
- [ ] Submit a free nomination for a *different* award from the same phone. It
      succeeds.
- [ ] Admin → Nominations shows both, with the **free** badge and a filter.
- [ ] Admin → Awards: rename one award, reload `/nominate-free`, confirm the new
      name appears. Then rename it back.
- [ ] Admin → Awards: try to delete an award that already has a nomination.
      It refuses and tells you to hide it instead. That is correct.
- [ ] An agent logs in and generates a code. The old flow still works.
- [ ] Buy one code online. The code appears, and works on `/nominate`.
- [ ] Admin → Export downloads an Excel file with a **Track** column and one
      sheet per group, including the free groups.
- [ ] Close the free window (set the close date to yesterday) and confirm the
      form refuses submissions. Then set it back.

---

## 8. Day-to-day, during the campaign

- **Admin → Overview** — nominations by group, paid vs free at a glance.
- **Admin → Online Sales** — every checkout. A row stuck on `pending` means the
  buyer started and never finished; no code was issued and no money moved.
- **Admin → Audit Trail** — who generated what, who voided what, when.
- **Admin → Export** — the Excel workbook for the Awards sub-committee, plus the
  photo ZIP for whoever is designing the flyers and the programme.

Back up before the judging meeting: Neon → your project → **Backups**, or just
download the Excel export and keep a copy on Drive.

---

## 9. When something goes wrong

**"Failed to fetch" or a blank award list**
The migration has not been run, or it errored halfway. Re-run
`lib/schema-v2.sql` in the Neon SQL Editor and read the output for red text.

**The Paystack tick box is greyed out**
`PAYSTACK_SECRET_KEY` is missing, or the project was not redeployed after you
added it. Vercel → Settings → Environment Variables, then Deployments → Redeploy.

**A buyer paid but says they got no code**
Ask for their reference (it starts `ORA-`). Open
`https://ora26.vercel.app/buy/callback?reference=THEIR-REFERENCE` — it verifies
again and shows the codes. If it still says unpaid, check the transaction in the
Paystack dashboard; if Paystack itself shows it as failed or abandoned, no money
was taken and they should try again.

**Someone says the free form keeps rejecting them**
They have either hit the per-phone cap, or they already nominated for that exact
award. Both messages say which. Raise the cap in Settings if the Committee wants
more.

**A code was sold twice / an agent is suspect**
Admin → Audit Trail shows every code with who issued it and when it was used.
Void unused codes from Admin → Access Codes; deactivate the agent from
Admin → Agents. Used codes cannot be voided, deliberately.

**You need to undo an award list change**
There is no undo. Renaming is harmless — existing nominations keep the name they
were submitted under. Deleting is blocked once nominations exist, which is the
real protection.

---

## 10. v3 addendum — Co-Admin role

On top of everything above, v3 adds one more role: **Co-Admin**. It's for
committee members who should help run the nomination system day-to-day
without holding the keys to everything.

**What a Co-Admin can do:** Overview, Awards (add/edit/hide/delete
categories on either track), Access Codes (generate and view all of them,
not just their own), Online Sales, Voting Ballot (add/hide/remove
candidates), Vote purchases (view), Nominations (view and delete), Export,
Audit Trail, and change their own PIN.

**What only the Main Admin can still do:** manage Sales Agents, manage other
Co-Admins, change Settings (price, dates, MoMo details, the Paystack
on/off switches), manage vote packages ("premium levels") and their prices,
void a vote purchase, and change the Main Admin PIN. That split is
deliberate — day-to-day running is shared, but who has access and how money
moves stays with one person.

**Setup — one more database step, one more file:**

1. Run `lib/schema-v3.sql` once in the Neon SQL Editor, the same way you ran
   `schema.sql` and `schema-v2.sql` before it. It only adds one new table
   (`coadmins`) — nothing existing is touched.
2. Push the code as usual — several files changed to let Co-Admins in, and
   `app/api/coadmins/` and `app/api/auth/coadmin-login/route.js` are new.
3. Log in to `/admin` as Main Admin → new **Co-Admins** tab → **Create
   co-admin**. Give the person a name; you'll get back an ID (`ADM-XXXX`)
   and a one-time PIN — write both down and hand them over securely, the
   same as you would for a sales agent.
4. That person signs in at `/admin` → the **Co-Admin** pill tab, using their
   ID and PIN.

Deactivating a Co-Admin (rather than deleting) keeps their name attached to
everything they did in the Audit Trail — the same protection agents already
have.

## 11. v3 addendum — activating Paystack with your own account

Since you already have a Paystack account, here's the short path (this is
the same as section 5 above, condensed now that account creation is done):

1. **Get your secret key.** Paystack dashboard → **Settings → API Keys &
   Webhooks**. Copy the **Secret Key**. Start with the `sk_test_…` one —
   test the whole flow before touching real money.
2. **Add it to Vercel.** Project → **Settings → Environment Variables** →
   add `PAYSTACK_SECRET_KEY` with that value, ticked for Production, Preview
   and Development. Save, then **Deployments → Redeploy** — env vars only
   apply to a fresh build.
3. **Add the webhook.** Paystack → **Settings → API Keys & Webhooks →
   Webhook URL** → `https://ora26.vercel.app/api/paystack/webhook` → Save.
   (This one URL now serves both code purchases and vote purchases — see
   section 13 below.)
4. **Switch on code sales.** `/admin` → Main Admin → **Settings** → *online
   payment* → tick **Let people buy access codes themselves with Paystack**
   → Save. (If the tick box is greyed out, the key hasn't reached Vercel
   yet, or the project needs that redeploy.)
5. **Test it.** Go to `/buy`, pick 1 code, and at the Paystack screen choose
   **Card**, use `4084 0840 8408 4081`, any future expiry, CVV `408`, OTP
   `123456`. You should land back on the site holding a real code.
6. **Go live.** Swap `sk_test_…` for your `sk_live_…` key in the same
   Vercel field, redeploy, do one small real purchase yourself to confirm
   the money actually lands in your Paystack settlement account, then void
   that one test code from Admin → Access Codes.

**Agents keep working exactly as before** — nothing about turning Paystack
on changes how a committee member or sales agent generates a code in person.
The two paths run side by side: online purchase feeds codes into the same
`codes` table an agent's "I've been paid — generate" button does, just
tagged `source: paystack` instead of `source: offline`.

## 12. Environment variables (see the complete table in section 14)

## 13. v4 addendum — paid voting (fundraiser)

Voting sits on top of the paid Royal Awards track. Once a nomination has been
submitted and you've reviewed it, you (or a Co-Admin) explicitly promote it
onto the **ballot**, and from that point on, anyone can pay to vote for them.
Votes are unlimited — the point is fundraising for the free Anniversary Merit
Awards, not a one-person-one-vote election.

### How it fits together

```
Paid nomination submitted (existing flow, unchanged)
        ↓
Admin/Co-Admin reviews it, clicks "Add to ballot"  →  becomes a Candidate
        ↓
Public /vote page  →  pick candidate  →  pick a package or a custom count
        ↓
Paystack checkout  →  /vote/callback verifies  →  votes credited to candidate
        ↓
/vote/results — live public leaderboard
```

Nothing about the existing nomination or code-purchase flow changes. Voting
is a separate table, a separate set of pages, and reuses the same Paystack
account through a second, distinct kind of transaction.

### Setup

1. Run `lib/schema-v4.sql` once in the Neon SQL Editor (after v2 and v3).
   It adds `candidates`, `vote_packages`, `vote_payments`, and five new
   columns on `config`. Nothing existing is touched.
2. Push the code as usual.
3. `/admin` → **Voting → Ballot** → for each paid nomination you want
   voteable, click **Add to ballot**.
4. `/admin` → **Voting → Premium levels** (Main Admin only) → add your vote
   packages, e.g.:
   - Bronze — 50 votes — GH₵45
   - Silver — 150 votes — GH₵130
   - Gold — 350 votes — GH₵300

   A supporter can also skip packages and type a custom vote count at
   GH₵0.50–1 (whatever you set) per vote — both options show side by side.
5. `/admin` → **Settings** → *paid voting* section → set your per-vote price,
   tick **Voting is open**, optionally set open/close dates → Save.
6. Share `/vote` publicly.

### Why the security model holds up under real money

This is the part worth reading carefully, since a flaw here costs you real
cedis, not just a wrong number on a screen.

**1. Votes are never created except as a side effect of a confirmed
payment.** There is no `POST /api/votes` that just adds votes. The *only*
function that increments a candidate's vote count is `fulfilVotePayment()`
in `lib/votes.js`, and it only runs after Paystack itself has confirmed
`status: 'success'` on that specific reference.

**2. The price is computed entirely on the server, at the moment of
checkout** — from the vote package's stored price, or from the
admin-configured per-vote price times a bounded vote count. The browser
never sends an amount; even a modified request can't change what gets
charged or what gets credited, because the server looks up the price itself.

**3. Idempotent by payment reference.** Every checkout gets one reference
(`ORAV-...`). Before crediting anything, `fulfilVotePayment()` checks
whether that reference has already been marked `paid` — if so, it's a no-op.
This is what makes it safe that *both* the callback page (when the buyer's
browser returns) and the webhook (Paystack calling your server directly)
can call the same fulfilment function for the same payment. Whichever
arrives first does the work; whichever arrives second does nothing. Neither
can double-credit.

**4. Reused, proven webhook verification.** The same webhook endpoint that
already verifies code purchases (HMAC-SHA512 signature, timing-safe
comparison) now also handles vote purchases — it tells the two apart by the
reference prefix (`ORA-` for codes, `ORAV-` for votes) and calls the right
fulfilment function. One webhook URL, no new attack surface.

**5. The amount actually paid is checked, not assumed.** Before crediting
votes, the code compares what Paystack reports as paid against what was
recorded when the checkout was created. A payment for less than the
recorded amount is marked failed, not credited.

**6. Correction only through voiding, never editing.** If a purchase turns
out to be fraudulent (stolen card, chargeback, a mistake), Main Admin can
void it with a required reason. That subtracts the votes from the
candidate's tally and marks the transaction `voided` — but the original row
is never deleted. The Audit Trail keeps a permanent record of who voided
what and why.

**7. Money-affecting actions stay with the Main Admin.** Co-Admins can
curate the ballot (add/hide/remove candidates) — that's content work, same
tier as managing Awards. They cannot create or price a vote package, and
they cannot void a purchase. Those two require the Main Admin PIN.

**8. No voter PII on the public pages.** `/vote` and `/vote/results` show
candidate names, award categories, and vote tallies — never who voted, their
phone number, or their email. That data exists only in `vote_payments`,
visible to Admin/Co-Admin for accountability and dispute resolution.

### What to check before announcing it

- [ ] Add one real paid nomination to the ballot from **Voting → Ballot**.
- [ ] Add at least one package from **Voting → Premium levels**.
- [ ] Vote for it yourself with a real small payment. Confirm the vote count
      goes up by exactly the right amount, once.
- [ ] Reload `/vote/callback?reference=...` for that same payment a second
      time (or just refresh the page). Confirm the vote count does **not**
      increase again — this is the idempotency check that matters most.
- [ ] Check **Voting → Vote purchases** shows the transaction with the right
      amount, votes, and status.
- [ ] Try voiding that one test transaction as Main Admin. Confirm the vote
      count drops back down and the row still shows in the list, marked
      `voided` with your reason.
- [ ] Log in as a Co-Admin and confirm the **Void** button is not visible to
      them, and that **Premium levels** doesn't appear in their Voting tab.
- [ ] Check `/vote/results` shows the correct leaderboard, grouped by award.

## 14. Environment variables, complete list

| Name | Where it comes from | Needed for |
|---|---|---|
| `DATABASE_URL` | Neon / Vercel Storage | everything |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob integration | photos |
| `SESSION_SECRET` | `openssl rand -base64 32` | admin, co-admin & agent login |
| `PAYSTACK_SECRET_KEY` | Paystack → API Keys | online code purchase and paid voting |

Never put any of these in the repo. They belong only in Vercel's environment
variable screen.
