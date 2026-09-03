"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { SaveIndicator } from "@/components/save-indicator";
import { PageHeader } from "@/components/page-header";
import { CircularProgress } from "@/components/circular-progress";
import { formatFrenchDate } from "@/lib/date/paris-week";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Priority = "low" | "medium" | "high";
type DayEntry = { done: boolean; note: string; priority: Priority | null };

const EMPTY_DAY: DayEntry = { done: false, note: "", priority: null };

const PRIORITIES: { key: Priority; label: string; dot: string }[] = [
  { key: "low", label: "Priorité basse", dot: "bg-muted-foreground" },
  { key: "medium", label: "Priorité moyenne", dot: "bg-accent" },
  { key: "high", label: "Priorité haute", dot: "bg-destructive" },
];

function normalizeDays(raw: unknown): DayEntry[] {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 7 }, (_, i) => {
    const entry = arr[i];
    if (!entry || typeof entry !== "object") return { ...EMPTY_DAY };
    const e = entry as Partial<DayEntry>;
    return {
      done: Boolean(e.done),
      note: typeof e.note === "string" ? e.note : "",
      priority: e.priority === "low" || e.priority === "medium" || e.priority === "high" ? e.priority : null,
    };
  });
}

export function PlanningBoard({
  planningId,
  weekStart,
  initialDays,
}: {
  planningId: string;
  weekStart: string;
  initialDays: unknown;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [days, setDays] = useState<DayEntry[]>(() => normalizeDays(initialDays));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const editingIndexRef = useRef<Set<number>>(new Set());

  async function persist(next: DayEntry[]) {
    setSaveStatus("saving");
    const { error } = await supabase.from("plannings").update({ days: next }).eq("id", planningId);
    setSaveStatus(error ? "idle" : "saved");
  }

  const debouncedPersist = useDebouncedCallback((next: DayEntry[]) => {
    void persist(next);
  }, 700);

  useEffect(() => {
    const channel = supabase
      .channel(`planning-${planningId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "plannings", filter: `id=eq.${planningId}` },
        (payload) => {
          const incoming = normalizeDays((payload.new as { days: unknown }).days);
          setDays((current) =>
            incoming.map((day, i) =>
              editingIndexRef.current.has(i) ? { ...day, note: current[i].note } : day
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, planningId]);

  const doneCount = days.filter((d) => d.done).length;
  const progress = Math.round((doneCount / 7) * 100);

  function toggleDone(index: number) {
    const next = days.map((d, i) => (i === index ? { ...d, done: !d.done } : d));
    setDays(next);
    void persist(next);
  }

  function setPriority(index: number, priority: Priority) {
    const next = days.map((d, i) =>
      i === index ? { ...d, priority: d.priority === priority ? null : priority } : d
    );
    setDays(next);
    void persist(next);
  }

  function onNoteChange(index: number, value: string) {
    editingIndexRef.current.add(index);
    const next = days.map((d, i) => (i === index ? { ...d, note: value } : d));
    setDays(next);
    debouncedPersist(next);
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <div>
        <PageHeader
          icon="📅"
          eyebrow={`Semaine du ${formatFrenchDate(weekStart)}`}
          title="Planning"
          action={<SaveIndicator status={saveStatus} />}
        />
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-border bg-card p-3 shadow-sm">
          <CircularProgress value={doneCount} max={7} size={56} strokeWidth={6}>
            <span className="text-xs font-bold text-foreground">{doneCount}/7</span>
          </CircularProgress>
          <div>
            <p className="text-sm font-semibold text-foreground">{progress}% de la semaine</p>
            <p className="text-xs text-muted-foreground">
              {doneCount === 7 ? "Semaine complète, bravo !" : "Continue comme ça."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((day, index) => (
          <div
            key={index}
            className={cn(
              "rounded-xl border p-3 shadow-sm transition-colors duration-300",
              day.done ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggleDone(index)}
                aria-label={day.done ? "Marquer non fait" : "Marquer fait"}
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90",
                  day.done
                    ? "scale-105 border-primary bg-primary text-primary-foreground"
                    : "border-input text-transparent"
                )}
              >
                <Check className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      day.done ? "text-muted-foreground line-through" : "text-foreground"
                    )}
                  >
                    {DAY_LABELS[index]}
                  </span>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        title={p.label}
                        aria-label={p.label}
                        onClick={() => setPriority(index, p.key)}
                        className={cn(
                          "size-3 rounded-full transition-all duration-150 active:scale-75",
                          p.dot,
                          day.priority === p.key
                            ? "scale-125 opacity-100 ring-2 ring-offset-1 ring-ring"
                            : "opacity-25 hover:opacity-60"
                        )}
                      />
                    ))}
                  </div>
                </div>
                <textarea
                  value={day.note}
                  onChange={(e) => onNoteChange(index, e.target.value)}
                  onBlur={() => editingIndexRef.current.delete(index)}
                  placeholder="Prévu ce jour-là..."
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-md border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
