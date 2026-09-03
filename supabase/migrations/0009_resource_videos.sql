-- Phase 8 (polish) : bibliothèque vidéo séparée du programme (récupération,
-- nutrition, compléments...). Additif uniquement.

create table if not exists public.resource_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  url text not null,
  category text not null default 'other' check (category in ('recovery', 'nutrition', 'supplements', 'other')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resource_videos_user_id_idx on public.resource_videos (user_id, category, position);

drop trigger if exists resource_videos_set_updated_at on public.resource_videos;
create trigger resource_videos_set_updated_at
  before update on public.resource_videos
  for each row execute function public.set_updated_at();

alter table public.resource_videos enable row level security;

drop policy if exists "resource_videos_select" on public.resource_videos;
create policy "resource_videos_select"
  on public.resource_videos for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "resource_videos_write" on public.resource_videos;
create policy "resource_videos_write"
  on public.resource_videos for all
  using (public.is_coach_of(user_id))
  with check (public.is_coach_of(user_id));

alter publication supabase_realtime add table public.resource_videos;
