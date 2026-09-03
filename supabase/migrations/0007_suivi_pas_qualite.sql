-- Phase 8 (polish) : ajout des pas (objectif coach + suivi quotidien) et de
-- la qualité de sommeil (1-5) sur l'accompagnement. Additif uniquement.

alter table public.coaching_goals
  add column if not exists steps_target integer not null default 8000;

alter table public.coaching_daily_logs
  add column if not exists steps integer not null default 0;

alter table public.coaching_daily_logs
  add column if not exists sleep_quality smallint check (sleep_quality between 1 and 5);
