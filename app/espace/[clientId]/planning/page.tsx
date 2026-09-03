import { createClient } from "@/lib/supabase/server";
import { parisWeekStart } from "@/lib/date/paris-week";
import { PlanningBoard } from "./planning-board";

export default async function PlanningPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const weekStart = parisWeekStart();

  let { data: planning } = await supabase
    .from("plannings")
    .select("id, days, week_start")
    .eq("user_id", clientId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!planning) {
    const { data: created, error } = await supabase
      .from("plannings")
      .insert({ user_id: clientId, week_start: weekStart })
      .select("id, days, week_start")
      .single();

    if (error) {
      // Course possible si coach et client ouvrent la page au même instant
      // pour la première fois de la semaine : l'un des deux a déjà créé la
      // ligne, on se contente de la relire.
      const { data: existing } = await supabase
        .from("plannings")
        .select("id, days, week_start")
        .eq("user_id", clientId)
        .eq("week_start", weekStart)
        .single();
      planning = existing ?? null;
    } else {
      planning = created;
    }
  }

  if (!planning) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-destructive">
          Impossible de charger le planning pour le moment.
        </p>
      </div>
    );
  }

  return (
    <PlanningBoard
      planningId={planning.id}
      weekStart={planning.week_start}
      initialDays={planning.days}
    />
  );
}
