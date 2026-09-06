import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExtractedHabits } from "./system-prompt";

const GOALS_KEYS = ["steps_target", "water_target_l", "sleep_target_h"] as const;
const NUTRITION_KEYS = ["calories_target", "protein_target_g", "carbs_target_g", "fat_target_g"] as const;

/**
 * Applique les ajustements d'habitudes décidés par l'IA (pas, eau, sommeil,
 * calories/macros) sur les mêmes tables que le coach humain édite (Suivi /
 * Diète), en écriture service_role : ces tables sont réservées au coach côté
 * RLS.
 */
export async function applyExtractedHabits(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  clientId: string,
  habits: ExtractedHabits | null
) {
  if (!habits) return;

  const goalsPatch = Object.fromEntries(
    GOALS_KEYS.filter((k) => habits[k] !== undefined).map((k) => [k, habits[k]])
  );
  if (Object.keys(goalsPatch).length) {
    await admin.from("coaching_goals").update(goalsPatch).eq("user_id", clientId);
  }

  const nutritionPatch = Object.fromEntries(
    NUTRITION_KEYS.filter((k) => habits[k] !== undefined).map((k) => [k, habits[k]])
  );
  if (Object.keys(nutritionPatch).length) {
    await admin.from("nutrition_goals").update(nutritionPatch).eq("user_id", clientId);
  }
}
