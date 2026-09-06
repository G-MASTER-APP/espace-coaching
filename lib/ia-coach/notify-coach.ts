import type { SupabaseClient } from "@supabase/supabase-js";

import { sendPushToUser } from "@/lib/push/send";

/** Prévient le coach humain d'un client suivi par l'IA (limite atteinte, alerte...). */
export async function notifyCoachOfClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  clientId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data } = await supabase.from("profiles").select("coach_id").eq("id", clientId).single();
  if (data?.coach_id) {
    sendPushToUser(data.coach_id, payload).catch(() => {});
  }
}
