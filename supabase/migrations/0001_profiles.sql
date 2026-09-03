-- Phase 2 : profils utilisateurs, rôles, RLS.
-- Additif uniquement : ne touche à aucune table existante du projet.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('coach', 'client')),
  -- Rattachement à un coach. Nullable et sur profiles (pas une table à part)
  -- pour rester simple tant qu'il n'y a qu'un seul coach ; permet
  -- d'en gérer plusieurs plus tard sans migration de schéma.
  coach_id uuid references public.profiles (id) on delete set null,
  full_name text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_coach_id_idx on public.profiles (coach_id);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------
-- Fonctions utilitaires (security definer : contournent RLS pour faire
-- une vérification ciblée, réutilisées dans les policies des tables des
-- phases suivantes : planning, diète, bilan, accompagnement...).
-- ---------------------------------------------------------------------

create or replace function public.is_owner_or_coach(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = target_user_id and coach_id = auth.uid()
    );
$$;

grant execute on function public.is_owner_or_coach(uuid) to authenticated;

create or replace function public.is_coach_of(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = target_user_id and coach_id = auth.uid()
  );
$$;

grant execute on function public.is_coach_of(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Création automatique du profil (rôle "client" par défaut) à l'inscription.
-- Les comptes coach sont promus manuellement dans Supabase Studio.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'client', new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- role et coach_id ne sont modifiables que depuis Supabase Studio
-- (clé service_role, qui contourne ce trigger) — jamais depuis l'app.
-- ---------------------------------------------------------------------

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    if new.role is distinct from old.role or new.coach_id is distinct from old.coach_id then
      raise exception 'role et coach_id ne sont modifiables que par le propriétaire du projet (Supabase Studio)';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;
create trigger profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_select_as_coach" on public.profiles;
create policy "profiles_select_as_coach"
  on public.profiles for select
  using (coach_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_update_as_coach" on public.profiles;
create policy "profiles_update_as_coach"
  on public.profiles for update
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());
