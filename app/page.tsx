import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, coaching_mode")
    .eq("id", user.id)
    .single();

  if (profile?.role === "coach") {
    redirect("/dashboard");
  }

  if (!profile?.coaching_mode) {
    redirect("/choix-coach");
  }

  if (profile.coaching_mode === "ia") {
    redirect(`/espace/${user.id}/ia-coach`);
  }

  redirect(`/espace/${user.id}/planning`);
}
