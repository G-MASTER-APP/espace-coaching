-- BUG CRITIQUE corrigé : le client n'avait jamais eu la permission de lire
-- sa propre fiche ia_coaching (seule la policy coach existait). Résultat :
-- la page Coach IA et la route de chat lisaient "rien" via la session du
-- client (RLS bloquait silencieusement), et retombaient sur des valeurs
-- vides à chaque fois — objectif jamais reflété, chat qui ne répondait
-- jamais (le message utilisateur n'était même pas enregistré, la requête
-- échouait avant).
drop policy if exists "ia_coaching_select_own" on public.ia_coaching;
create policy "ia_coaching_select_own"
  on public.ia_coaching for select
  using (client_id = auth.uid());
