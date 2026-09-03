"use client";

import { createClient } from "@/lib/supabase/client";
import { parisToday } from "@/lib/date/paris-day";

export async function buildCoachDigest(coachId: string): Promise<string> {
  const supabase = createClient();
  const today = parisToday();

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("coach_id", coachId);

  if (!clients || clients.length === 0) {
    return "Bonjour. Vous ne suivez encore aucun client pour le moment.";
  }

  const ids = clients.map((c) => c.id);
  const { data: logs } = await supabase
    .from("coaching_daily_logs")
    .select("user_id, water_l, sleep_h, steps, day_quality")
    .in("user_id", ids)
    .eq("log_date", today);

  const filledIds = new Set(
    (logs ?? [])
      .filter((l) => (l.water_l ?? 0) > 0 || l.sleep_h !== null || (l.steps ?? 0) > 0 || l.day_quality !== null)
      .map((l) => l.user_id)
  );

  const filledNames = clients.filter((c) => filledIds.has(c.id)).map((c) => c.full_name || "Sans nom");
  const pendingNames = clients.filter((c) => !filledIds.has(c.id)).map((c) => c.full_name || "Sans nom");

  const parts: string[] = [
    `Bonjour. Vous suivez ${clients.length} client${clients.length > 1 ? "s" : ""} aujourd'hui.`,
  ];

  if (pendingNames.length === 0) {
    parts.push("Tout le monde a déjà rempli son suivi. Excellent travail.");
  } else {
    if (filledNames.length > 0) {
      parts.push(`Ont déjà rempli : ${filledNames.join(", ")}.`);
    }
    parts.push(`N'ont pas encore rempli : ${pendingNames.join(", ")}.`);
  }

  return parts.join(" ");
}
