"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { SaveIndicator } from "@/components/save-indicator";
import { PageHeader } from "@/components/page-header";
import { CircularProgress } from "@/components/circular-progress";
import { Input } from "@/components/ui/input";
import { addMonths } from "@/lib/date/paris-day";
import { cn } from "@/lib/utils";

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Goals = {
  id: string;
  water_target_l: number;
  sleep_target_h: number;
  steps_target: number;
  diet_note: string;
  package_sessions: number;
  package_start_date: string;
};

type DailyLog = {
  id: string;
  water_l: number;
  sleep_h: number | null;
  sleep_quality: number | null;
  steps: number;
  diet_respected: boolean | null;
  sessions_done: number;
  day_quality: number | null;
  day_comment: string | null;
};

type NutritionGoals = {
  calories_target: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
};

type FoodEntry = { id: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };

export function AccompagnementView({
  clientId,
  isCoach,
  goals: initialGoals,
  dailyLog: initialDailyLog,
  otherDaysTotal,
  today,
  nutritionGoals: initialNutritionGoals,
  initialFoodEntries,
  hideForfait,
}: {
  clientId: string;
  isCoach: boolean;
  goals: Goals | null;
  dailyLog: DailyLog;
  otherDaysTotal: number;
  today: string;
  nutritionGoals: NutritionGoals | null;
  initialFoodEntries: FoodEntry[];
  hideForfait?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [goals, setGoals] = useState(initialGoals);
  const [dailyLog, setDailyLog] = useState(initialDailyLog);
  const [nutritionGoals, setNutritionGoals] = useState(initialNutritionGoals);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>(initialFoodEntries);
  const [goalsSaveStatus, setGoalsSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [logSaveStatus, setLogSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  // Total de période = jours précédents (fixe, calculé côté serveur) +
  // sessions_done d'aujourd'hui (état réactif). Valeur dérivée pure : pas de
  // cumul de deltas, donc pas de double-comptage possible avec l'écho temps
  // réel de nos propres écritures ou le double-mount de Strict Mode en dev.
  const periodTotal = otherDaysTotal + dailyLog.sessions_done;

  const foodTotals = foodEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbs_g,
      fat: acc.fat + e.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  useEffect(() => {
    const channel = supabase
      .channel(`accompagnement-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coaching_goals", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setGoals(payload.new as Goals);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coaching_daily_logs",
          filter: `id=eq.${initialDailyLog.id}`,
        },
        (payload) => {
          setDailyLog(payload.new as DailyLog);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nutrition_goals", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setNutritionGoals(payload.new as NutritionGoals);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "food_log_entries", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setFoodEntries((current) => current.filter((e) => e.id !== old.id));
            return;
          }
          const row = payload.new as FoodEntry & { id: string; log_date: string };
          if (row.log_date !== today) return;
          setFoodEntries((current) => {
            const exists = current.some((e) => e.id === row.id);
            return exists ? current.map((e) => (e.id === row.id ? row : e)) : [...current, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId, initialDailyLog.id, today]);

  async function persistLog(patch: Partial<DailyLog>) {
    setLogSaveStatus("saving");
    setDailyLog((current) => ({ ...current, ...patch }));
    const { error } = await supabase.from("coaching_daily_logs").update(patch).eq("id", dailyLog.id);
    setLogSaveStatus(error ? "idle" : "saved");
  }

  const debouncedPersistLog = useDebouncedCallback((patch: Partial<DailyLog>) => {
    void persistLog(patch);
  }, 700);

  function onLogFieldChange<K extends keyof DailyLog>(key: K, value: DailyLog[K]) {
    setDailyLog((current) => ({ ...current, [key]: value }));
    debouncedPersistLog({ [key]: value } as Partial<DailyLog>);
  }

  async function persistGoals(patch: Partial<Goals>) {
    if (!goals) return;
    setGoalsSaveStatus("saving");
    const { error } = await supabase.from("coaching_goals").update(patch).eq("id", goals.id);
    setGoalsSaveStatus(error ? "idle" : "saved");
  }

  const debouncedPersistGoals = useDebouncedCallback((patch: Partial<Goals>) => {
    void persistGoals(patch);
  }, 700);

  // Met à jour l'état local immédiatement (l'input reste réactif à la frappe
  // et aux mises à jour temps réel), et ne débounce que l'écriture réseau.
  function onGoalFieldChange<K extends keyof Goals>(key: K, value: Goals[K]) {
    setGoals((current) => (current ? { ...current, [key]: value } : current));
    debouncedPersistGoals({ [key]: value } as Partial<Goals>);
  }

  const periodEnd = goals ? addMonths(goals.package_start_date, 3) : null;

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <PageHeader
        icon="🧭"
        eyebrow="Aujourd'hui"
        title="Accompagnement"
        action={
          <SaveIndicator
            status={
              logSaveStatus === "saving" || goalsSaveStatus === "saving"
                ? "saving"
                : logSaveStatus === "saved" || goalsSaveStatus === "saved"
                  ? "saved"
                  : "idle"
            }
          />
        }
      />

      {!goals ? (
        <p className="text-sm text-muted-foreground">
          Ton coach n&apos;a pas encore défini d&apos;objectifs.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pas */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Pas</h2>
              {isCoach ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Input
                    type="number"
                    step="500"
                    min="0"
                    value={goals.steps_target}
                    onChange={(e) => onGoalFieldChange("steps_target", Number(e.target.value) || 0)}
                    className="h-7 w-20 px-2 text-xs"
                  />
                  <span>pas / jour</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Objectif : {goals.steps_target}</span>
              )}
            </div>
            <div className="mt-3 flex flex-col items-center gap-3">
              <CircularProgress value={dailyLog.steps} max={goals.steps_target || 1} size={112} strokeWidth={10}>
                <div className="text-center">
                  <p className="text-2xl font-bold leading-none text-foreground">{dailyLog.steps}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">/ {goals.steps_target} pas</p>
                </div>
              </CircularProgress>
              <input
                type="range"
                min={0}
                max={Math.max(goals.steps_target * 1.5, dailyLog.steps, 1000)}
                step={100}
                value={dailyLog.steps}
                onChange={(e) => onLogFieldChange("steps", Number(e.target.value))}
                className="h-2 w-full cursor-pointer touch-none accent-primary"
                aria-label="Nombre de pas"
              />
            </div>
          </div>

          {/* Eau */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Eau</h2>
              {isCoach ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    value={goals.water_target_l}
                    onChange={(e) => onGoalFieldChange("water_target_l", Number(e.target.value) || 0)}
                    className="h-7 w-16 px-2 text-xs"
                  />
                  <span>L / jour</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Objectif : {goals.water_target_l} L</span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-4">
              <CircularProgress value={dailyLog.water_l} max={goals.water_target_l || 1} size={64} strokeWidth={6}>
                <span className="text-[11px] font-bold text-foreground">
                  {Math.round((dailyLog.water_l / (goals.water_target_l || 1)) * 100)}%
                </span>
              </CircularProgress>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{dailyLog.water_l.toFixed(2)} L bus</p>
                <input
                  type="range"
                  min={0}
                  max={Math.max(goals.water_target_l * 1.5, dailyLog.water_l, 1)}
                  step={0.1}
                  value={dailyLog.water_l}
                  onChange={(e) => onLogFieldChange("water_l", Number(e.target.value))}
                  className="mt-2 h-2 w-full cursor-pointer touch-none accent-primary"
                  aria-label="Quantité d'eau bue"
                />
              </div>
            </div>
          </div>

          {/* Sommeil */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Sommeil</h2>
              {isCoach ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    value={goals.sleep_target_h}
                    onChange={(e) => onGoalFieldChange("sleep_target_h", Number(e.target.value) || 0)}
                    className="h-7 w-16 px-2 text-xs"
                  />
                  <span>h / nuit</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Objectif : {goals.sleep_target_h} h</span>
              )}
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold text-foreground">{dailyLog.sleep_h ?? 0} h dormies</p>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={dailyLog.sleep_h ?? 0}
                onChange={(e) => onLogFieldChange("sleep_h", Number(e.target.value))}
                className="mt-2 h-2 w-full cursor-pointer touch-none accent-primary"
                aria-label="Heures de sommeil"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Qualité de la nuit</p>
              <div className="mt-1.5 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onLogFieldChange("sleep_quality", n)}
                    aria-label={`Qualité ${n} sur 5`}
                    className={cn(
                      "h-8 flex-1 rounded-md border-2 text-xs font-semibold transition-all duration-150 active:scale-90",
                      dailyLog.sleep_quality !== null && n <= dailyLog.sleep_quality
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Diète : miroir en lecture des anneaux de la page Diète */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Diète</h2>
            {nutritionGoals ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                <DietMiniRing label="Kcal" value={foodTotals.calories} target={nutritionGoals.calories_target} color="var(--color-primary)" />
                <DietMiniRing label="Prot." value={foodTotals.protein} target={nutritionGoals.protein_target_g} color="var(--color-accent)" />
                <DietMiniRing label="Gluc." value={foodTotals.carbs} target={nutritionGoals.carbs_target_g} color="var(--color-primary)" />
                <DietMiniRing label="Lip." value={foodTotals.fat} target={nutritionGoals.fat_target_g} color="var(--color-destructive)" />
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Objectifs diète non définis pour l&apos;instant.</p>
            )}
          </div>

          {/* Qualité de la journée */}
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Qualité de la journée</h2>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onLogFieldChange("day_quality", n)}
                  aria-label={`Qualité de la journée ${n} sur 5`}
                  className={cn(
                    "h-8 flex-1 rounded-md border-2 text-xs font-semibold transition-all duration-150 active:scale-90",
                    dailyLog.day_quality !== null && n <= dailyLog.day_quality
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={dailyLog.day_comment ?? ""}
              onChange={(e) => onLogFieldChange("day_comment", e.target.value)}
              placeholder="Un commentaire sur la journée..."
              rows={2}
              className="mt-3 w-full resize-none rounded-md border border-input bg-transparent p-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Forfait : cycle fixe de 3 mois démarré par le coach — sans
              objet pour un client suivi par le Coach IA (pas de forfait de
              séances avec Joris dans ce cas). */}
          {!hideForfait && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Forfait</h2>
              {isCoach ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Input
                    type="number"
                    min="0"
                    value={goals.package_sessions}
                    onChange={(e) => onGoalFieldChange("package_sessions", Number(e.target.value) || 0)}
                    className="h-7 w-14 px-2 text-xs"
                  />
                  <span>séances /</span>
                  <Input
                    type="date"
                    value={goals.package_start_date}
                    onChange={(e) => onGoalFieldChange("package_start_date", e.target.value)}
                    className="h-7 w-[124px] px-2 text-xs"
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Objectif : {goals.package_sessions}</span>
              )}
            </div>
            {periodEnd && (
              <p className="mt-1 text-xs text-muted-foreground">
                Cycle de 3 mois : {formatShortDate(goals.package_start_date)} → {formatShortDate(periodEnd)}
              </p>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-foreground">{periodTotal}/{goals.package_sessions} séances</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => persistLog({ sessions_done: Math.max(0, dailyLog.sessions_done - 1) })}
                  className="flex size-7 items-center justify-center rounded-full border border-input text-muted-foreground transition-transform active:scale-90"
                  aria-label="Retirer une séance"
                >
                  <Minus className="size-3.5" />
                </button>
                <Input
                  type="number"
                  min="0"
                  value={dailyLog.sessions_done}
                  onChange={(e) => onLogFieldChange("sessions_done", Number(e.target.value) || 0)}
                  aria-label="Séances réalisées aujourd'hui"
                  className="h-7 w-14 px-2 text-center text-xs"
                />
                <button
                  type="button"
                  onClick={() => persistLog({ sessions_done: dailyLog.sessions_done + 1 })}
                  className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
                  aria-label="Ajouter une séance"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Séances réalisées aujourd&apos;hui</p>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

function DietMiniRing({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <CircularProgress value={value} max={target} size={54} strokeWidth={5} color={color}>
        <span className="text-[10px] font-bold text-foreground">{Math.round(value)}</span>
      </CircularProgress>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
