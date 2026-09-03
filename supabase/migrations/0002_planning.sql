-- Phase 3 : Planning hebdomadaire.
-- Additif uniquement.

-- Trigger générique réutilisé par toutes les tables des phases suivantes.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.plannings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Lundi de la semaine ISO (Europe/Paris). Une ligne par semaine et par
  -- utilisateur : le "reset hebdomadaire" est simplement la création d'une
  -- nouvelle ligne, les anciennes restent en base comme historique.
  week_start date not null,
  -- Tableau de 7 entrées {done, note, priority}, index 0 = lundi.
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

drop trigger if exists plannings_set_updated_at on public.plannings;
create trigger plannings_set_updated_at
  before update on public.plannings
  for each row execute function public.set_updated_at();

alter table public.plannings enable row level security;

drop policy if exists "plannings_select" on public.plannings;
create policy "plannings_select"
  on public.plannings for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "plannings_insert" on public.plannings;
create policy "plannings_insert"
  on public.plannings for insert
  with check (public.is_owner_or_coach(user_id));

drop policy if exists "plannings_update" on public.plannings;
create policy "plannings_update"
  on public.plannings for update
  using (public.is_owner_or_coach(user_id))
  with check (public.is_owner_or_coach(user_id));

-- Sync temps réel coach <-> client.
alter publication supabase_realtime add table public.plannings;
