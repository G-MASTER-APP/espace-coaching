-- Choix du client entre suivi humain (Joris) ou 100% IA (Claude), remplaçant
-- complètement le coach pour ce client. NULL = pas encore choisi : le client
-- est redirigé vers l'écran de choix avant d'arriver sur son espace.
-- Volontairement une colonne à part (pas role/coach_id) : ces deux-là sont
-- verrouillées par le trigger protect_profile_privileges, alors que le choix
-- coaching_mode doit rester modifiable par le client lui-même.
alter table public.profiles add column if not exists coaching_mode text check (coaching_mode in ('joris', 'ia'));

-- Réglages + suivi de dépense IA, un par client (indépendant du compteur
-- Jarvis du coach, qui lui est global). Jamais exposée au client : seul le
-- coach voit le coût, et lui seul peut modifier la limite. Toutes les
-- écritures (création, incrément de dépense) passent par le service_role
-- depuis les routes serveur — pas de policy insert/write pour les clients.
create table if not exists public.ia_coaching (
  client_id uuid primary key references public.profiles (id) on delete cascade,
  spend_total numeric not null default 0,
  spend_cycle numeric not null default 0,
  spend_cycle_start date,
  spend_limit numeric not null default 15,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ia_coaching enable row level security;

drop policy if exists "ia_coaching_select_coach" on public.ia_coaching;
create policy "ia_coaching_select_coach"
  on public.ia_coaching for select
  using (public.is_coach_of(client_id));

-- Le coach peut ajuster la limite (et, en confiance, le reste — c'est le
-- propriétaire de l'app, pas un tiers) directement depuis l'app.
drop policy if exists "ia_coaching_update_coach" on public.ia_coaching;
create policy "ia_coaching_update_coach"
  on public.ia_coaching for update
  using (public.is_coach_of(client_id))
  with check (public.is_coach_of(client_id));

alter publication supabase_realtime add table public.ia_coaching;
