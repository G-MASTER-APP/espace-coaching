import { createClient } from "@/lib/supabase/server";
import { parisToday, addMonths } from "@/lib/date/paris-day";
import { AccompagnementView } from "./accompagnement-view";

const PACKAGE_LENGTH_MONTHS = 3;

export default async function AccompagnementPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const today = parisToday();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const isCoach = viewer?.role === "coach";

  // Le Forfait (cycle de séances payées) n'a pas de sens pour un client
  // suivi par le Coach IA : ce n'est pas lui qui gère un forfait de
  // séances avec Joris.
  const { data: targetClient } = await supabase
    .from("profiles")
    .select("coaching_mode")
    .eq("id", clientId)
    .maybeSingle();
  const hideForfait = targetClient?.coaching_mode === "ia";

  // Objectifs : uniquement créés par le coach (RLS). Un client sans coach
  // ayant encore rien défini verra un état vide, c'est attendu.
  const goalsColumns =
    "id, water_target_l, sleep_target_h, steps_target, diet_note, package_sessions, package_start_date";
  let { data: goals } = await supabase
    .from("coaching_goals")
    .select(goalsColumns)
    .eq("user_id", clientId)
    .maybeSingle();

  if (!goals && isCoach) {
    const { data: created } = await supabase
      .from("coaching_goals")
      .insert({ user_id: clientId })
      .select(goalsColumns)
      .single();
    goals = created ?? null;
  }

  const dailyLogColumns =
    "id, water_l, sleep_h, sleep_quality, steps, diet_respected, sessions_done, day_quality, day_comment";
  let { data: dailyLog } = await supabase
    .from("coaching_daily_logs")
    .select(dailyLogColumns)
    .eq("user_id", clientId)
    .eq("log_date", today)
    .maybeSingle();

  if (!dailyLog) {
    const { data: created, error } = await supabase
      .from("coaching_daily_logs")
      .insert({ user_id: clientId, log_date: today })
      .select(dailyLogColumns)
      .single();

    if (error) {
      const { data: existing } = await supabase
        .from("coaching_daily_logs")
        .select(dailyLogColumns)
        .eq("user_id", clientId)
        .eq("log_date", today)
        .single();
      dailyLog = existing ?? null;
    } else {
      dailyLog = created;
    }
  }

  // Objectifs nutritionnels + journal du jour : affichés en lecture ici
  // (les mêmes anneaux que la page Diète), pour que le coach voie la diète
  // sans changer de page. Les macros restent éditables uniquement sur /diete.
  const { data: nutritionGoals } = await supabase
    .from("nutrition_goals")
    .select("calories_target, protein_target_g, carbs_target_g, fat_target_g")
    .eq("user_id", clientId)
    .maybeSingle();

  const { data: foodEntries } = await supabase
    .from("food_log_entries")
    .select("id, calories, protein_g, carbs_g, fat_g")
    .eq("user_id", clientId)
    .eq("log_date", today);

  // Forfait : cycle fixe de 3 mois démarré par le coach (package_start_date),
  // pas calé sur la semaine/le mois civil. Total EXCLUANT aujourd'hui : le
  // compteur affiché dérive ensuite comme `otherDaysTotal +
  // dailyLog.sessions_done` côté client, une valeur pure plutôt qu'un cumul
  // de deltas (fragile avec l'écho temps réel de nos propres écritures).
  const periodStart = goals?.package_start_date ?? today;
  const periodEnd = addMonths(periodStart, PACKAGE_LENGTH_MONTHS);
  const { data: otherDaysLogs } = await supabase
    .from("coaching_daily_logs")
    .select("sessions_done")
    .eq("user_id", clientId)
    .gte("log_date", periodStart)
    .lt("log_date", today)
    .lt("log_date", periodEnd);
  const otherDaysTotal = (otherDaysLogs ?? []).reduce((sum, l) => sum + (l.sessions_done ?? 0), 0);

  if (!dailyLog) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-destructive">Impossible de charger le suivi pour le moment.</p>
      </div>
    );
  }

  return (
    <AccompagnementView
      clientId={clientId}
      isCoach={isCoach}
      goals={goals}
      dailyLog={dailyLog}
      otherDaysTotal={otherDaysTotal}
      today={today}
      nutritionGoals={nutritionGoals ?? null}
      initialFoodEntries={foodEntries ?? []}
      hideForfait={hideForfait}
    />
  );
}
