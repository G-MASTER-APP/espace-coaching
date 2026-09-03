import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase pour les Client Components ("use client").
 * Une nouvelle instance légère par appel : @supabase/ssr gère le
 * partage de session via les cookies, pas besoin de singleton manuel.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
