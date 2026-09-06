-- Étape d'onboarding "sport & matériel" + "antécédents médicaux" : jusqu'ici
-- posée en texte libre par l'IA dans le chat, remplacée par deux écrans à
-- cases à cocher (même principe que l'objectif) pour rester rapide et fiable
-- (l'IA ne devine/n'oublie jamais l'info, contrairement à une question posée
-- en langage naturel qui peut être sautée par le modèle).
alter table public.ia_coaching
  add column if not exists sport_tags text[] not null default '{}',
  add column if not exists sport_details text,
  add column if not exists antecedents_tags text[] not null default '{}',
  add column if not exists antecedents_details text;
