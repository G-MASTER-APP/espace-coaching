"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

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
      {seances.map((s, i) => {
        const hasExercices = Array.isArray(s.exercices) && s.exercices.length > 0;
        if (hasExercices) {
          return (
            <button
              key={s.nom + i}
              type="button"
              onClick={() => setActive(s)}
              className="rounded-xl border border-border bg-card p-4 text-left"
            >
              <p className="text-sm font-semibold text-foreground">{s.nom}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.exercices!.length} exercice{s.exercices!.length > 1 ? "s" : ""}
              </p>
            </button>
          );
        }
        if (s.cardio) {
          return <CardioCard key={s.nom + i} seance={s} />;
        }
        return null;
      })}
    </div>
  );
}

// Une séance cardio (course, vélo, natation...) n'a pas de séries
// poids/répétitions à suivre exercice par exercice — juste une présentation
// claire des chiffres clés (distance, durée, allure) et de la description.
// Exporté : réutilisé tel quel pour l'affichage lecture seule du programme
// d'un client suivi par le coach humain (app/espace/[clientId]/programme).
export function CardioCard({ seance }: { seance: Seance }) {
  const c = seance.cardio!;
  const stats = [
    c.distance_km ? { label: "Distance", value: `${c.distance_km} km` } : null,
    c.duree_minutes ? { label: "Durée", value: `${c.duree_minutes} min` } : null,
    c.allure_cible ? { label: "Allure", value: c.allure_cible } : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Activity className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{seance.nom}</p>
          <p className="text-xs text-muted-foreground">{c.activite}</p>
        </div>
      </div>
      {stats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-5">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-base font-bold text-primary">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {c.description && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{c.description}</p>}
    </div>
  );
}
