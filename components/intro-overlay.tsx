"use client";

import { useState } from "react";

export type IntroStep = {
  icon: string;
  title: string;
  body: string;
  /** Aperçu visuel de l'écran concerné, affiché à la place du simple cercle-icône. */
  visual?: React.ReactNode;
};

export function IntroOverlay({
  steps,
  ctaLabel,
  onFinish,
}: {
  steps: IntroStep[];
  ctaLabel: string;
  onFinish: () => void;
}) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {step.visual ?? (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-4xl">
            {step.icon}
          </div>
        )}
        <h2 className="mt-6 text-xl font-extrabold text-foreground">{step.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-8 flex gap-1.5">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-5 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (last ? onFinish() : setI(i + 1))}
          className="mt-8 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        >
          {last ? ctaLabel : "Suivant →"}
        </button>
      </div>
    </div>
  );
}
