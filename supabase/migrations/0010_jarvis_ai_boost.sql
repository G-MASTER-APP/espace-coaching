-- Phase 8 (polish) : mode IA de Jarvis, contrôlé uniquement par le coach
-- (les clients héritent du réglage, pas de bouton de leur côté), + table des
-- phrases apprises (partagées entre le coach et ses clients, puisque les
-- intentions elles-mêmes — eau, sommeil, pas... — sont génériques).

alter table public.profiles add column if not exists ai_boost_enabled boolean not null default false;
alter table public.profiles add column if not exists ai_spend_cycle numeric not null default 0;
alter table public.profiles add column if not exists ai_spend_cycle_start date;
alter table public.profiles add column if not exists ai_spend_total numeric not null default 0;

-- Un client doit pouvoir lire le profil de SON coach (pour savoir si le
-- mode IA est activé) — jusqu'ici seul l'inverse (coach -> client) existait.
drop policy if exists "profiles_select_own_coach" on public.profiles;
create policy "profiles_select_own_coach"
  on public.profiles for select
  using (id in (select coach_id from public.profiles where id = auth.uid()));

alter publication supabase_realtime add table public.profiles;

create table if not exists public.jarvis_learned_phrases (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  action_id text not null,
  phrase text not null,
  created_at timestamptz not null default now()
);

create index if not exists jarvis_learned_phrases_coach_idx on public.jarvis_learned_phrases (coach_id);

alter table public.jarvis_learned_phrases enable row level security;

-- Lecture : le coach et tous ses clients (les phrases apprises profitent à
-- tout le monde, les intentions eau/sommeil/pas... sont les mêmes pour tous).
drop policy if exists "jarvis_learned_phrases_select" on public.jarvis_learned_phrases;
create policy "jarvis_learned_phrases_select"
  on public.jarvis_learned_phrases for select
  using (
    coach_id = auth.uid()
    or coach_id = (select coach_id from public.profiles where id = auth.uid())
  );

-- Écriture : coach uniquement (c'est lui qui "apprend" une phrase à Jarvis).
drop policy if exists "jarvis_learned_phrases_write" on public.jarvis_learned_phrases;
create policy "jarvis_learned_phrases_write"
  on public.jarvis_learned_phrases for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

alter publication supabase_realtime add table public.jarvis_learned_phrases;
