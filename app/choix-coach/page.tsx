import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CoachingModeChoice } from "./coaching-mode-choice";

export default async function ChoixCoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, coaching_mode")
    .eq("id", user.id)
    .single();

  if (profile?.role === "coach") redirect("/dashboard");

  const currentMode = profile?.coaching_mode as "joris" | "ia" | null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-8">
      <PageHeader
        icon="🧭"
        eyebrow={currentMode ? "Changer de coach" : "Avant de commencer"}
        title={currentMode ? "Tu peux changer d'avis" : "Comment veux-tu être suivi(e) ?"}
      />
      <p className="text-sm text-muted-foreground">
        {currentMode
          ? "Ton historique (conversations, programme) reste sauvegardé si tu changes — rien n'est perdu."
          : "Ce choix détermine qui construit ton programme et répond à tes questions."}
      </p>
      <CoachingModeChoice currentMode={currentMode} />
    </main>
  );
}
