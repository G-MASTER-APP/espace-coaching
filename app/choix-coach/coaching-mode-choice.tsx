"use client";

import { useState, useTransition } from "react";

import { IntroOverlay, type IntroStep } from "@/components/intro-overlay";
import { shouldShowIntro, markIntroSeen } from "@/lib/intro-seen";
import { CoachJorisVisual, CoachIaVisual } from "@/components/intro-visuals";
import { chooseCoachingMode } from "./actions";

const JORIS_STEPS: IntroStep[] = [
  {
    icon: "🧑",
    title: "Ton coach, en vrai",
    body: "Joris construit ton programme, suit ta progression et te répond directement — un humain, pas un robot.",
    visual: <CoachJorisVisual />,
  },
  {
    icon: "📅",
    title: "Planning, diète, bilan",
    body: "Ton suivi au quotidien : organise tes séances, logue ce que tu manges, enregistre tes mensurations.",
    visual: <CoachJorisVisual />,
  },
];

const IA_STEPS: IntroStep[] = [
  {
    icon: "🤖",
    title: "Une IA disponible 24/7",
    body: "Elle construit ton programme en te posant des questions, puis t'accompagne au jour le jour — à l'écrit ou à l'oral.",
    visual: <CoachIaVisual />,
  },
  {
    icon: "🍽️",
    title: "Dis-lui simplement ce que tu manges",
    body: "\"J'ai mangé un sandwich et une pomme\" suffit — elle logue tout automatiquement dans ta diète.",
    visual: <CoachIaVisual />,
  },
  {
    icon: "📸",
    title: "Elle ajuste ton programme chaque semaine",
    body: "Une photo, ton poids, et elle adapte ton sport et ta diète — comme un vrai coach, en continu.",
  },
];

export function CoachingModeChoice({ currentMode }: { currentMode?: "joris" | "ia" | null }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<"joris" | "ia" | null>(null);

  function open(mode: "joris" | "ia") {
    if (shouldShowIntro(`coaching-mode-${mode}`)) {
      markIntroSeen(`coaching-mode-${mode}`);
      setActive(mode);
      return;
    }
    startTransition(() => {
      void chooseCoachingMode(mode);
    });
  }

  return (
    <>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => open("joris")}
          disabled={pending}
          className="rounded-2xl border border-border bg-card p-5 text-left disabled:opacity-60"
        >
          <p className="text-base font-extrabold text-foreground">🧑 Coach Joris</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Un vrai coach humain : programme, suivi et réponses directement par Joris.
          </p>
          {currentMode === "joris" && (
            <p className="mt-2 text-xs font-semibold text-primary">Ton coach actuel</p>
          )}
        </button>

        <button
          type="button"
          onClick={() => open("ia")}
          disabled={pending}
          className="rounded-2xl border border-border bg-card p-5 text-left disabled:opacity-60"
        >
          <p className="text-base font-extrabold text-foreground">🤖 Coach IA</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Disponible 24h/24 : construit ton programme, ajuste ta diète et ton sport, à l&apos;écrit comme à l&apos;oral.
          </p>
          {currentMode === "ia" && (
            <p className="mt-2 text-xs font-semibold text-primary">Ton coach actuel</p>
          )}
        </button>
      </div>

      {active === "joris" && (
        <IntroOverlay
          steps={JORIS_STEPS}
          ctaLabel="Choisir Coach Joris →"
          onFinish={() => startTransition(() => void chooseCoachingMode("joris"))}
        />
      )}

      {active === "ia" && (
        <IntroOverlay
          steps={IA_STEPS}
          ctaLabel="Choisir Coach IA →"
          onFinish={() => startTransition(() => void chooseCoachingMode("ia"))}
        />
      )}
    </>
  );
}
