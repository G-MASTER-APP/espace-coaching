import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { IaCoachView } from "./ia-coach-view";

export default async function IaCoachPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("profiles")
    .select("coaching_mode")
    .eq("id", clientId)
    .single();

  // Le layout a déjà vérifié l'accès (propriétaire ou coach du client) ; ici
  // on vérifie juste que ce client a bien choisi le Coach IA — sinon cet
  // onglet n'a pas de sens pour lui.
  if (client?.coaching_mode !== "ia") {
    redirect(`/espace/${clientId}/planning`);
  }

  const isCoachView = user.id !== clientId;

  const [{ data: coaching }, { data: messages }, { data: analyses }, { data: bilans }] = await Promise.all([
    supabase
      .from("ia_coaching")
      .select(
        "spend_total, spend_cycle, spend_limit, onboarding_done, program, ai_name, objectif_tags, objectif_details"
      )
      .eq("client_id", clientId)
      .single(),
    supabase
      .from("ia_messages")
      .select("id, role, content, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ia_video_analyses")
      .select("id, exercise_name, feedback, cost_usd, created_at")
      .eq("client_id", clientId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("body_measurements").select("id").eq("user_id", clientId).limit(1),
  ]);

  // Dernière performance connue par exercice (le plus récent d'abord), pour
  // afficher "la dernière fois" en filigrane dans le lecteur de séance —
  // uniquement les 20 dernières séances loguées, largement suffisant.
  const { data: workoutLogs } = await supabase
    .from("ia_workout_logs")
    .select("exercices, completed_at")
    .eq("client_id", clientId)
    .order("completed_at", { ascending: false })
    .limit(20);

  const lastPerformance: Record<string, { poids_kg: number; repetitions: number }[]> = {};
  for (const log of workoutLogs ?? []) {
    const exercices = (log.exercices ?? []) as { nom: string; series: { poids_kg: number; repetitions: number }[] }[];
    for (const ex of exercices) {
      if (!lastPerformance[ex.nom]) lastPerformance[ex.nom] = ex.series;
    }
  }

  return (
    <IaCoachView
      clientId={clientId}
      isCoachView={isCoachView}
      initialMessages={messages ?? []}
      coaching={
        coaching
          ? { ...coaching, objectif_tags: coaching.objectif_tags ?? [] }
          : {
              spend_total: 0,
              spend_cycle: 0,
              spend_limit: 15,
              onboarding_done: false,
              program: {},
              ai_name: null,
              objectif_tags: [],
              objectif_details: null,
            }
      }
      analyses={analyses ?? []}
      hasBilan={(bilans ?? []).length > 0}
      lastPerformance={lastPerformance}
    />
  );
}
