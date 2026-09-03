-- Phase 5 : Accompagnement (objectifs coach + suivi quotidien client).
-- Additif uniquement.

-- Objectifs : définis uniquement par le coach, ne se réinitialisent jamais.
create table if not exists public.coaching_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  water_target_l numeric not null default 2.5,
  sleep_target_h numeric not null default 8,
  diet_note text not null default 'Respecter le plan nutritionnel',
  package_sessions integer not null default 3,
  package_period text not null default 'week' check (package_period in ('week', 'month')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists coaching_goals_set_updated_at on public.coaching_goals;
create trigger coaching_goals_set_updated_at
  before update on public.coaching_goals
  for each row execute function public.set_updated_at();

alter table public.coaching_goals enable row level security;

drop policy if exists "coaching_goals_select" on public.coaching_goals;
create policy "coaching_goals_select"
  on public.coaching_goals for select
  using (public.is_owner_or_coach(user_id));

-- Seul le coach définit/modifie les objectifs (cible métier de cette page).
drop policy if exists "coaching_goals_write" on public.coaching_goals;
create policy "coaching_goals_write"
  on public.coaching_goals for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.coaching_goals;

-- Suivi quotidien : une ligne par jour, jamais supprimée (historique). La
-- page recalcule la date du jour (Europe/Paris) à chaque chargement et crée
-- la ligne du jour si besoin — équivalent du "reset nocturne" sans dépendre
-- d'un cron.
create table if not exists public.coaching_daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  log_date date not null,
  water_l numeric not null default 0,
  sleep_h numeric,
  diet_respected boolean,
  sessions_done integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists coaching_daily_logs_user_date_idx
  on public.coaching_daily_logs (user_id, log_date);

drop trigger if exists coaching_daily_logs_set_updated_at on public.coaching_daily_logs;
create trigger coaching_daily_logs_set_updated_at
  before update on public.coaching_daily_logs
  for each row execute function public.set_updated_at();

alter table public.coaching_daily_logs enable row level security;

drop policy if exists "coaching_daily_logs_select" on public.coaching_daily_logs;
create policy "coaching_daily_logs_select"
  on public.coaching_daily_logs for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "coaching_daily_logs_insert" on public.coaching_daily_logs;
create policy "coaching_daily_logs_insert"
  on public.coaching_daily_logs for insert
  with check (public.is_owner_or_coach(user_id));

drop policy if exists "coaching_daily_logs_update" on public.coaching_daily_logs;
create policy "coaching_daily_logs_update"
  on public.coaching_daily_logs for update
  using (public.is_owner_or_coach(user_id))
  with check (public.is_owner_or_coach(user_id));

alter publication supabase_realtime add table public.coaching_daily_logs;
