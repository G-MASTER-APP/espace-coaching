"use client";

import { useState } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { stopSpeaking } from "@/lib/jarvis/voice";
import { IaCoachChat } from "./ia-coach-chat";
import { IaVideoAnalyzer } from "./ia-video-analyzer";
import { IaLiveAnalyzer } from "./ia-live-analyzer";
import { ObjectifSelector } from "./objectif-selector";
import { AiNameStep } from "./ai-name-step";
import { OnboardingChecklistStep } from "./onboarding-checklist-step";
import { PremierBilanPrompt } from "./premier-bilan-prompt";
import { SeanceTab } from "./seance-tab";
import { SPORT_OPTIONS } from "@/lib/ia-coach/sport-options";
import { ANTECEDENTS_OPTIONS } from "@/lib/ia-coach/antecedents-options";
import { ACTIVITE_OPTIONS } from "@/lib/ia-coach/activite-options";

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
  sport_tags: string[];
  sport_details: string | null;
  antecedents_tags: string[];
  antecedents_details: string | null;
  activite_tags: string[];
  activite_details: string | null;
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
  { key: "seance", label: "Séance" },
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
  lastPerformance,
}: {
  clientId: string;
  isCoachView: boolean;
  initialMessages: Message[];
  coaching: Coaching;
  analyses: Analysis[];
  hasBilan: boolean;
  lastPerformance: Record<string, { poids_kg: number; repetitions: number }[]>;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("chat");
  const [muted, setMuted] = useState(false);
  const [aiName, setAiName] = useState(coaching.ai_name);
  const [objectifTags, setObjectifTags] = useState(coaching.objectif_tags);
  const [objectifDetails, setObjectifDetails] = useState(coaching.objectif_details ?? "");
  const [sportTags, setSportTags] = useState(coaching.sport_tags);
  const [sportDetails, setSportDetails] = useState(coaching.sport_details ?? "");
  const [antecedentsTags, setAntecedentsTags] = useState(coaching.antecedents_tags);
  const [antecedentsDetails, setAntecedentsDetails] = useState(coaching.antecedents_details ?? "");
  const [activiteTags, setActiviteTags] = useState(coaching.activite_tags);
  const [buildingProgram, setBuildingProgram] = useState(false);
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

  // Onboarding : après l'objectif, d'autres questions à cases à cocher
  // suivent encore (sport, antécédents) — on avance juste à la suivante,
  // la discussion ne se révèle qu'après la dernière.
  function handleOnboardingObjectifSaved(tags: string[], details: string, reply: string | null) {
    applyObjectifUpdate(tags, details, reply);
  }

  // Onglet Objectif (après onboarding) : on reste sur place — l'utilisateur
  // doit voir la confirmation d'enregistrement, pas être basculé ailleurs
  // sans explication (c'est ce qui donnait l'impression que "rien ne se
  // passait").
  function handleObjectifTabUpdate(tags: string[], details: string, reply: string | null) {
    applyObjectifUpdate(tags, details, reply);
  }

  function handleSportSaved(tags: string[], details: string) {
    setSportTags(tags);
    setSportDetails(details);
  }

  function handleSanteSaved(tags: string[], details: string) {
    setAntecedentsTags(tags);
    setAntecedentsDetails(details);
  }

  // Dernière question de l'onboarding : la réponse envoie tout au Coach IA
  // (objectif + sport + antécédents + activité sont déjà connus côté
  // serveur via le system prompt) qui construit le programme et les
  // habitudes immédiatement — on révèle alors la discussion.
  function handleActiviteSaved(tags: string[], _details: string, reply: string | null) {
    setActiviteTags(tags);
    setBuildingProgram(false);
    if (reply) {
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    }
    setTab("chat");
  }

  // Avant même l'objectif : le client choisit le nom de son IA.
  const needsNameFirst = !isCoachView && !coaching.onboarding_done && !aiName;
  // Onboarding pas fini et aucun objectif choisi : on bloque sur le
  // sélecteur avant de laisser le client discuter avec l'IA.
  const needsObjectifFirst =
    !isCoachView && !coaching.onboarding_done && !needsNameFirst && objectifTags.length === 0;
  // Puis sport & matériel, puis antécédents médicaux, puis niveau
  // d'activité — même principe, une question à la fois avant de laisser
  // parler l'IA.
  const needsSportFirst =
    !isCoachView && !coaching.onboarding_done && !needsNameFirst && !needsObjectifFirst && sportTags.length === 0;
  const needsSanteFirst =
    !isCoachView &&
    !coaching.onboarding_done &&
    !needsNameFirst &&
    !needsObjectifFirst &&
    !needsSportFirst &&
    antecedentsTags.length === 0;
  const needsActiviteFirst =
    !isCoachView &&
    !coaching.onboarding_done &&
    !needsNameFirst &&
    !needsObjectifFirst &&
    !needsSportFirst &&
    !needsSanteFirst &&
    activiteTags.length === 0;
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
        title={isCoachView ? "Coach IA" : aiName || "Coach IA"}
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

      {needsNameFirst ? (
        <AiNameStep onSaved={setAiName} />
      ) : needsObjectifFirst ? (
        <ObjectifSelector
          initialTags={objectifTags}
          initialDetails={objectifDetails}
          isOnboarding
          onSaved={handleOnboardingObjectifSaved}
        />
      ) : needsSportFirst ? (
        <OnboardingChecklistStep
          key="sport"
          title="Ton sport & ton matériel"
          subtitle="Coche ce qui te correspond — tu peux cocher plusieurs cases."
          options={SPORT_OPTIONS}
          freeformLabel="Ton objectif précis pour ce(s) sport(s) (obligatoire)"
          freeformPlaceholder="Ex. Je veux courir un 10km, prendre du muscle sur le haut du corps, tenir 30 min de course sans marcher..."
          freeformRequired
          freeformErrorMessage="Précise ce que tu veux atteindre avec ce sport — l'IA en a besoin pour construire les bonnes séances."
          apiPath="/api/ia-coach/sport"
          continueLabel="Question suivante"
          onSaved={handleSportSaved}
        />
      ) : needsSanteFirst ? (
        <OnboardingChecklistStep
          key="sante"
          title="Antécédents médicaux"
          subtitle="Coche ce qui s'applique — important pour un programme adapté et sans risque."
          options={ANTECEDENTS_OPTIONS}
          freeformPlaceholder="Ex. Opération du genou il y a 2 ans"
          apiPath="/api/ia-coach/sante"
          continueLabel="Question suivante"
          onSaved={handleSanteSaved}
        />
      ) : needsActiviteFirst ? (
        buildingProgram ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Ton Coach IA construit ton programme et tes objectifs du jour...
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Une première base, déjà adaptée à tes réponses — parle-lui ensuite dans le chat pour qu&apos;il
              l&apos;affine précisément à toi.
            </p>
          </div>
        ) : (
          <OnboardingChecklistStep
            key="activite"
            title="Ton niveau d'activité"
            subtitle="En dehors du sport prévu, comment décrirais-tu tes journées ?"
            options={ACTIVITE_OPTIONS}
            freeformPlaceholder="Optionnel"
            apiPath="/api/ia-coach/activite"
            continueLabel="C'est parti"
            buildSummary={(tags, details) => {
              const sportPart =
                `Sport & matériel : ${sportTags.join(", ")}` + (sportDetails ? ` (${sportDetails})` : "") + ".";
              const santePart =
                `Antécédents médicaux : ${antecedentsTags.join(", ")}` +
                (antecedentsDetails.trim() ? ` (${antecedentsDetails.trim()})` : "") +
                ".";
              const activitePart =
                `Niveau d'activité : ${tags.join(", ")}` + (details.trim() ? ` (${details.trim()})` : "") + ".";
              return `${sportPart} ${santePart} ${activitePart}`;
            }}
            onSubmitStart={() => setBuildingProgram(true)}
            onSaved={handleActiviteSaved}
          />
        )
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
          {!isCoachView && tab === "seance" && (
            <SeanceTab program={coaching.program} lastPerformance={lastPerformance} />
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
