import type { SupabaseClient } from "@supabase/supabase-js";

import { parisToday } from "@/lib/date/paris-day";
import type { ExtractedLogs } from "./system-prompt";

/**
 * Fait atterrir ce que le client a raconté en conversation (repas, poids,
 * mensurations) dans les mêmes tables que la Diète/le Bilan "normaux" — pour
 * que le coach voie une seule progression, que le client soit suivi par
 * Joris ou par l'IA.
 */
export async function applyExtractedLogs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clientId: string,
  logs: ExtractedLogs | null
) {
  if (!logs) return;

  if (logs.food?.length) {
    const today = parisToday();
    const rows = logs.food
      .filter((f) => f.name)
      .map((f) => ({
        user_id: clientId,
        log_date: today,
        meal: f.meal || "snack",
        name: f.name,
        quantity_g: f.quantity_g || 0,
        calories: f.calories || 0,
        protein_g: f.protein_g || 0,
        carbs_g: f.carbs_g || 0,
        fat_g: f.fat_g || 0,
      }));
    if (rows.length) await supabase.from("food_log_entries").insert(rows);
  }

  if (logs.weight_kg || logs.measurements) {
    await supabase.from("body_measurements").insert({
      user_id: clientId,
      weight_kg: logs.weight_kg || null,
      measurements: logs.measurements || {},
    });
  }
}
