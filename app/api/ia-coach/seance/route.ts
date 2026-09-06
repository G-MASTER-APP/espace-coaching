import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type LoggedSeries = { poids_kg: number; repetitions: number };
type LoggedExercice = { nom: string; series: LoggedSeries[] };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, coaching_mode")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "client" || profile.coaching_mode !== "ia") {
    return NextResponse.json({ error: "Le Coach IA n'est pas actif pour ce compte." }, { status: 403 });
  }

  const { seanceNom, exercices } = (await request.json()) as {
    seanceNom?: string;
    exercices?: LoggedExercice[];
  };
  const cleanExercices = Array.isArray(exercices) ? exercices : [];

  const { error: insertError } = await supabase.from("ia_workout_logs").insert({
    client_id: user.id,
    seance_nom: seanceNom || null,
    exercices: cleanExercices,
  });
  if (insertError) {
    return NextResponse.json({ error: "Impossible d'enregistrer la séance." }, { status: 500 });
  }

  let totalSets = 0;
  let totalVolumeKg = 0;
  const lines: string[] = [];
  for (const ex of cleanExercices) {
    const sets = ex.series ?? [];
    totalSets += sets.length;
    const setSummary = sets.map((s) => `${s.poids_kg}kg x${s.repetitions}`).join(", ");
    for (const s of sets) totalVolumeKg += (s.poids_kg || 0) * (s.repetitions || 0);
    if (setSummary) lines.push(`${ex.nom} : ${setSummary}`);
  }

  // On informe l'IA sans lui faire répondre en direct (pas d'appel payant
  // pour un simple log) — elle le verra au prochain échange normal et en
  // tiendra compte pour ajuster la suite.
  const recapLine = `[Séance terminée${seanceNom ? ` — ${seanceNom}` : ""}] ${lines.join(" ; ") || "aucun exercice détaillé"}.`;
  await supabase.from("ia_messages").insert({ client_id: user.id, role: "user", content: recapLine });

  return NextResponse.json({
    ok: true,
    recap: { totalSets, totalVolumeKg: Math.round(totalVolumeKg), exercisesCount: cleanExercices.length },
  });
}
