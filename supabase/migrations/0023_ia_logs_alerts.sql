-- Poids suivi dans le bilan (absent jusqu'ici) — nécessaire pour que le
-- Coach IA puisse loguer le poids donné en conversation au même endroit
-- que les mensurations, plutôt que dans un silo séparé.
alter table public.body_measurements add column if not exists weight_kg numeric;

-- Alerte du Coach IA au coach humain : signal envoyé quand l'IA détecte
-- quelque chose qui dépasse son rôle (douleur/blessure, signal alimentaire
-- ou psychologique préoccupant...). Une seule alerte "active" à la fois par
-- client — le coach la marque comme vue pour l'effacer.
alter table public.ia_coaching add column if not exists alert_message text;
alter table public.ia_coaching add column if not exists alert_created_at timestamptz;
