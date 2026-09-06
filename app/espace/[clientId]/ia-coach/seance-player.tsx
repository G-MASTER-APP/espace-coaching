"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

type PrescribedSerie = { poids_kg: number; repetitions: number };
type Serie = { poids_kg: number | null; repetitions: number | null; done?: boolean };
type Exercice = { nom: string; series: PrescribedSerie[]; repos_secondes?: number };
type LiveExercice = { nom: string; series: Serie[]; repos_secondes?: number };
export type Seance = { nom: string; exercices: Exercice[] };
type Recap = { totalSets: number; totalVolumeKg: number; exercisesCount: number };
type LastPerformance = Record<string, PrescribedSerie[]>;

export function SeancePlayer({
  seance,
  lastPerformance,
  onFinished,
  onCancel,
}: {
  seance: Seance;
  lastPerformance: LastPerformance;
  onFinished: (recap: Recap) => void;
  onCancel: () => void;
}) {
  // Si une dernière performance existe pour cet exercice, la case démarre
  // vide (le chiffre d'avant s'affiche juste en filigrane, façon Hevy) —
  // sinon elle démarre pré-remplie avec ce que l'IA a prescrit, pour ne
  // pas laisser un client sans aucun repère la toute première fois.
  const [exercices, setExercices] = useState<LiveExercice[]>(() =>
    seance.exercices.map((ex) => {
      const hasHistory = Boolean(lastPerformance[ex.nom]?.length);
      return {
        ...ex,
        series: ex.series.map((s) => ({
          poids_kg: hasHistory ? null : s.poids_kg,
          repetitions: hasHistory ? null : s.repetitions,
          done: false,
        })),
      };
    })
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

  function placeholderFor(exNom: string, serieIdx: number, prescribed: PrescribedSerie) {
    return lastPerformance[exNom]?.[serieIdx] ?? prescribed;
  }

  async function finish() {
    setSaving(true);
    try {
      const res = await fetch("/api/ia-coach/seance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seanceNom: seance.nom,
          // Case laissée vide -> on garde ce qui était affiché en filigrane
          // (dernière fois, ou à défaut la prescription de l'IA) : le
          // client n'a rien tapé, donc rien n'a changé par rapport à ça.
          exercices: exercices.map((ex, exIdx) => ({
            nom: ex.nom,
            series: ex.series.map((s, serieIdx) => {
              const fallback = placeholderFor(ex.nom, serieIdx, seance.exercices[exIdx].series[serieIdx]);
              return {
                poids_kg: s.poids_kg ?? fallback.poids_kg,
                repetitions: s.repetitions ?? fallback.repetitions,
              };
            }),
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
              {ex.series.map((s, serieIdx) => {
                const ph = placeholderFor(ex.nom, serieIdx, seance.exercices[exIdx].series[serieIdx]);
                return (
                  <FragmentRow
                    key={serieIdx}
                    index={serieIdx}
                    serie={s}
                    placeholder={ph}
                    onChange={(patch) => updateSerie(exIdx, serieIdx, patch)}
                    onValidate={() => validateSerie(exIdx, serieIdx)}
                  />
                );
              })}
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
  placeholder,
  onChange,
  onValidate,
}: {
  index: number;
  serie: Serie;
  placeholder: PrescribedSerie;
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
        value={serie.poids_kg ?? ""}
        placeholder={String(placeholder.poids_kg)}
        onChange={(e) => onChange({ poids_kg: e.target.value === "" ? null : Number(e.target.value) })}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground/50"
      />
      <input
        type="number"
        min="0"
        value={serie.repetitions ?? ""}
        placeholder={String(placeholder.repetitions)}
        onChange={(e) => onChange({ repetitions: e.target.value === "" ? null : Number(e.target.value) })}
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground placeholder:text-muted-foreground/50"
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
