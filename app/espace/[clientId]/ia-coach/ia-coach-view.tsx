"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { stopSpeaking } from "@/lib/jarvis/voice";
import { IaCoachChat } from "./ia-coach-chat";
import { IaVideoAnalyzer } from "./ia-video-analyzer";
import { IaLiveAnalyzer } from "./ia-live-analyzer";
import { ObjectifSelector } from "./objectif-selector";
import { PremierBilanPrompt } from "./premier-bilan-prompt";

type Message = { id?: string; role: "user" | "assistant"; content: string };
type Coaching = {
  spend_total: number;
  spend_cycle: number;
  spend_limit: number;
  onboarding_done: boolean;
  program: Record<string, unknown>;
  ai_name: string | null;
  objectif_tags: string[];
  objectif_details: string | null;
};
type Analysis = {
  id: string;
  exercise_name: string | null;
  feedback: string | null;
  cost_usd: number | null;
  created_at: string;
};

const TABS = [
  { key: "chat", label: "Discussion" },
  { key: "objectif", label: "Objectif" },
  { key: "video", label: "Vidéo / photo" },
  { key: "live", label: "Session live" },
] as const;

export function IaCoachView({
  clientId,
  isCoachView,
  initialMessages,
  coaching,
  analyses,
  hasBilan,
}: {
  clientId: string;
  isCoachView: boolean;
  initialMessages: Message[];
  coaching: Coaching;
  analyses: Analysis[];
  hasBilan: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("chat");
  const [muted, setMuted] = useState(false);
  const [objectifTags, setObjectifTags] = useState(coaching.objectif_tags);
  const [objectifDetails, setObjectifDetails] = useState(coaching.objectif_details ?? "");
  const [messages, setMessages] = useState(initialMessages);
  const [bilanDone, setBilanDone] = useState(hasBilan);
  const [bilanDismissed, setBilanDismissed] = useState(() => {
    try {
      return localStorage.getItem(`ia-coach-${clientId}-bilan-dismissed`) === "1";
    } catch {
      return false;
    }
  });

  function dismissBilanPrompt() {
    setBilanDismissed(true);
    try {
      localStorage.setItem(`ia-coach-${clientId}-bilan-dismissed`, "1");
    } catch {
      // ignoré
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(`ia-coach-${clientId}-muted`, next ? "1" : "0");
    } catch {
      // ignoré
    }
    if (next) stopSpeaking();
  }

  function applyObjectifUpdate(tags: string[], details: string, reply: string | null) {
    setObjectifTags(tags);
    setObjectifDetails(details);
    if (reply) {
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    }
  }

  // Onboarding : une fois l'objectif posé, on révèle directement la
  // discussion (il n'y a pas encore d'onglets à ce stade).
  function handleOnboardingObjectifSaved(tags: string[], details: string, reply: string | null) {
    applyObjectifUpdate(tags, details, reply);
    setTab("chat");
  }

  // Onglet Objectif (après onboarding) : on reste sur place — l'utilisateur
  // doit voir la confirmation d'enregistrement, pas être basculé ailleurs
  // sans explication (c'est ce qui donnait l'impression que "rien ne se
  // passait").
  function handleObjectifTabUpdate(tags: string[], details: string, reply: string | null) {
    applyObjectifUpdate(tags, details, reply);
  }

  // Onboarding pas fini et aucun objectif choisi : on bloque sur le
  // sélecteur avant de laisser le client discuter avec l'IA.
  const needsObjectifFirst = !isCoachView && !coaching.onboarding_done && objectifTags.length === 0;
  // Onboarding fini mais aucun bilan de départ : proposé (jamais bloquant,
  // le client peut le repousser à plus tard).
  const showBilanPrompt = !isCoachView && coaching.onboarding_done && !bilanDone && !bilanDismissed;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 py-6">
      <PageHeader
        icon="🤖"
        eyebrow={
          isCoachView
            ? `Vue coach — lecture seule${coaching.ai_name ? ` (surnommé "${coaching.ai_name}")` : ""}`
            : "Ton coach, disponible 24/7"
        }
        title={isCoachView ? "Coach IA" : coaching.ai_name || "Coach IA"}
        action={
          !isCoachView && (
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Réactiver la voix" : "Couper la voix"}
              className="flex size-9 items-center justify-center rounded-full text-muted-foreground"
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
          )
        }
      />

      {needsObjectifFirst ? (
        <ObjectifSelector
          initialTags={objectifTags}
          initialDetails={objectifDetails}
          isOnboarding
          onSaved={handleOnboardingObjectifSaved}
        />
      ) : (
        <>
          {showBilanPrompt && (
            <PremierBilanPrompt
              clientId={clientId}
              onDone={(saved) => {
                if (saved) setBilanDone(true);
                dismissBilanPrompt();
              }}
            />
          )}

          {!isCoachView && (
            <div className="flex gap-1 rounded-full bg-secondary/60 p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                    tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {(isCoachView || tab === "chat") && (
            <IaCoachChat
              clientId={clientId}
              isCoachView={isCoachView}
              initialMessages={messages}
              coaching={coaching}
              muted={muted}
            />
          )}
          {!isCoachView && tab === "objectif" && (
            <ObjectifSelector
              initialTags={objectifTags}
              initialDetails={objectifDetails}
              onSaved={handleObjectifTabUpdate}
            />
          )}
          {!isCoachView && tab === "video" && <IaVideoAnalyzer clientId={clientId} muted={muted} />}
          {!isCoachView && tab === "live" && <IaLiveAnalyzer muted={muted} />}
        </>
      )}

      {analyses.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Historique des analyses
          </p>
          {analyses.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{a.exercise_name || "Analyse"}</span>
                <span>
                  {new Date(a.created_at).toLocaleDateString("fr-FR")}
                  {isCoachView && a.cost_usd ? ` · ${a.cost_usd.toFixed(3)} $` : ""}
                </span>
              </div>
              {a.feedback && <p className="mt-1 whitespace-pre-wrap text-foreground">{a.feedback}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
