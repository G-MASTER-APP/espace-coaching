-- Galerie photo réelle pour le Bilan (upload direct, en plus du lien
-- externe existant qu'on garde pour ne pas casser les bilans déjà
-- enregistrés). Les fichiers eux-mêmes vivent dans le bucket Storage
-- "bilan-photos" (policies mises en place séparément par
-- scripts/setup-storage.mjs, storage.objects n'est pas gérable via
-- exec_sql de la même façon que le reste).
create table if not exists public.bilan_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists bilan_photos_user_idx on public.bilan_photos (user_id, taken_at);
alter table public.bilan_photos enable row level security;

drop policy if exists "bilan_photos_select" on public.bilan_photos;
create policy "bilan_photos_select"
  on public.bilan_photos for select
  using (public.is_owner_or_coach(user_id));

drop policy if exists "bilan_photos_insert" on public.bilan_photos;
create policy "bilan_photos_insert"
  on public.bilan_photos for insert
  with check (public.is_owner_or_coach(user_id));

drop policy if exists "bilan_photos_delete" on public.bilan_photos;
create policy "bilan_photos_delete"
  on public.bilan_photos for delete
  using (public.is_owner_or_coach(user_id));

alter publication supabase_realtime add table public.bilan_photos;

-- Abonnements Web Push : un client autorise les notifications sur son
-- appareil, on stocke l'endpoint pour pouvoir lui envoyer un rappel
-- depuis le serveur (l'envoi se fait toujours server-side avec la clé
-- privée VAPID, jamais exposée au navigateur).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
