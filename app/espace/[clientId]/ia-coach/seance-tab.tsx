"use client";

import { useState } from "react";

import { SeancePlayer, type Seance } from "./seance-player";

type Recap = { totalSets: number; totalVolumeKg: number; exercisesCount: number };

export function SeanceTab({
  program,
  lastPerformance,
}: {
  program: Record<string, unknown>;
  lastPerformance: Record<string, { poids_kg: number; repetitions: number }[]>;
}) {
  const seances = Array.isArray(program.seances) ? (program.seances as Seance[]) : [];
  const [active, setActive] = useState<Seance | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);

  if (recap) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm font-semibold text-foreground">Séance enregistrée 💪</p>
        <div className="flex justify-center gap-6 text-sm">
          <div>
            <p className="text-xl font-bold text-primary">{recap.exercisesCount}</p>
            <p className="text-xs text-muted-foreground">exercices</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary">{recap.totalSets}</p>
            <p className="text-xs text-muted-foreground">séries</p>
          </div>
          <div>
            <p className="text-xl font-bold text-primary">{recap.totalVolumeKg}</p>
            <p className="text-xs text-muted-foreground">kg soulevés (total)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRecap(null)}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Retour aux séances
        </button>
      </div>
    );
  }

  if (active) {
    return (
      <SeancePlayer
        seance={active}
        lastPerformance={lastPerformance}
        onCancel={() => setActive(null)}
        onFinished={(r) => {
          setRecap(r);
          setActive(null);
        }}
      />
    );
  }

  if (seances.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Pas encore de séances structurées — discute avec ton coach pour qu&apos;il t&apos;en prépare.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {seances.map((s, i) => (
        <button
          key={s.nom + i}
          type="button"
          onClick={() => setActive(s)}
          className="rounded-xl border border-border bg-card p-4 text-left"
        >
          <p className="text-sm font-semibold text-foreground">{s.nom}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {s.exercices.length} exercice{s.exercices.length > 1 ? "s" : ""}
          </p>
        </button>
      ))}
    </div>
  );
}
