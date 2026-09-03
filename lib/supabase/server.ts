import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase pour Server Components / Server Actions / Route Handlers.
 * `setAll` peut être appelé depuis un Server Component pur (pas d'accès en
 * écriture aux cookies) : on avale l'erreur, le proxy se charge de
 * rafraîchir la session sur ces requêtes-là.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Appelé depuis un Server Component : ignoré, voir commentaire ci-dessus.
          }
        },
      },
    }
  );
}
