-- Le client choisit le nom de son Coach IA (personnalisation) — l'IA se
-- présente ensuite sous ce nom, tandis que le coach continue de voir
-- "Coach IA" comme étiquette générique dans son propre suivi.
alter table public.ia_coaching add column if not exists ai_name text;
