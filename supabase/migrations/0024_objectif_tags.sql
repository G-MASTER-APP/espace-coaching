-- Objectif du client en cases à cocher (rapide, structuré) plutôt que
-- seulement en texte libre dans la conversation. Choisi dès l'onboarding
-- (avant même la discussion avec l'IA) et modifiable ensuite à tout moment
-- depuis un onglet dédié — l'IA en tient compte pour ajuster le programme.
alter table public.ia_coaching add column if not exists objectif_tags text[] not null default '{}';
