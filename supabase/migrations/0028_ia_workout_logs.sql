-- Séances loguées par le client depuis l'interface façon Hevy (poids/reps
-- par série, réellement effectués — peuvent différer de ce que l'IA avait
-- prescrit dans program.seances, ce n'est pas grave, c'est fait pour).
create table if not exists public.ia_workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  seance_nom text,
  exercices jsonb not null default '[]',
  completed_at timestamptz not null default now()
);

create index if not exists ia_workout_logs_client_idx on public.ia_workout_logs (client_id, completed_at);

alter table public.ia_workout_logs enable row level security;

drop policy if exists "ia_workout_logs_select" on public.ia_workout_logs;
create policy "ia_workout_logs_select"
  on public.ia_workout_logs for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));

drop policy if exists "ia_workout_logs_insert" on public.ia_workout_logs;
create policy "ia_workout_logs_insert"
  on public.ia_workout_logs for insert
  with check (client_id = auth.uid());

alter publication supabase_realtime add table public.ia_workout_logs;
