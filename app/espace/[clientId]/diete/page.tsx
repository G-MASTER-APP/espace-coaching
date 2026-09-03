import { createClient } from "@/lib/supabase/server";
import { parisToday } from "@/lib/date/paris-day";
import { DieteView } from "./diete-view";

export default async function DietePage({
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

  let { data: goals } = await supabase
    .from("nutrition_goals")
    .select("id, calories_target, protein_target_g, carbs_target_g, fat_target_g")
    .eq("user_id", clientId)
    .maybeSingle();

  if (!goals && isCoach) {
    const { data: created } = await supabase
      .from("nutrition_goals")
      .insert({ user_id: clientId })
      .select("id, calories_target, protein_target_g, carbs_target_g, fat_target_g")
      .single();
    goals = created ?? null;
  }

  const [{ data: entries }, { data: savedFoods }] = await Promise.all([
    supabase
      .from("food_log_entries")
      .select("id, meal, name, quantity_g, calories, protein_g, carbs_g, fat_g")
      .eq("user_id", clientId)
      .eq("log_date", today)
      .order("created_at"),
    supabase
      .from("foods")
      .select("id, name, is_recipe, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .eq("user_id", clientId)
      .order("name"),
  ]);

  return (
    <DieteView
      clientId={clientId}
      isCoach={isCoach}
      goals={goals}
      initialEntries={entries ?? []}
      initialSavedFoods={savedFoods ?? []}
      today={today}
    />
  );
}
