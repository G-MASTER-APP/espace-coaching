"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

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
}: {
  clientId: string;
  isCoachView: boolean;
  initialMessages: Message[];
  coaching: Coaching;
  muted: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const recognizerRef = useRef<ReturnType<typeof createRecognizer>>(null);
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
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        setErrorMsg(data.error ?? "Le Coach IA n'a pas pu répondre.");
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: data.reply! }]);
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

      {!isCoachView && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          {voiceSupported && (
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
