-- Relance du soir (recap de la journée + plan pour le lendemain), en plus
-- des relances quotidienne/hebdo/mensuelle déjà en place.
alter table public.ia_coaching add column if not exists last_evening_at date;
