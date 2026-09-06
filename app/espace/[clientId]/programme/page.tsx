import { createClient } from "@/lib/supabase/server";
import type { Seance } from "../ia-coach/seance-player";
import { ProgrammeView } from "./programme-view";

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const isCoach = viewer?.role === "coach";

  const { data: target } = await supabase
    .from("profiles")
    .select("coaching_mode")
    .eq("id", clientId)
    .maybeSingle();
  const isIaClient = target?.coaching_mode === "ia";

  const [{ data: program }, { data: videos }] = await Promise.all([
    supabase.from("programs").select("id, program_url, seances").eq("user_id", clientId).maybeSingle(),
    supabase
      .from("program_videos")
      .select("id, title, url, position")
      .eq("user_id", clientId)
      .order("position"),
  ]);

  // Client Coach IA : le programme (séances structurées) et la dernière
  // performance connue viennent de ia_coaching / ia_workout_logs, pas de la
  // table "programs" (PDF déposé par le coach humain, sans rapport ici).
  let iaProgram: Record<string, unknown> = {};
  let lastPerformance: Record<string, { poids_kg: number; repetitions: number }[]> = {};
  if (isIaClient) {
    const [{ data: coaching }, { data: workoutLogs }] = await Promise.all([
      supabase.from("ia_coaching").select("program").eq("client_id", clientId).maybeSingle(),
      supabase
        .from("ia_workout_logs")
        .select("exercices, completed_at")
        .eq("client_id", clientId)
        .order("completed_at", { ascending: false })
        .limit(20),
    ]);
    iaProgram = (coaching?.program as Record<string, unknown>) ?? {};
    for (const log of workoutLogs ?? []) {
      const exercices = (log.exercices ?? []) as { nom: string; series: { poids_kg: number; repetitions: number }[] }[];
      for (const ex of exercices) {
        if (!lastPerformance[ex.nom]) lastPerformance[ex.nom] = ex.series;
      }
    }
  }

  return (
    <ProgrammeView
      clientId={clientId}
      isCoach={isCoach}
      programId={program?.id ?? null}
      programUrl={program?.program_url ?? ""}
      initialVideos={videos ?? []}
      isIaClient={isIaClient}
      iaProgram={iaProgram}
      lastPerformance={lastPerformance}
      // Client suivi par Joris : programme structuré préparé via
      // l'Assistant coach (brouillon validé) — affiché en lecture seule,
      // en plus du lien Hevy/PDF (gardé) puisque ce client n'a pas
      // l'interface interactive séance par séance de Coach IA.
      humanSeances={!isIaClient ? ((program?.seances as Seance[]) ?? []) : []}
    />
  );
}
