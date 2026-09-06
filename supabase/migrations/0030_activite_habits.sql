-- Dernière question d'onboarding : niveau d'activité (sédentaire ou non),
-- même principe à cases à cocher que sport/antécédents.
alter table public.ia_coaching
  add column if not exists activite_tags text[] not null default '{}',
  add column if not exists activite_details text;
