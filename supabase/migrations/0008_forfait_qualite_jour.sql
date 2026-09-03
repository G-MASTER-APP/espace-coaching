-- Phase 8 (polish) : le forfait est un cycle fixe de 3 mois démarré par le
-- coach (plus de choix semaine/mois), + qualité de la journée et commentaire
-- quotidien.

alter table public.coaching_goals drop column if exists package_period;
alter table public.coaching_goals
  add column if not exists package_start_date date not null default current_date;

alter table public.coaching_daily_logs
  add column if not exists day_quality smallint check (day_quality between 1 and 5);
alter table public.coaching_daily_logs
  add column if not exists day_comment text;
