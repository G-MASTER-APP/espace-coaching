"use server";

import { createClient } from "@/lib/supabase/server";

export async function touchLastActive(clientId: string) {
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", clientId);
}
