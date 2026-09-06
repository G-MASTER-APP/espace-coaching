-- Suivi des relances automatiques du Coach IA (quotidienne, hebdo, mensuelle)
-- pour ne pas relancer deux fois le même jour/la même semaine/le même mois.
alter table public.ia_coaching add column if not exists last_daily_at date;
alter table public.ia_coaching add column if not exists last_weekly_at date;
alter table public.ia_coaching add column if not exists last_monthly_at date;
