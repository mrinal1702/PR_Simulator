# Deploying PR Simulator (Supabase + Vercel)

## 1. Supabase project

1. Create a project at [https://supabase.com](https://supabase.com).
2. Open **SQL Editor** → **New query**.
3. Paste the full contents of `supabase/migrations/20260407120000_initial_schema.sql` and **Run**.
4. Confirm tables: `build_definitions`, `profiles`, `game_runs`, `season_grants`.
5. Under **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Auth (required for RLS)

1. **Authentication → Providers → Email** — enable **Email** (magic link or password).
2. RLS policies assume `auth.uid()` matches `profiles.user_id`. Flow:
   - User signs up / signs in.
   - App inserts one row into `profiles` with `user_id = auth.uid()`.
   - App creates `game_runs` linked to that `profile_id`.

If you need anonymous play before auth, add separate policies later (not in this migration).

---

## 2. Push the project to GitHub (do this before Vercel)

Vercel’s **Import Git Repository** needs your code on GitHub (or GitLab/Bitbucket). Your machine already has a local repo with commits; you only need a **remote** and a **push**.

### 2a. Create an empty repo on GitHub

1. Open [https://github.com/new](https://github.com/new).
2. **Repository name:** e.g. `PR_Simulator` or `Disaster_Agency_Simulator` (your choice).
3. Choose **Public** or **Private**.
4. **Do not** check “Add a README”, “Add .gitignore”, or “Choose a license” (keeps the first push simple).
5. Click **Create repository**.

GitHub will show commands; use the steps below instead so paths match your PC.

### 2b. Connect and push (Windows, PowerShell)

In a terminal, from your project root (folder that contains `web/` and `supabase/`):

```powershell
cd c:\Users\trive\PR_Simulator
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

- Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME` with the real values from the GitHub repo URL.
- If Git asks you to log in, use a **Personal Access Token** (GitHub → Settings → Developer settings → Personal access tokens) as the password when using HTTPS, or set up **SSH** and use the `git@github.com:...` URL instead of `https://...`.

If you see **“remote origin already exists”**, run:

```powershell
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

After this, your code is on GitHub and you can import it in Vercel.

---

## 3. Vercel: New project — what to click

### Import vs Skip

- **Import Git Repository** — **Use this.** Connects Vercel to GitHub so every push to `main` can trigger a new deployment. This is what you want.
- **Skip** — Deploys without linking Git (manual uploads or CLI). **Avoid for now**; you lose automatic deploys from pushes.

### Step-by-step in the Vercel dashboard

1. Log in at [https://vercel.com](https://vercel.com) (use **Continue with GitHub** if your code is on GitHub so Vercel can see your repos).
2. Click **Add New…** → **Project** (or **New Project**).
3. On **Import Git Repository**, find **your GitHub account** in the list. If the repo is missing, click **Adjust GitHub App Permissions** / **Configure GitHub App** and grant access to **all repos** or **only selected** repos, then pick your new repo.
4. Click **Import** next to `PR_Simulator` (or whatever you named it).

### Configure the project (critical)

On the **Configure Project** screen:

1. **Framework Preset:** should auto-detect **Next.js**. If not, choose Next.js.
2. **Root Directory** — click **Edit**, set it to **`web`**, then **Continue**.  
   The Next.js app lives in `web/`; if you leave root as `.`, the build will fail.
3. **Build and Output Settings** — defaults are usually fine (`npm run build` / Next default output).
4. **Environment Variables** — add (for **Production** and **Preview** — use “Select all” or add each twice if needed):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon public key  

   (Copy from Supabase → **Project Settings → API**.)

5. Click **Deploy**.

First deploy may take 1–2 minutes. When it’s green, open the **Visit** URL — you should see the placeholder page.

### After deploy

- Every `git push` to `main` will create a new deployment (unless you change settings).
- Redeploy from **Deployments** tab if you only changed env vars in Vercel.

### Local preview

```bash
cd web
copy .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm install
npm run dev
```

---

## 3b. Git: Supabase vs Vercel (common confusion)

- **Supabase “Account identities”** — how *you* log into Supabase (e.g. GitHub). Fine to leave as-is.
- **Supabase “Connections” / Git integrations** — optional extras (e.g. preview branches, some integrations). **Not required** for a normal Next.js app that talks to Supabase via URL + anon key.
- **Vercel “link a Git repo”** — this is the main workflow: connect **your GitHub/GitLab repo** to Vercel so pushes trigger deploys. That link is **between Vercel and Git**, not Supabase.

You do **not** need to connect Supabase to Git for the app to work. You **do** connect your **code repo** to Vercel when Vercel asks during “New project.”

---

## 4. Product vs cloud (current)

- **Shipped:** Full onboarding + pre-season through season + post-season loop in the **Next.js** app with **localStorage** persistence (`dma-save-slot`). No Supabase dependency for gameplay.
- **Supabase:** Schema and RLS in `supabase/migrations/` are ready for a future **cloud save / profiles / game_runs** layer. Until that is wired, agents should treat DB work as **optional infrastructure**, not required for local QA.
- **Follow-up when enabling cloud:** Auth → `profiles` row per user → `game_runs` linked to profile; migrate or mirror `NewGamePayload` to stored JSON; keep local slot as fallback if desired.

---

## 5. File reference

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260407120000_initial_schema.sql` | Schema + seed builds + RLS |
| `web/lib/gameEconomy.ts` | Spouse / build stats, `seasonSpouseGrants`, `totalV()` |
| `web/data/scenarios_*.json`, `web/data/scenario_database.json` | Scenario content (must live under `web/` when Vercel root is `web`) |
| `web/.env.local.example` | Env template for local / Vercel |
| `docs/AGENT_CONTEXT.md` | Engineering onboarding for the web app |
