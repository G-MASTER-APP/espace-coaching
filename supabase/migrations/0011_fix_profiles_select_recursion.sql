-- Corrige "profiles_select_own_coach" (migration 0010) : sa condition
-- interrogeait public.profiles depuis une policy sur public.profiles,
-- ce qui redéclenche l'évaluation RLS sur elle-même et casse (récursion
-- infinie détectée par Postgres) TOUT select sur la table, y compris
-- "profiles_select_own" — plus aucun utilisateur ne pouvait lire son
-- propre profil. On passe par une fonction security definer (même
-- pattern que is_owner_or_coach / is_coach_of) qui contourne RLS en
-- interne, comme le reste du fichier 0001 le fait déjà.

create or replace function public.my_coach_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coach_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.my_coach_id() to authenticated;

drop policy if exists "profiles_select_own_coach" on public.profiles;
create policy "profiles_select_own_coach"
  on public.profiles for select
  using (id = public.my_coach_id());
