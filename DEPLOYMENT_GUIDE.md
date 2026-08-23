# Deploying Oguaa Royal Awards — Complete Beginner's Guide

This guide assumes you've never used GitHub, Vercel, or a database before.
Every step is spelled out — just follow along in order. It takes about
30–45 minutes the first time.

**What you're setting up, in plain terms:**
- **GitHub** — where your project's code lives online (like Google Drive, but for code)
- **Vercel** — the service that takes your code and turns it into a live website
- **Neon** — a free database that stores all your nominations, codes, and agents
- **Vercel Blob** — free storage for nominee photos

You will not need to touch a database or write any code yourself. You're
just clicking buttons and copying/pasting a few things.

---

## Before you start: a checklist

- [ ] A computer (Mac or Windows both work)
- [ ] An email address
- [ ] The project folder you downloaded from this chat, unzipped somewhere you can find it (e.g. your Desktop)
- [ ] About 30–45 minutes, uninterrupted

---

## Part 1 — Create your accounts

### 1.1 Create a GitHub account

1. Go to **[github.com](https://github.com)**
2. Click **Sign up**
3. Enter your email, create a password, pick a username
4. Verify your email when GitHub sends you a confirmation link

You now have a free GitHub account. Keep your username and password somewhere safe.

### 1.2 Create a Vercel account

1. Go to **[vercel.com](https://vercel.com)**
2. Click **Sign Up**
3. Choose **Continue with GitHub** — this links the two accounts together, which saves you a step later
4. Approve the connection when GitHub asks

You now have a free Vercel account, connected to your GitHub account.

---

## Part 2 — Put the project on GitHub

You have two options. **Option A is easier for a first-timer** — no typing commands at all.

### Option A: GitHub Desktop (recommended for beginners)

1. Download and install **[GitHub Desktop](https://desktop.github.com)** (free, works on Mac and Windows)
2. Open it and sign in with the GitHub account you just created
3. Click **File → Add Local Repository**
4. Click **Choose...** and select the `oguaa-royal-awards` folder you unzipped
5. GitHub Desktop will say "This directory does not appear to be a Git repository." — click **create a repository** in that same message
6. Leave the settings as they are and click **Create Repository**
7. You'll now see a list of all the project files on the left, all checked
8. At the bottom left, type a summary like `Initial version` and click **Commit to main**
9. Click **Publish repository** at the top
10. **Untick "Keep this code private"** only if you're comfortable with the code being public — otherwise leave it ticked (private is the safer default for something with login logic in it, even though no secrets are stored in the code itself)
11. Click **Publish Repository**

Your code is now on GitHub. You can see it by going to `github.com/YOUR-USERNAME/oguaa-royal-awards` in your browser.

### Option B: Using the command line (if you're comfortable with a terminal)

Open Terminal (Mac) or Command Prompt/PowerShell (Windows), then:

```bash
cd path/to/oguaa-royal-awards
git init
git add .
git commit -m "Initial version"
```

Then create an empty repository on GitHub (github.com → the **+** icon top-right → **New repository** → name it `oguaa-royal-awards` → **do not** initialize with a README → **Create repository**). GitHub will then show you commands like these — run them:

```bash
git remote add origin https://github.com/YOUR-USERNAME/oguaa-royal-awards.git
git branch -M main
git push -u origin main
```

---

## Part 3 — Import the project into Vercel

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. You'll see a list of your GitHub repositories — find `oguaa-royal-awards`
3. Click **Import** next to it
4. Vercel will detect it's a Next.js project automatically — you don't need to change any build settings
5. **Don't click Deploy yet** — scroll down, you need to add some settings first (Part 4 and 5 below). If you already clicked Deploy, that's fine too — the first deploy will fail because the database isn't set up yet, and you'll just redeploy after finishing the steps below.

Keep this browser tab open — you'll come back to it.

---

## Part 4 — Set up your database (Neon Postgres)

This is where all your nominations, access codes, and agent accounts will live.

1. In your Vercel project (the page from Part 3), click the **Storage** tab
2. Click **Create Database**
3. Choose **Postgres** — this is powered by a service called Neon
4. Give it a name, e.g. `oguaa-db`
5. Choose a region close to Ghana — **Europe (Frankfurt / eu-central-1)** is usually the closest and fastest option; any region works, this just affects speed slightly
6. Click **Create**
7. Vercel automatically connects this database to your project and creates a `DATABASE_URL` setting for you — you don't need to copy or type anything

### 4.1 Set up the tables (one-time, copy-paste step)

Your database exists, but it's empty — it doesn't yet know about "nominations" or "codes" or "agents." You need to run one setup script, once, ever.

1. Still in the **Storage** tab, click on your new database
2. Look for a button/tab called **Query** or **SQL Editor** (sometimes it opens the Neon dashboard in a new tab — that's fine, it's the same database)
3. Open the file `lib/schema.sql` from your project folder on your computer, using any text editor (Notepad, TextEdit, VS Code — anything that opens plain text)
4. Select **all** the text in that file and copy it (Ctrl+A / Cmd+A, then Ctrl+C / Cmd+C)
5. Paste it into the SQL Editor / Query box in Neon or Vercel
6. Click **Run** (or **Execute**)

You should see a success message. If you see red error text instead, check the **Troubleshooting** section near the bottom of this guide.

That's it — your database now has all the tables it needs.

---

## Part 5 — Set up photo storage (Vercel Blob)

This is where nominee photos will actually be stored.

1. Back in your Vercel project, still on the **Storage** tab
2. Click **Create Database** again
3. This time choose **Blob**
4. Give it a name, e.g. `oguaa-photos`
5. Click **Create**

Same as before — Vercel automatically wires this up for you (it creates a setting called `BLOB_READ_WRITE_TOKEN`). Nothing to copy.

---

## Part 6 — Add one more setting (SESSION_SECRET)

This is a random password-like string that keeps admin/agent logins secure. You need to generate one and add it yourself — it's the only manual setting in the whole process.

### Generate a random string

Pick whichever is easiest for you:

- **If you have Terminal/Command Prompt open:** run
  ```bash
  openssl rand -base64 32
  ```
  and copy the output (a long jumble of letters, numbers and symbols).

- **If you don't want to use a terminal at all:** go to
  **[1password.com/password-generator](https://1password.com/password-generator)**
  (or any password generator site), set the length to at least 40 characters,
  and copy the result. It doesn't need to be memorable — you'll never type it
  again yourself.

### Add it to Vercel

1. In your Vercel project, click **Settings** (top navigation)
2. Click **Environment Variables** in the left sidebar
3. In the **Key** box, type: `SESSION_SECRET`
4. In the **Value** box, paste the random string you just generated
5. Leave it applied to all environments (Production, Preview, Development all ticked)
6. Click **Save**

---

## Part 7 — Deploy

1. Go to the **Deployments** tab of your Vercel project
2. If you see a failed deployment from earlier, click the three dots next to it and choose **Redeploy** — now that the database, storage, and secret are all set up, it will succeed this time
3. If this is your first deploy, go to the project's main page and click **Deploy**
4. Wait 1–3 minutes while Vercel builds your site — you'll see a progress log
5. When it finishes, you'll see **Congratulations!** and a preview of your live site

Click **Visit** (or the domain link, something like `oguaa-royal-awards.vercel.app`) — your nomination portal is now live on the internet.

---

## Part 8 — First-time setup on your live site

1. Open your live site
2. Scroll to the footer and click **Committee & agent access**
3. Make sure the **Main Admin** tab is selected
4. Since nobody has set up a PIN yet, you'll see a **"Create your main admin PIN"** form
5. Choose a PIN that's at least 6 characters (can be numbers, letters, or both) — this is *your* PIN, don't share it with agents
6. Confirm it and click **Create main admin PIN**

You're now logged in as Main Admin.

### Configure your event

1. Click the **Settings** tab
2. Fill in:
   - **Nominations open on** / **close on** — format `YYYY-MM-DD`, e.g. `2026-09-10`
   - **Price per nomination** — e.g. `10`
   - **MoMo network / number / registered name** — this is only shown to nominators as *information*, so they know where to send money; it doesn't process real payments
3. Click **Save settings**

### Create your sales agents

1. Click the **Agents** tab
2. Type a name (e.g. `Front Office — Miss Adjei`) and click **Create agent**
3. You'll be shown an **Agent ID** (like `AGT-4821`) and a **6-digit PIN** — write these down immediately, or take a screenshot. This is the only time the PIN is ever shown.
4. Repeat for each agent/sales point you want
5. Hand each agent their own ID + PIN, in person or by a secure message — not posted publicly

---

## Part 9 — Test it before telling anyone about it

Do a full dry run yourself before sharing the link:

1. **As Main Admin**, go to **Access Codes → generate 1 code** for yourself
2. Open your site in a private/incognito browser window (so you're not logged in as admin)
3. Go to **Nominate**, enter the test code, fill out a fake nomination with a real photo
4. Submit it
5. Go back to your admin dashboard → **Nominations** tab — you should see your test entry, with the photo showing
6. Try **Export → Download Excel** and **Download photos (.zip)** — open both to confirm they work
7. Delete/ignore the test entry later, or leave it — it won't affect real data

If all of that worked, you're ready to share the link publicly.

---

## Part 10 — Sharing the link

Your live URL (something like `https://oguaa-royal-awards.vercel.app`) is what you share with:
- Your committee and agents (they'll use the **Committee & agent access** footer link to log in)
- Everyone else (they'll use **Get Access** and **Nominate** like any normal visitor)

Optional: in Vercel → **Settings → Domains**, you can attach a custom domain
(like `nominate.ostechalumni.org`) if you own one — not required, the free
`.vercel.app` link works perfectly well.

---

## Ongoing maintenance

- **Export regularly.** Use **Export → Download Excel** and **Download photos**
  periodically, especially as the closing date approaches — treat these as
  your backup, even though Neon and Blob are reliable on their own.
- **Watch your usage.** Free tiers are generous but not infinite. Check
  usage occasionally at [neon.tech](https://neon.tech) (or Vercel's Storage
  tab) and [vercel.com](https://vercel.com) → Storage → Blob. If you're
  approaching limits, Neon and Vercel Blob can both be upgraded independently
  for a few dollars a month.
- **Rotate PINs if you're ever unsure.** Main Admin → Settings → Change PIN,
  or Agents tab → Reset PIN for any agent.
- **Making changes later:** if you (or I) ever update the code, the new
  version needs to reach GitHub again — in GitHub Desktop, that's **Commit**
  then **Push origin**. Vercel automatically redeploys within a minute or two
  of any push, with no extra steps.

---

## Troubleshooting

**"relation does not exist" or similar error when running schema.sql**
You probably only pasted part of the file. Go back to Part 4.1, re-select the
*entire* file content, and run it again — it's safe to run more than once
(it won't duplicate tables).

**Deployment fails with a build error**
Click into the failed deployment in Vercel and read the red text near the
bottom of the log. The most common cause is a missing environment variable —
double check `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `SESSION_SECRET`
all appear under Settings → Environment Variables.

**The site loads but "Get an access code" / login pages show a database error**
Usually means the schema script (Part 4.1) wasn't run, or was run against a
different database than the one attached to your project. Confirm in
Vercel → Storage that a Postgres database is attached to this exact project.

**I forgot my Main Admin PIN**
There's no "forgot PIN" flow by design (nobody, including you, can read PINs
back out — they're one-way encrypted). If you're truly locked out, open the
Neon SQL Editor and run:
```sql
DELETE FROM admin_auth WHERE id = 'main';
```
Then visit your site's admin page again — it will let you set up a fresh PIN,
exactly like the first time.

**An agent lost their PIN**
No need to touch the database for this one — Main Admin → Agents tab →
**Reset PIN** next to their name. This is the normal, intended way to handle it.

---

## Quick reference

| Thing | Where to find it |
|---|---|
| Your live site | Vercel project page → domain link, or `vercel.com/dashboard` |
| Database (Neon) | Vercel project → Storage tab, or neon.tech |
| Photo storage | Vercel project → Storage tab (Blob) |
| Environment variables | Vercel project → Settings → Environment Variables |
| Your code on GitHub | `github.com/YOUR-USERNAME/oguaa-royal-awards` |
| Redeploy manually | Vercel project → Deployments → ⋯ → Redeploy |
