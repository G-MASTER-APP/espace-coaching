import { createClient } from "@supabase/supabase-js";

/**
 * Client service_role : contourne la RLS. Serveur uniquement, jamais importé
 * depuis un composant client. Réservé aux écritures qu'aucun rôle applicatif
 * (client/coach) n'a le droit de faire directement — ex: incrémenter le
 * compteur de dépense IA du coach depuis une requête initiée par un client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
