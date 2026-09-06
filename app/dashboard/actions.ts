"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateIaSpendLimit(clientId: string, limit: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  // Filtré par la policy ia_coaching_update_coach (is_coach_of) — un coach ne
  // peut modifier que la limite de ses propres clients.
  const { error } = await supabase
    .from("ia_coaching")
    .update({ spend_limit: limit })
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

export async function dismissIaAlert(clientId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("ia_coaching")
    .update({ alert_message: null, alert_created_at: null })
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { error: null };
}

/**
 * Bascule un client entre suivi humain et Coach IA — le coach reprend la
 * main sur un cas particulier, ou remet un client en IA après coup. Ne
 * touche jamais aux données déjà accumulées (chat, programme) : juste
 * l'aiguillage. `coaching_mode` n'est pas protégé par le trigger de
 * profiles (contrairement à role/coach_id), donc une simple update suffit.
 */
export async function toggleCoachingMode(clientId: string, nextMode: "joris" | "ia") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("profiles")
    .update({ coaching_mode: nextMode })
    .eq("id", clientId)
    .eq("coach_id", user.id);
  if (error) return { error: error.message };

  if (nextMode === "ia") {
    // Réactive un profil ia_coaching existant, ou en crée un s'il n'y en a
    // jamais eu (ce client n'était jamais passé en IA avant). Pas de policy
    // insert pour le coach sur ia_coaching (seulement select/update) — on
    // passe par le service_role, comme à la création initiale.
    const admin = createAdminClient();
    await admin
      .from("ia_coaching")
      .upsert({ client_id: clientId }, { onConflict: "client_id", ignoreDuplicates: true });
  }

  revalidatePath("/dashboard");
  return { error: null };
}
