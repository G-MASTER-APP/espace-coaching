"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Client = { id: string; full_name: string | null };
type Seance = {
  nom: string;
  exercices?: { nom: string; series: { poids_kg: number; repetitions: number }[]; repos_secondes?: number }[];
  cardio?: { activite: string; duree_minutes?: number; distance_km?: number; allure_cible?: string; description?: string };
};
type DraftDiete = {
  calories_target?: number;
  protein_target_g?: number;
  carbs_target_g?: number;
  fat_target_g?: number;
};
type DraftObjectif = { tags: string[]; details?: string };

type Message = {
  role: "user" | "assistant";
  content: string;
  draftProgramme?: Seance[] | null;
  draftDiete?: DraftDiete | null;
  draftObjectif?: DraftObjectif | null;
  applied?: { programme?: boolean; diete?: boolean; objectif?: boolean };
};

export function AssistantView({ clients }: { clients: Client[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Changer de client repart d'une conversation neuve — le contexte
    // (programme/diète/objectif actuels) est propre à chaque client, mixer
    // deux clients dans le même fil n'aurait pas de sens.
    setMessages([]);
    setErrorMsg(null);
  }, [clientId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending || !clientId) return;
    setErrorMsg(null);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setTextInput("");
    setSending(true);
    try {
      const res = await fetch("/api/coach-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, text: trimmed, history }),
      });
      const data = (await res.json()) as {
        reply?: string;
        draftProgramme?: Seance[] | null;
        draftDiete?: DraftDiete | null;
        draftObjectif?: DraftObjectif | null;
        error?: string;
      };
      if (!res.ok || !data.reply) {
        setErrorMsg(data.error ?? "L'assistant n'a pas pu répondre.");
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.reply!,
          draftProgramme: data.draftProgramme,
          draftDiete: data.draftDiete,
          draftObjectif: data.draftObjectif,
        },
      ]);
    } catch {
      setErrorMsg("Connexion impossible — réessaie.");
    } finally {
      setSending(false);
    }
  }

  async function applyDraft(index: number, kind: "programme" | "diete" | "objectif", draft: unknown) {
    const res = await fetch("/api/coach-assistant/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, kind, draft }),
    });
    if (!res.ok) {
      setErrorMsg("Impossible d'appliquer ce brouillon.");
      return;
    }
    setMessages((m) =>
      m.map((msg, i) => (i === index ? { ...msg, applied: { ...msg.applied, [kind]: true } } : msg))
    );
  }

  if (clients.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun client rattaché pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.full_name || "Sans nom"}
          </option>
        ))}
      </select>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ex. &quot;programme muscu 4x/semaine pour un débutant en salle&quot;, &quot;diète prise de masse
            2800 kcal&quot;, &quot;objectif : perte de poids, -5kg en 2 mois&quot;.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                m.role === "assistant" ? "bg-secondary text-secondary-foreground" : "ml-auto bg-primary text-primary-foreground"
              )}
            >
              {m.content}
            </div>
            {m.draftProgramme && m.draftProgramme.length > 0 && (
              <DraftCard title="Brouillon — Programme" applied={m.applied?.programme}>
                <div className="flex flex-col gap-1.5">
                  {m.draftProgramme.map((s, si) => (
                    <div key={si} className="text-xs text-foreground">
                      <span className="font-semibold">{s.nom}</span>
                      {s.exercices?.length ? ` — ${s.exercices.length} exercice${s.exercices.length > 1 ? "s" : ""}` : ""}
                      {s.cardio ? ` — ${s.cardio.activite}${s.cardio.duree_minutes ? `, ${s.cardio.duree_minutes} min` : ""}` : ""}
                    </div>
                  ))}
                </div>
                <ApplyButton
                  applied={m.applied?.programme}
                  onClick={() => applyDraft(i, "programme", m.draftProgramme)}
                />
              </DraftCard>
            )}
            {m.draftDiete && (
              <DraftCard title="Brouillon — Diète" applied={m.applied?.diete}>
                <div className="flex flex-wrap gap-3 text-xs text-foreground">
                  {m.draftDiete.calories_target !== undefined && <span>{m.draftDiete.calories_target} kcal</span>}
                  {m.draftDiete.protein_target_g !== undefined && <span>P {m.draftDiete.protein_target_g}g</span>}
                  {m.draftDiete.carbs_target_g !== undefined && <span>G {m.draftDiete.carbs_target_g}g</span>}
                  {m.draftDiete.fat_target_g !== undefined && <span>L {m.draftDiete.fat_target_g}g</span>}
                </div>
                <ApplyButton applied={m.applied?.diete} onClick={() => applyDraft(i, "diete", m.draftDiete)} />
              </DraftCard>
            )}
            {m.draftObjectif && (
              <DraftCard title="Brouillon — Objectif" applied={m.applied?.objectif}>
                <p className="text-xs text-foreground">
                  {m.draftObjectif.tags.join(", ")}
                  {m.draftObjectif.details ? ` — ${m.draftObjectif.details}` : ""}
                </p>
                <ApplyButton
                  applied={m.applied?.objectif}
                  onClick={() => applyDraft(i, "objectif", m.draftObjectif)}
                />
              </DraftCard>
            )}
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(textInput)}
          placeholder="Décris ce que tu veux..."
          disabled={sending}
          className="h-10 flex-1 rounded-full border border-input bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Button type="button" onClick={() => send(textInput)} disabled={sending}>
          {sending ? "..." : "Envoyer"}
        </Button>
      </div>
    </div>
  );
}

function DraftCard({ title, applied, children }: { title: string; applied?: boolean; children: React.ReactNode }) {
  return (
    <div className="max-w-[90%] rounded-xl border border-border bg-card p-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {applied && <span className="ml-2 text-primary">✓ appliqué</span>}
      </p>
      {children}
    </div>
  );
}

function ApplyButton({ applied, onClick }: { applied?: boolean; onClick: () => void }) {
  return (
    <Button type="button" size="sm" variant={applied ? "outline" : "default"} className="mt-2" onClick={onClick}>
      {applied ? "Ré-appliquer" : "Appliquer chez le client"}
    </Button>
  );
}
