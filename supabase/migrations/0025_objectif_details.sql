-- Précision libre de l'objectif ("je veux perdre 5kg en 3 mois"), en plus
-- des cases à cocher — l'IA la lit pour orienter ses directives
-- quotidiennes vers ce but chiffré précis.
alter table public.ia_coaching add column if not exists objectif_details text;
