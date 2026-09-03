-- Jusqu'ici, coaching_goals/nutrition_goals n'étaient créés que si le
-- coach visitait Accompagnement/Diète pour un client donné (RLS : seul le
-- coach peut insérer). Un client jamais visité par le coach voyait donc
-- "Ton coach n'a pas encore défini d'objectifs." et aucun graphique, même
-- pour lui-même. Corrigé en créant des objectifs par défaut dès
-- l'inscription (valeurs par défaut déjà définies sur les colonnes), plus
-- un rattrapage pour les clients déjà existants sans ces lignes.
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
  values (new.id, 'client', new.raw_user_meta_data ->> 'full_name', the_coach_id);

  insert into public.coaching_goals (user_id) values (new.id);
  insert into public.nutrition_goals (user_id) values (new.id);

  return new;
end;
$$;

insert into public.coaching_goals (user_id)
select p.id from public.profiles p
where p.role = 'client'
  and not exists (select 1 from public.coaching_goals cg where cg.user_id = p.id);

insert into public.nutrition_goals (user_id)
select p.id from public.profiles p
where p.role = 'client'
  and not exists (select 1 from public.nutrition_goals ng where ng.user_id = p.id);
