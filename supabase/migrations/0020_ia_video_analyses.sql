-- Analyse vidéo/photo par l'IA pour les clients Coach IA — même fonctionnalité
-- que G-MASTER-PROGRAM (extraction de frames côté client, analyse par Claude),
-- mais le coût partage le même budget que le chat (ia_coaching.spend_*),
-- puisque c'est un seul et même "coach IA" avec une seule limite par client.
create table if not exists public.ia_video_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  exercise_name text,
  question text,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  feedback text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric,
  created_at timestamptz not null default now()
);

create index if not exists ia_video_analyses_client_idx on public.ia_video_analyses (client_id, created_at);

alter table public.ia_video_analyses enable row level security;

drop policy if exists "ia_video_analyses_select" on public.ia_video_analyses;
create policy "ia_video_analyses_select"
  on public.ia_video_analyses for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));

drop policy if exists "ia_video_analyses_insert" on public.ia_video_analyses;
create policy "ia_video_analyses_insert"
  on public.ia_video_analyses for insert
  with check (client_id = auth.uid());

drop policy if exists "ia_video_analyses_update" on public.ia_video_analyses;
create policy "ia_video_analyses_update"
  on public.ia_video_analyses for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

alter publication supabase_realtime add table public.ia_video_analyses;
