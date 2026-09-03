-- Base d'aliments courants, partagée par tous les comptes (pas de user_id),
-- gérée par le propriétaire du projet — pas d'écriture depuis l'app.
-- Complète la recherche Open Food Facts (parfois indisponible/flaky) avec
-- des valeurs de référence stables pour les aliments de base.
create table if not exists public.common_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  calories_per_100g numeric not null,
  protein_per_100g numeric not null,
  carbs_per_100g numeric not null,
  fat_per_100g numeric not null
);

-- Table volontairement petite (quelques centaines de lignes au plus) : une
-- recherche ilike sans index dédié reste instantanée, pas besoin de
-- pg_trgm ici.
alter table public.common_foods enable row level security;

drop policy if exists "common_foods_select" on public.common_foods;
create policy "common_foods_select"
  on public.common_foods for select
  to authenticated
  using (true);
