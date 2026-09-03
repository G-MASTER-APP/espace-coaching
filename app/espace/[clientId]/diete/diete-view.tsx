"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { SaveIndicator } from "@/components/save-indicator";
import { PageHeader } from "@/components/page-header";
import { CircularProgress } from "@/components/circular-progress";
import { Input } from "@/components/ui/input";
import { MEALS, type FoodLogEntry, type SavedFood, type MealKey } from "@/lib/nutrition";
import { AddFoodPanel } from "./add-food-panel";

type GoalsData = {
  id: string;
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
};
type Goals = GoalsData | null;

export function DieteView({
  clientId,
  isCoach,
  goals: initialGoals,
  initialEntries,
  initialSavedFoods,
  today,
}: {
  clientId: string;
  isCoach: boolean;
  goals: Goals;
  initialEntries: FoodLogEntry[];
  initialSavedFoods: SavedFood[];
  today: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState(initialGoals);
  const [entries, setEntries] = useState<FoodLogEntry[]>(initialEntries);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>(initialSavedFoods);
  const [addingMeal, setAddingMeal] = useState<MealKey | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`diete-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "food_log_entries", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setEntries((current) => current.filter((e) => e.id !== old.id));
            return;
          }
          const row = payload.new as FoodLogEntry & { log_date: string };
          if (row.log_date !== today) return;
          setEntries((current) => {
            const exists = current.some((e) => e.id === row.id);
            return exists ? current.map((e) => (e.id === row.id ? row : e)) : [...current, row];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nutrition_goals", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setGoals(payload.new as Goals);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "foods", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setSavedFoods((current) => current.filter((f) => f.id !== old.id));
            return;
          }
          const row = payload.new as SavedFood;
          setSavedFoods((current) => {
            const exists = current.some((f) => f.id === row.id);
            return exists ? current.map((f) => (f.id === row.id ? row : f)) : [...current, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId, today]);

  async function deleteEntry(id: string) {
    setEntries((current) => current.filter((e) => e.id !== id));
    await supabase.from("food_log_entries").delete().eq("id", id);
  }

  const [goalsSaveStatus, setGoalsSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const debouncedPersistGoals = useDebouncedCallback(async (patch: Partial<GoalsData>) => {
    if (!goals) return;
    setGoalsSaveStatus("saving");
    const { error } = await supabase.from("nutrition_goals").update(patch).eq("id", goals.id);
    setGoalsSaveStatus(error ? "idle" : "saved");
  }, 700);

  function onGoalFieldChange<K extends keyof GoalsData>(key: K, value: GoalsData[K]) {
    setGoals((current) => (current ? { ...current, [key]: value } : current));
    debouncedPersistGoals({ [key]: value } as Partial<GoalsData>);
  }

  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbs_g,
      fat: acc.fat + e.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <PageHeader icon="🥗" eyebrow="Aujourd'hui" title="Diète" />

      {goals ? (
        <section className="flex flex-col gap-4">
          <div className="flex justify-center">
            <CaloriesRing value={totals.calories} target={goals.calories_target} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MacroRing
              label="Protéines"
              value={totals.protein}
              target={goals.protein_target_g}
              unit="g"
              color="var(--color-accent)"
            />
            <MacroRing
              label="Glucides"
              value={totals.carbs}
              target={goals.carbs_target_g}
              unit="g"
              color="var(--color-primary)"
            />
            <MacroRing
              label="Lipides"
              value={totals.fat}
              target={goals.fat_target_g}
              unit="g"
              color="var(--color-destructive)"
            />
          </div>
          {isCoach && (
            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Objectifs</p>
                <SaveIndicator status={goalsSaveStatus} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GoalField
                  label="Calories"
                  value={goals.calories_target}
                  onChange={(v) => onGoalFieldChange("calories_target", v)}
                />
                <GoalField
                  label="Protéines (g)"
                  value={goals.protein_target_g}
                  onChange={(v) => onGoalFieldChange("protein_target_g", v)}
                />
                <GoalField
                  label="Glucides (g)"
                  value={goals.carbs_target_g}
                  onChange={(v) => onGoalFieldChange("carbs_target_g", v)}
                />
                <GoalField
                  label="Lipides (g)"
                  value={goals.fat_target_g}
                  onChange={(v) => onGoalFieldChange("fat_target_g", v)}
                />
              </div>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Ton coach n&apos;a pas encore défini d&apos;objectifs.
        </p>
      )}

      <div className="flex flex-col gap-5">
        {MEALS.map((meal) => {
          const mealEntries = entries.filter((e) => e.meal === meal.key);
          const mealCalories = mealEntries.reduce((sum, e) => sum + e.calories, 0);
          return (
            <section key={meal.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{meal.label}</h2>
                <span className="text-xs text-muted-foreground">{Math.round(mealCalories)} kcal</span>
              </div>
              <div className="flex flex-col gap-2">
                {mealEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.quantity_g} g · {Math.round(entry.calories)} kcal
                      </p>
                    </div>
                    {!isCoach && (
                      <button
                        type="button"
                        onClick={() => void deleteEntry(entry.id)}
                        aria-label="Supprimer"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {mealEntries.length === 0 && (
                  <p className="text-xs text-muted-foreground">Rien loggé pour l&apos;instant.</p>
                )}
              </div>
              {/* Journal alimentaire en lecture seule pour le coach (spec) :
                  seul le client logge ce qu'il mange, le coach observe. */}
              {!isCoach && (
                <button
                  type="button"
                  onClick={() => setAddingMeal(meal.key)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" /> Ajouter un aliment
                </button>
              )}
            </section>
          );
        })}
      </div>

      {addingMeal && (
        <AddFoodPanel
          clientId={clientId}
          meal={addingMeal}
          today={today}
          savedFoods={savedFoods}
          onClose={() => setAddingMeal(null)}
          onSaved={(food) => setSavedFoods((current) => [...current, food])}
        />
      )}
    </div>
  );
}

function CaloriesRing({ value, target }: { value: number; target: number }) {
  return (
    <CircularProgress value={value} max={target} size={112} strokeWidth={10}>
      <div className="text-center">
        <p className="text-2xl font-bold leading-none text-foreground">{Math.round(value)}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">/ {target} kcal</p>
      </div>
    </CircularProgress>
  );
}

function MacroRing({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <CircularProgress value={value} max={target} size={68} strokeWidth={6} color={color}>
        <p className="text-xs font-semibold text-foreground">{Math.round(value)}</p>
      </CircularProgress>
      <p className="text-[11px] font-medium text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">
        / {target}
        {unit}
      </p>
    </div>
  );
}

function GoalField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8 text-xs"
      />
    </div>
  );
}
