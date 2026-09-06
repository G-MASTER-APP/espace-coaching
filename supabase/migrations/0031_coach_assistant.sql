-- Assistant IA côté coach (pas le Coach IA du client) : aide Joris à
-- rédiger programme/diète/objectif pour SES clients suivis en direct
-- ("Coach Joris"). L'IA ne propose que des brouillons, jamais d'écriture
-- directe — c'est Joris qui valide avant que ça parte au client.

-- Programme structuré (séances musculation/cardio, même format que
-- Coach IA) en plus du lien Hevy/PDF existant, gardé tel quel.
alter table public.programs
  add column if not exists seances jsonb not null default '[]';

-- Objectif : n'existait que pour les clients Coach IA (table ia_coaching).
-- Même principe (tags + précision libre) pour un client suivi par Joris.
create table if not exists public.client_objectifs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tags text[] not null default '{}',
  details text,
  updated_at timestamptz not null default now()
);

drop trigger if exists client_objectifs_set_updated_at on public.client_objectifs;
create trigger client_objectifs_set_updated_at
  before update on public.client_objectifs
  for each row execute function public.set_updated_at();

alter table public.client_objectifs enable row level security;

drop policy if exists "client_objectifs_select" on public.client_objectifs;
create policy "client_objectifs_select"
  on public.client_objectifs for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "client_objectifs_write" on public.client_objectifs;
create policy "client_objectifs_write"
  on public.client_objectifs for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.client_objectifs;
