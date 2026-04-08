-- Hire feedback templates and locked behavior notes
-- This migration stores reusable popup copy for hiring outcomes.

create table if not exists public.employee_hire_feedback_templates (
  id uuid primary key default gen_random_uuid(),
  metric_type text not null check (metric_type in ('productivity', 'skill_quality')),
  band_index smallint not null check (band_index between 1 and 4),
  min_percent smallint not null check (min_percent between 0 and 100),
  max_percent smallint not null check (max_percent between 0 and 100),
  template_text text not null,
  created_at timestamptz not null default now(),
  unique (metric_type, band_index, template_text),
  check (min_percent <= max_percent)
);

alter table public.employee_hire_feedback_templates enable row level security;

create policy "employee_hire_feedback_templates_select_public"
  on public.employee_hire_feedback_templates for select
  to anon, authenticated
  using (true);

insert into public.employee_hire_feedback_templates
  (metric_type, band_index, min_percent, max_percent, template_text)
values
  -- Productivity bands (capacity driver)
  ('productivity', 1, 0, 25,  'Mostly decorative this cycle, but technically on payroll.'),
  ('productivity', 2, 25, 50, 'Some sparks of effort, but still warming up to agency speed.'),
  ('productivity', 3, 50, 75, 'Solid contributor: dependable output with room to sharpen.'),
  ('productivity', 4, 75, 100,'Absolute engine this cycle, quietly carrying real workload.'),

  -- Skill quality bands (how strong salary-band outcome is)
  ('skill_quality', 1, 0, 25,  'You found the budget mystery box version of this salary band.'),
  ('skill_quality', 2, 25, 50, 'Serviceable hire: not a steal, not a disaster, just workable.'),
  ('skill_quality', 3, 50, 75, 'Strong value pickup for this band, strategy team approves.'),
  ('skill_quality', 4, 75, 100,'Elite value hit: this salary band just overdelivered hard.')
on conflict do nothing;

-- Locked behavior notes for implementation:
-- 1) Hire button commits immediately; no undo/revert from hire popup.
-- 2) On hire:
--    - capacity += round(global_max_capacity_per_employee * productivity_percent / 100)
--    - role stat gains += rounded whole-number values from resolved skill outcome
-- 3) Popup shown immediately after hire; includes:
--    - one productivity message from band
--    - one skill-quality message from band
--    - transparent numeric values: productivity percent and skill stat increase
-- 4) All displayed skill/capacity numbers are whole integers (no decimals).
