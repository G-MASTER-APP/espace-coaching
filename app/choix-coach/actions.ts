"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function chooseCoachingMode(mode: "joris" | "ia", aiName?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "coach") {
    redirect("/");
  }

  await supabase.from("profiles").update({ coaching_mode: mode }).eq("id", user.id);

  if (mode === "ia") {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("ia_coaching")
      .select("client_id")
      .eq("client_id", user.id)
      .maybeSingle();

    if (!existing) {
      await admin.from("ia_coaching").insert({ client_id: user.id, ai_name: aiName?.trim() || null });
    } else if (aiName?.trim()) {
      // Ne réécrit le nom que si le client en a donné un — sinon on garde
      // celui déjà choisi (utile en cas de retour à l'IA après un passage
      // par Coach Joris : le nom donné avant n'est pas perdu).
      await admin.from("ia_coaching").update({ ai_name: aiName.trim() }).eq("client_id", user.id);
    }
    redirect(`/espace/${user.id}/ia-coach`);
  }

  redirect(`/espace/${user.id}/planning`);
}
