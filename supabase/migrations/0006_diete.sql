-- Phase 7 : Diète (objectifs nutritionnels + journal alimentaire).
-- Additif uniquement.

-- Objectifs : définis uniquement par le coach, jamais réinitialisés.
create table if not exists public.nutrition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  calories_target integer not null default 2000,
  protein_target_g numeric not null default 120,
  carbs_target_g numeric not null default 250,
  fat_target_g numeric not null default 70,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists nutrition_goals_set_updated_at on public.nutrition_goals;
create trigger nutrition_goals_set_updated_at
  before update on public.nutrition_goals
  for each row execute function public.set_updated_at();

alter table public.nutrition_goals enable row level security;

drop policy if exists "nutrition_goals_select" on public.nutrition_goals;
create policy "nutrition_goals_select"
  on public.nutrition_goals for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "nutrition_goals_write" on public.nutrition_goals;
create policy "nutrition_goals_write"
  on public.nutrition_goals for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.nutrition_goals;

-- Aliments et recettes personnalisés du client ("Mes aliments").
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  is_recipe boolean not null default false,
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_user_id_idx on public.foods (user_id);

drop trigger if exists foods_set_updated_at on public.foods;
create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

alter table public.foods enable row level security;

drop policy if exists "foods_select" on public.foods;
create policy "foods_select"
  on public.foods for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "foods_write" on public.foods;
create policy "foods_write"
  on public.foods for all
  using (public.is_owner_or_coach(user_id))
  with check (public.is_owner_or_coach(user_id));

alter publication supabase_realtime add table public.foods;

-- Ingrédients d'une recette (snapshot des macros/100g au moment de l'ajout,
-- pas de FK vers un autre aliment : plus simple, une recette reste éditable
-- même si l'ingrédient d'origine change ou est supprimé).
create table if not exists public.food_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.foods (id) on delete cascade,
  name text not null,
  quantity_g numeric not null,
  calories_per_100g numeric not null default 0,
  protein_per_100g numeric not null default 0,
  carbs_per_100g numeric not null default 0,
  fat_per_100g numeric not null default 0
);

create index if not exists food_ingredients_recipe_id_idx on public.food_ingredients (recipe_id);

alter table public.food_ingredients enable row level security;

drop policy if exists "food_ingredients_all" on public.food_ingredients;
create policy "food_ingredients_all"
  on public.food_ingredients for all
  using (
    exists (
      select 1 from public.foods f
      where f.id = recipe_id and public.is_owner_or_coach(f.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.foods f
      where f.id = recipe_id and public.is_owner_or_coach(f.user_id)
    )
  );

-- Journal alimentaire quotidien.
create table if not exists public.food_log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  quantity_g numeric not null,
  -- Totaux pour la quantité loggée (pas des valeurs /100g) : évite de
  -- recalculer à chaque affichage et garde un historique fidèle même si
  -- l'aliment source est modifié/supprimé ensuite.
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  food_id uuid references public.foods (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists food_log_entries_user_date_idx
  on public.food_log_entries (user_id, log_date);

alter table public.food_log_entries enable row level security;

drop policy if exists "food_log_entries_select" on public.food_log_entries;
create policy "food_log_entries_select"
  on public.food_log_entries for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "food_log_entries_insert" on public.food_log_entries;
create policy "food_log_entries_insert"
  on public.food_log_entries for insert
  with check (public.is_owner_or_coach(user_id));

drop policy if exists "food_log_entries_delete" on public.food_log_entries;
create policy "food_log_entries_delete"
  on public.food_log_entries for delete
  using (public.is_owner_or_coach(user_id));

alter publication supabase_realtime add table public.food_log_entries;
