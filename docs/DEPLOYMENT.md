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

## 2. Vercel

1. Push this repo to GitHub/GitLab/Bitbucket (see **Git** below).
2. Import the repo in [Vercel](https://vercel.com).
3. Set **Root Directory** to `web` (important).
4. Set **Environment Variables** (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy. The placeholder page at `/` should build and show the build table.

### Local preview

```bash
cd web
copy .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm install
npm run dev
```

---

## 3. Git (first push)

This folder may not be a git repo yet. From the repo root:

```bash
git init
git add .
git commit -m "Initial PR Simulator design, Supabase schema, Next.js shell"
```

Create an empty repository on GitHub (no README), then:

```bash
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

Use your Git host; SSH URLs work too.

---

## 4. What you still need to do

- [ ] Run the SQL migration in Supabase.
- [ ] Add `profiles` creation on first login (Supabase Auth + insert).
- [ ] Implement onboarding UI (name, gender, build, spouse) and insert `game_runs`.
- [ ] Apply `season_grants` at end of each season (server action or Edge Function with service role).
- [ ] Tune spouse numbers (25 / 25k) in `web/lib/gameEconomy.ts` and design docs.

---

## 5. File reference

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260407120000_initial_schema.sql` | Schema + seed builds + RLS |
| `web/lib/gameEconomy.ts` | Spouse math + `totalV()` |
| `data/build_value_budget.txt` | Equal-build Total_V explanation |
| `web/.env.local.example` | Env template for Vercel |
