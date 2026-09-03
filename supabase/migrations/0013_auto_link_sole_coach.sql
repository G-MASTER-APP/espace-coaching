-- Un seul coach existe dans l'appli pour l'instant (cf. commentaire sur
-- profiles.coach_id dans 0001_profiles.sql). Jusqu'ici, chaque nouveau
-- client devait être relié manuellement dans Supabase Studio après son
-- inscription — corrigé ici : tout nouveau compte se rattache
-- automatiquement à CE coach dès l'inscription. S'il y a 0 ou plusieurs
-- coachs (évolution future multi-coach), on laisse coach_id vide plutôt
-- que de deviner.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_count int;
  the_coach_id uuid;
begin
  select count(*), min(id) into coach_count, the_coach_id
  from public.profiles where role = 'coach';

  insert into public.profiles (id, role, full_name, coach_id)
  values (
    new.id,
    'client',
    new.raw_user_meta_data ->> 'full_name',
    case when coach_count = 1 then the_coach_id else null end
  );
  return new;
end;
$$;
