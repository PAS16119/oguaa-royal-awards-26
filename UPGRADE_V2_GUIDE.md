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

## 10. Environment variables, complete list

| Name | Where it comes from | Needed for |
|---|---|---|
| `DATABASE_URL` | Neon / Vercel Storage | everything |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob integration | photos |
| `SESSION_SECRET` | `openssl rand -base64 32` | admin & agent login |
| `PAYSTACK_SECRET_KEY` | Paystack → API Keys | online purchase only |

Never put any of these in the repo. They belong only in Vercel's environment
variable screen.
