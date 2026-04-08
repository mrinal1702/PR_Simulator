-- Hiring rules config for employee system rollout.
-- Stores tunable values and locked UX rules referenced by the app layer.

create table if not exists public.employee_hiring_rules (
  id uuid primary key default gen_random_uuid(),
  season_number integer not null check (season_number >= 1),
  max_hires smallint not null check (max_hires >= 0),
  created_at timestamptz not null default now(),
  unique (season_number)
);

create table if not exists public.employee_hiring_ux_rules (
  key text primary key,
  value_text text not null,
  created_at timestamptz not null default now()
);

alter table public.employee_hiring_rules enable row level security;
alter table public.employee_hiring_ux_rules enable row level security;

create policy "employee_hiring_rules_select_public"
  on public.employee_hiring_rules for select
  to anon, authenticated
  using (true);

create policy "employee_hiring_ux_rules_select_public"
  on public.employee_hiring_ux_rules for select
  to anon, authenticated
  using (true);

insert into public.employee_hiring_rules (season_number, max_hires) values
  (1, 2),
  (2, 3),
  (3, 4)
on conflict (season_number) do update
set max_hires = excluded.max_hires;

insert into public.employee_hiring_ux_rules (key, value_text) values
  ('round_1_hire_cap_banner', 'Max hires this pre-season: 2'),
  ('post_hire_route', 'return_to_hiring_main_screen'),
  ('require_reselect_after_hire', 'true'),
  ('show_back_button', 'true'),
  ('back_button_policy', 'navigate_previous_no_undo_for_irreversible_actions'),
  ('show_return_to_agency_button', 'true'),
  ('autosave_on_hire', 'true'),
  ('hire_is_irreversible', 'true')
on conflict (key) do update
set value_text = excluded.value_text;
