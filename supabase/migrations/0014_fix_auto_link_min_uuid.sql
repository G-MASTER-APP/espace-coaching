-- Correctif de 0013 : min(uuid) n'existe pas en Postgres (pas d'agrégat
-- MIN pour ce type), ce qui faisait échouer TOUTE inscription depuis
-- l'application du trigger précédent. Remplacé par un count() + un select
-- ... limit 1 séparé.
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
  select count(*) into coach_count from public.profiles where role = 'coach';

  if coach_count = 1 then
    select id into the_coach_id from public.profiles where role = 'coach' limit 1;
  end if;

  insert into public.profiles (id, role, full_name, coach_id)
  values (
    new.id,
    'client',
    new.raw_user_meta_data ->> 'full_name',
    the_coach_id
  );
  return new;
end;
$$;
