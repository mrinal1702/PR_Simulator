-- Reputation Recovery Simulator — initial schema
-- Run in Supabase SQL Editor or via supabase db push

-- Reference: build definitions (seeded; app can read-only)
create table public.build_definitions (
  id text primary key,
  display_name text not null,
  starting_eur bigint not null check (starting_eur >= 0),
  starting_competence smallint not null check (starting_competence between 0 and 100),
  starting_visibility smallint not null check (starting_visibility between 0 and 100),
  starting_firm_capacity smallint not null check (starting_firm_capacity between 0 and 100),
  total_v_equivalent numeric(12, 6) not null,
  opening_hire_rule text,
  created_at timestamptz not null default now()
);

-- Player profile (one row per auth user)
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  gender text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Spouse type enum via check (matches game design)
-- supportive | influential | rich | none

-- One game run (save) per user session; extend later
create table public.game_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  build_id text not null references public.build_definitions (id),
  spouse_type text not null default 'none'
    check (spouse_type in ('supportive', 'influential', 'rich', 'none')),
  spouse_name text,
  spouse_gender text,
  -- Snapshot after applying build + spouse at run creation
  eur bigint not null,
  competence smallint not null,
  visibility smallint not null,
  firm_capacity smallint not null,
  season_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_runs_profile_id_idx on public.game_runs (profile_id);

-- Log end-of-season grants (spouse bonuses; capacity has no recurring grant except design)
create table public.season_grants (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.game_runs (id) on delete cascade,
  season_number integer not null check (season_number >= 1),
  eur_granted bigint not null default 0,
  competence_granted smallint not null default 0,
  visibility_granted smallint not null default 0,
  firm_capacity_granted smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, season_number)
);

-- Seed builds (equal Total_V = 2.575 before spouse)
insert into public.build_definitions (
  id, display_name, starting_eur, starting_competence, starting_visibility,
  starting_firm_capacity, total_v_equivalent, opening_hire_rule
) values
  (
    'velvet_rolodex',
    'The Velvet Rolodex',
    16000,
    30,
    80,
    50,
    2.575,
    'Two junior employees (salary bands 16k–30k EUR / year)'
  ),
  (
    'summa_cum_basement',
    'Summa Cum Basement',
    16000,
    80,
    30,
    50,
    2.575,
    'Two junior employees (salary bands 16k–30k EUR / year)'
  ),
  (
    'portfolio_pivot',
    'The Portfolio Pivot',
    80000,
    22,
    24,
    50,
    2.575,
    'One mid-tier at top of band (up to 70k EUR / year class)'
  );

-- RLS
alter table public.profiles enable row level security;
alter table public.game_runs enable row level security;
alter table public.season_grants enable row level security;

-- Profiles: only owner
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id);

-- Game runs: only via own profile
create policy "game_runs_select_own"
  on public.game_runs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = game_runs.profile_id and p.user_id = auth.uid()
    )
  );

create policy "game_runs_insert_own"
  on public.game_runs for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = game_runs.profile_id and p.user_id = auth.uid()
    )
  );

create policy "game_runs_update_own"
  on public.game_runs for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = game_runs.profile_id and p.user_id = auth.uid()
    )
  );

-- Season grants: same as parent run
create policy "season_grants_select_own"
  on public.season_grants for select
  using (
    exists (
      select 1 from public.game_runs g
      join public.profiles p on p.id = g.profile_id
      where g.id = season_grants.run_id and p.user_id = auth.uid()
    )
  );

create policy "season_grants_insert_own"
  on public.season_grants for insert
  with check (
    exists (
      select 1 from public.game_runs g
      join public.profiles p on p.id = g.profile_id
      where g.id = season_grants.run_id and p.user_id = auth.uid()
    )
  );

-- build_definitions: readable by any authenticated user (reference data)
alter table public.build_definitions enable row level security;

create policy "build_definitions_select_authenticated"
  on public.build_definitions for select
  to authenticated
  using (true);
