-- Phase 6 : Bilan de mensurations.
-- Additif uniquement. Chaque ligne est un bilan horodaté et immuable dans
-- l'esprit (on garde tout, pas de "reset") : l'historique EST la fonctionnalité.

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_at timestamptz not null default now(),
  -- { neck, shoulders, chest, biceps_left, biceps_right, waist, hips,
  --   thigh_left, thigh_right, calf_left, calf_right } en cm (pas de 5, 0-300)
  measurements jsonb not null default '{}'::jsonb,
  photos_url text,
  created_at timestamptz not null default now()
);

create index if not exists body_measurements_user_id_idx
  on public.body_measurements (user_id, measured_at desc);

alter table public.body_measurements enable row level security;

drop policy if exists "body_measurements_select" on public.body_measurements;
create policy "body_measurements_select"
  on public.body_measurements for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "body_measurements_insert" on public.body_measurements;
create policy "body_measurements_insert"
  on public.body_measurements for insert
  with check (public.is_owner_or_coach(user_id));

drop policy if exists "body_measurements_delete" on public.body_measurements;
create policy "body_measurements_delete"
  on public.body_measurements for delete
  using (public.is_owner_or_coach(user_id));

alter publication supabase_realtime add table public.body_measurements;
