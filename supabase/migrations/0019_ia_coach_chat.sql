-- Chat Coach IA : historique des messages + programme construit par l'IA.
-- Le programme est en jsonb (pas de colonnes rigides) car c'est l'IA elle-même
-- qui décide de sa structure (sport, diète, habitudes) et le fait évoluer
-- semaine après semaine — contrairement au catalogue coach humain qui, lui,
-- est structuré à l'avance par Joris.
alter table public.ia_coaching add column if not exists program jsonb not null default '{}'::jsonb;

create table if not exists public.ia_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ia_messages_client_id_idx on public.ia_messages (client_id, created_at);

alter table public.ia_messages enable row level security;

drop policy if exists "ia_messages_select" on public.ia_messages;
create policy "ia_messages_select"
  on public.ia_messages for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));

-- Écriture réservée au client concerné : les messages "assistant" sont aussi
-- insérés par la route serveur, mais avec le client authentifié comme auteur
-- de la requête (pas besoin du service_role ici, contrairement à ia_coaching).
drop policy if exists "ia_messages_insert" on public.ia_messages;
create policy "ia_messages_insert"
  on public.ia_messages for insert
  with check (client_id = auth.uid());

alter publication supabase_realtime add table public.ia_messages;
