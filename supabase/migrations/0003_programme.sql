-- Phase 4 : Programme & Vidéos.
-- Additif uniquement. Écriture réservée au coach (is_coach_of), lecture au
-- client + son coach (is_owner_or_coach).

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  program_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

alter table public.programs enable row level security;

drop policy if exists "programs_select" on public.programs;
create policy "programs_select"
  on public.programs for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "programs_write" on public.programs;
create policy "programs_write"
  on public.programs for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.programs;

create table if not exists public.program_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists program_videos_user_id_idx on public.program_videos (user_id, position);

drop trigger if exists program_videos_set_updated_at on public.program_videos;
create trigger program_videos_set_updated_at
  before update on public.program_videos
  for each row execute function public.set_updated_at();

alter table public.program_videos enable row level security;

drop policy if exists "program_videos_select" on public.program_videos;
create policy "program_videos_select"
  on public.program_videos for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "program_videos_write" on public.program_videos;
create policy "program_videos_write"
  on public.program_videos for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.program_videos;
