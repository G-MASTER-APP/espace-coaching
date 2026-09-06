"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

type Serie = { poids_kg: number; repetitions: number; done?: boolean };
type Exercice = { nom: string; series: Serie[]; repos_secondes?: number };
export type Seance = { nom: string; exercices: Exercice[] };
type Recap = { totalSets: number; totalVolumeKg: number; exercisesCount: number };

export function SeancePlayer({
  seance,
  onFinished,
  onCancel,
}: {
  seance: Seance;
  onFinished: (recap: Recap) => void;
  onCancel: () => void;
}) {
  const [exercices, setExercices] = useState<Exercice[]>(() =>
    seance.exercices.map((ex) => ({ ...ex, series: ex.series.map((s) => ({ ...s, done: false })) }))
  );
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRest(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRestRemaining((current) => {
        if (current === null || current <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return null;
        }
        return current - 1;
      });
    }, 1000);
  }

  function updateSerie(exIdx: number, serieIdx: number, patch: Partial<Serie>) {
    setExercices((current) =>
      current.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, series: ex.series.map((s, j) => (j !== serieIdx ? s : { ...s, ...patch })) }
      )
    );
  }

  function validateSerie(exIdx: number, serieIdx: number) {
    updateSerie(exIdx, serieIdx, { done: true });
    startRest(exercices[exIdx].repos_secondes || 60);
  }

  async function finish() {
    setSaving(true);
    try {
      const res = await fetch("/api/ia-coach/seance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seanceNom: seance.nom,
          exercices: exercices.map((ex) => ({
            nom: ex.nom,
            series: ex.series.map((s) => ({ poids_kg: s.poids_kg, repetitions: s.repetitions })),
          })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { recap: Recap };
        onFinished(data.recap);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{seance.nom}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>

      {restRemaining !== null && (
        <div className="rounded-xl bg-primary/10 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Repos</p>
          <p className="text-2xl font-bold text-primary">{restRemaining}s</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {exercices.map((ex, exIdx) => (
          <div key={ex.nom + exIdx} className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">{ex.nom}</p>
            <div className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
              <span className="text-muted-foreground">Série</span>
              <span className="text-muted-foreground">Poids (kg)</span>
              <span className="text-muted-foreground">Répétitions</span>
              <span />
              {ex.series.map((s, serieIdx) => (
                <FragmentRow
                  key={serieIdx}
                  index={serieIdx}
                  serie={s}
                  onChange={(patch) => updateSerie(exIdx, serieIdx, patch)}
                  onValidate={() => validateSerie(exIdx, serieIdx)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" onClick={finish} disabled={saving}>
        {saving ? "Enregistrement…" : "Terminer la séance"}
      </Button>
    </div>
  );
}

function FragmentRow({
  index,
  serie,
  onChange,
  onValidate,
}: {
  index: number;
  serie: Serie;
  onChange: (patch: Partial<Serie>) => void;
  onValidate: () => void;
}) {
  return (
    <>
      <span className="text-foreground">{index + 1}</span>
      <input
        type="number"
        step="0.5"
        min="0"
        value={serie.poids_kg}
        onChange={(e) => onChange({ poids_kg: Number(e.target.value) })}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
      />
      <input
        type="number"
        min="0"
        value={serie.repetitions}
        onChange={(e) => onChange({ repetitions: Number(e.target.value) })}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
      />
      <button
        type="button"
        onClick={onValidate}
        aria-label="Valider la série"
        className={
          serie.done
            ? "flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
            : "flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground"
        }
      >
        <Check className="size-4" />
      </button>
    </>
  );
}
