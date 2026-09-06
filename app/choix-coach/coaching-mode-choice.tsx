"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntroOverlay, type IntroStep } from "@/components/intro-overlay";
import { shouldShowIntro, markIntroSeen } from "@/lib/intro-seen";
import { CoachJorisVisual, CoachIaVisual } from "@/components/intro-visuals";
import { chooseCoachingMode } from "./actions";

const OPTIONS = [
  {
    mode: "joris" as const,
    icon: "🧑",
    title: "Coach Joris",
    body: "Un vrai coach humain : Joris construit ton programme, suit ta progression et te répond directement.",
  },
  {
    mode: "ia" as const,
    icon: "🤖",
    title: "Coach IA",
    body: "Une IA disponible à toute heure : elle construit ton programme, ajuste ta diète et ton sport chaque semaine, et répond à tes questions à l'écrit comme à l'oral.",
  },
];

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
  const [namingIa, setNamingIa] = useState(false);
  const [aiName, setAiName] = useState("");
  const [intro, setIntro] = useState<"joris" | "ia" | null>(null);

  function submit(mode: "joris" | "ia", name?: string) {
    startTransition(() => {
      void chooseCoachingMode(mode, name);
    });
  }

  function chooseJoris() {
    if (shouldShowIntro("coaching-mode-joris")) {
      markIntroSeen("coaching-mode-joris");
      setIntro("joris");
      return;
    }
    submit("joris");
  }

  function confirmIa() {
    const name = aiName.trim() || undefined;
    if (shouldShowIntro("coaching-mode-ia")) {
      markIntroSeen("coaching-mode-ia");
      setIntro("ia");
      return;
    }
    submit("ia", name);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {OPTIONS.map((option) => {
          const isCurrent = currentMode === option.mode;
          return (
            <Card key={option.mode} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
                  <span aria-hidden>{option.icon}</span>
                </div>
                <p className="text-base font-semibold text-foreground">{option.title}</p>
                {isCurrent && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    Actuel
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{option.body}</p>

              {option.mode === "joris" && !isCurrent && (
                <Button type="button" onClick={chooseJoris} disabled={pending}>
                  {pending ? "C'est parti…" : currentMode ? "Repasser en Coach Joris" : "Choisir Coach Joris"}
                </Button>
              )}

              {option.mode === "ia" && !isCurrent && !namingIa && (
                <Button type="button" onClick={() => setNamingIa(true)} disabled={pending}>
                  {currentMode ? "Repasser en Coach IA" : "Choisir Coach IA"}
                </Button>
              )}

              {option.mode === "ia" && namingIa && (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
                    Comment veux-tu l&apos;appeler ?
                    <Input
                      value={aiName}
                      onChange={(e) => setAiName(e.target.value)}
                      placeholder="Ex. Max, Coach Alex, Léo…"
                      disabled={pending}
                      maxLength={30}
                    />
                  </label>
                  <Button type="button" onClick={confirmIa} disabled={pending}>
                    {pending ? "C'est parti…" : "Confirmer"}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {intro && (
        <IntroOverlay
          steps={intro === "joris" ? JORIS_STEPS : IA_STEPS}
          ctaLabel="C'est parti →"
          onFinish={() => {
            const mode = intro;
            setIntro(null);
            submit(mode, mode === "ia" ? aiName.trim() || undefined : undefined);
          }}
        />
      )}
    </>
  );
}
