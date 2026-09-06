"use client";

import { useEffect, useRef, useState } from "react";
import { Ear, EarOff, Mic, MicOff, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { createRecognizer, describeMicError, isVoiceSupported, pickPreferredVoice, speak } from "@/lib/jarvis/voice";

type Message = { id?: string; role: "user" | "assistant"; content: string };
type Coaching = {
  spend_total: number;
  spend_cycle: number;
  spend_limit: number;
  onboarding_done: boolean;
  program: Record<string, unknown>;
};

export function IaCoachChat({
  clientId,
  isCoachView,
  initialMessages,
  coaching,
  muted,
  aiName,
  onOnboardingDone,
}: {
  clientId: string;
  isCoachView: boolean;
  initialMessages: Message[];
  coaching: Coaching;
  muted: boolean;
  // Nécessaire pour l'écoute vocale "mot de réveil" : sans nom, rien à
  // guetter dans ce que dit le client.
  aiName?: string | null;
  // La réponse peut faire passer onboarding_done à true (le programme
  // vient d'être construit) — sans ça, la bannière "on construit ton
  // programme" et le brief bilan restaient figés jusqu'au rechargement.
  onOnboardingDone?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // Écoute passive en continu : le client dit juste le nom de son IA (ex.
  // "LeBoss") pour l'activer, sans toucher à un bouton. Off par défaut —
  // ça demande d'autoriser le micro en continu, jamais sans action
  // explicite du client.
  const [wakeMode, setWakeMode] = useState(false);
  // true = le mot de réveil vient d'être entendu, on attend la commande
  // qui suit (anime le bouton pour montrer que ça écoute activement).
  const [awake, setAwake] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const wakeRecognizerRef = useRef<ReturnType<typeof createRecognizer>>(null);
  const awakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCoachView) return;
    setVoiceSupported(isVoiceSupported());
    const loadVoices = () => {
      voiceRef.current = pickPreferredVoice();
    };
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      loadVoices();
    }
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isCoachView) return;
    try {
      setWakeMode(localStorage.getItem(`ia-coach-${clientId}-wake`) === "1");
    } catch {
      // ignoré
    }
  }, [clientId, isCoachView]);

  // Écoute continue du mot de réveil (le nom de l'IA). Se relance toute
  // seule à chaque `onend` tant que le mode est actif — gère à la fois les
  // erreurs passagères (silence prolongé, etc.) et les navigateurs qui
  // coupent la reconnaissance même avec `continuous: true` (Safari
  // notamment), sans quoi l'écoute s'arrêterait au bout de quelques
  // phrases sans que le client comprenne pourquoi.
  useEffect(() => {
    if (isCoachView || !wakeMode || !aiName?.trim()) return;
    const nameLower = aiName.trim().toLowerCase();
    let stopped = false;
    // Miroir de `awake` lisible depuis les callbacks du recognizer : cet
    // effet ne se relance pas quand `awake` change (sinon on redémarrerait
    // la reconnaissance à chaque réveil), donc `awake` resterait figé à sa
    // valeur de fermeture — ce ref, lui, reflète toujours l'état courant.
    let awakeNow = false;

    function clearAwakeTimeout() {
      if (awakeTimeoutRef.current) {
        clearTimeout(awakeTimeoutRef.current);
        awakeTimeoutRef.current = null;
      }
    }

    function goToSleep() {
      awakeNow = false;
      setAwake(false);
      clearAwakeTimeout();
    }

    function armAwakeTimeout() {
      clearAwakeTimeout();
      awakeTimeoutRef.current = setTimeout(goToSleep, 8000);
    }

    function wakeUp() {
      awakeNow = true;
      setAwake(true);
      armAwakeTimeout();
    }

    function startWakeListening() {
      if (stopped) return;
      const recognizer = createRecognizer(
        (transcript, isFinal) => {
          if (awakeNow) {
            // Déjà réveillé : TOUT ce qui suit est la commande, qu'elle
            // répète le nom ou non — sans cette branche, une commande qui
            // ne redit pas le nom serait silencieusement ignorée.
            if (!isFinal) return;
            const cleaned = transcript.trim();
            if (cleaned) {
              goToSleep();
              void send(cleaned);
            }
            return;
          }
          const idx = transcript.toLowerCase().indexOf(nameLower);
          if (idx === -1) return;
          const after = transcript.slice(idx + nameLower.length).trim();
          if (!isFinal) {
            // Entendu le nom en cours de phrase : réveille tout de suite,
            // pas besoin d'attendre la fin de la reconnaissance.
            wakeUp();
            return;
          }
          if (after) {
            goToSleep();
            void send(after);
          } else {
            wakeUp();
          }
        },
        () => {
          if (!stopped) {
            try {
              recognizer?.start();
            } catch {
              // déjà démarré
            }
          }
        },
        { continuous: true, interimResults: true }
      );
      if (!recognizer) return;
      wakeRecognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch {
        // déjà démarré
      }
    }

    startWakeListening();
    return () => {
      stopped = true;
      clearAwakeTimeout();
      setAwake(false);
      wakeRecognizerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeMode, aiName, isCoachView]);

  function toggleWakeMode() {
    const next = !wakeMode;
    setWakeMode(next);
    try {
      localStorage.setItem(`ia-coach-${clientId}-wake`, next ? "1" : "0");
    } catch {
      // ignoré
    }
  }

  // Vue coach : suit la conversation en direct sans avoir à recharger la page.
  useEffect(() => {
    if (!isCoachView) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ia-messages-${clientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ia_messages", filter: `client_id=eq.${clientId}` },
        (payload) => {
          const row = payload.new as { id: string; role: "user" | "assistant"; content: string };
          setMessages((m) => (m.some((existing) => existing.id === row.id) ? m : [...m, row]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, isCoachView]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sending) return;
    setErrorMsg(null);
    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setTextInput("");
    setSending(true);
    try {
      const res = await fetch("/api/ia-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; onboardingDone?: boolean };
      if (!res.ok || !data.reply) {
        setErrorMsg(data.error ?? "Le Coach IA n'a pas pu répondre.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
      if (data.onboardingDone && !coaching.onboarding_done) onOnboardingDone?.();
      if (!muted) speak(data.reply, voiceRef.current);
    } catch {
      setErrorMsg("Connexion impossible — réessaie.");
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    const recognizer = createRecognizer(
      (transcript, isFinal) => {
        if (isFinal) void send(transcript);
      },
      (error) => {
        setListening(false);
        const message = error ? describeMicError(error) : null;
        if (message) setErrorMsg(message);
      },
      { continuous: false, interimResults: false }
    );
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setListening(true);
    } catch {
      // déjà démarré
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {isCoachView && (
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          💳 {coaching.spend_cycle.toFixed(2)} $ ce mois-ci · {coaching.spend_total.toFixed(2)} $ au total · limite{" "}
          {coaching.spend_limit.toFixed(2)} $ — modifiable depuis la liste des clients.
        </p>
      )}

      {!isCoachView && !coaching.onboarding_done && (
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
          On construit ton programme ensemble — réponds aux questions, ça prend quelques échanges.
        </p>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isCoachView ? "Aucun échange pour le moment." : "Dis bonjour à ton Coach IA pour commencer."}
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-sm",
              m.role === "assistant" ? "bg-secondary text-secondary-foreground" : "ml-auto bg-primary text-primary-foreground"
            )}
          >
            {m.content}
          </div>
        ))}
      </div>

      {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

      {!isCoachView && wakeMode && aiName?.trim() && (
        <p className="text-center text-[11px] text-muted-foreground">
          {awake ? "Je t'écoute…" : `En écoute — dis "${aiName.trim()}" pour m'activer`}
        </p>
      )}

      {!isCoachView && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          {voiceSupported && aiName?.trim() && (
            <button
              type="button"
              onClick={toggleWakeMode}
              aria-label={wakeMode ? "Désactiver l'écoute vocale continue" : "Activer l'écoute vocale continue"}
              aria-pressed={wakeMode}
              className="relative flex size-10 shrink-0 items-center justify-center"
            >
              {wakeMode && (
                <>
                  <span
                    className={cn(
                      "absolute inset-0 rounded-full bg-primary/50",
                      awake ? "animate-ping" : "animate-pulse"
                    )}
                  />
                  {awake && (
                    <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping [animation-delay:0.3s]" />
                  )}
                </>
              )}
              <span
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-full transition-all active:scale-90",
                  wakeMode ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {wakeMode ? <Ear className="size-4" /> : <EarOff className="size-4" />}
              </span>
            </button>
          )}
          {voiceSupported && !wakeMode && (
            <button
              type="button"
              onClick={startListening}
              disabled={listening}
              aria-label="Parler au Coach IA"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-60",
                listening ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
              )}
            >
              {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
          )}
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(textInput)}
            placeholder="Écris à ton coach..."
            disabled={sending}
            className="h-10 flex-1 rounded-full border border-input bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="button" size="icon" onClick={() => send(textInput)} disabled={sending} aria-label="Envoyer">
            <Send className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
