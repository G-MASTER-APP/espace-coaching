"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Mic, MicOff, Send, Settings, Sparkles, Volume2, VolumeX, X, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { containsWakeWord, matchIntent, normalizeText, LEARNABLE_INTENTS, type JarvisIntent } from "@/lib/jarvis/intents";
import { buildClientResponse, buildDailySummary } from "@/lib/jarvis/client-responses";
import { buildCoachDigest } from "@/lib/jarvis/coach-responses";
import { callJarvisAI } from "@/lib/jarvis/ai-boost";
import {
  addLearnedPhrase,
  deleteLearnedPhrase,
  fetchLearnedPhrases,
  type LearnedPhraseRow,
} from "@/lib/jarvis/learned-phrases";
import {
  createRecognizer,
  describeMicError,
  isVoiceSupported,
  listFrenchVoices,
  pickPreferredVoice,
  speak,
  startSpeechKeepAlive,
  stopSpeaking,
  unlockSpeechOnce,
} from "@/lib/jarvis/voice";

type Message = { role: "user" | "jarvis"; text: string };

type Mode =
  | { kind: "client"; clientId: string; coachId: string }
  | { kind: "coach-dashboard"; coachId: string };

export function JarvisWidget({ mode, isCoach }: { mode: Mode; isCoach: boolean }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [learned, setLearned] = useState<LearnedPhraseRow[]>([]);
  const [learnAction, setLearnAction] = useState<JarvisIntent>(LEARNABLE_INTENTS[0].intent);
  const [learnPhrase, setLearnPhrase] = useState("");
  const [aiBoostEnabled, setAiBoostEnabled] = useState(false);
  const [aiSpendCycle, setAiSpendCycle] = useState(0);
  const [aiSpendTotal, setAiSpendTotal] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognizerRef = useRef<any>(null);
  const speakingRef = useRef(false);
  const handsFreeRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const awaitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageNs = mode.kind === "client" ? `jarvis-${mode.clientId}` : `jarvis-coach-${mode.coachId}`;

  // --- Init : voix, préférences locales, phrases apprises, réglage IA du coach ---
  useEffect(() => {
    setVoiceSupported(isVoiceSupported());
    unlockSpeechOnce();
    const stopKeepAlive = startSpeechKeepAlive();

    try {
      setMuted(localStorage.getItem(`${storageNs}-muted`) === "1");
      setHandsFree(localStorage.getItem(`${storageNs}-handsfree`) === "1");
    } catch {
      // localStorage indisponible (navigation privée stricte) : on garde les valeurs par défaut.
    }

    const loadVoices = () => {
      const list = listFrenchVoices();
      setVoices(list);
      let savedName: string | null = null;
      try {
        savedName = localStorage.getItem(`${storageNs}-voice`);
      } catch {
        // ignoré
      }
      const preferred = pickPreferredVoice(savedName);
      voiceRef.current = preferred;
      if (preferred) setSelectedVoiceName(preferred.name);
    };
    if ("speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
      loadVoices();
    }

    void fetchLearnedPhrases().then(setLearned);

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("ai_boost_enabled, ai_spend_cycle, ai_spend_total")
        .eq("id", mode.coachId)
        .maybeSingle();
      if (data) {
        setAiBoostEnabled(Boolean(data.ai_boost_enabled));
        setAiSpendCycle(data.ai_spend_cycle ?? 0);
        setAiSpendTotal(data.ai_spend_total ?? 0);
      }
    })();

    return () => {
      stopKeepAlive();
      if ("speechSynthesis" in window) window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync temps réel du réglage IA choisi par le coach (les clients héritent
  // du bouton, ils n'ont pas de bouton à eux).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`jarvis-coach-settings-${mode.coachId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${mode.coachId}` },
        (payload) => {
          const row = payload.new as {
            ai_boost_enabled: boolean;
            ai_spend_cycle: number;
            ai_spend_total: number;
          };
          setAiBoostEnabled(Boolean(row.ai_boost_enabled));
          setAiSpendCycle(row.ai_spend_cycle ?? 0);
          setAiSpendTotal(row.ai_spend_total ?? 0);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mode.coachId]);

  // Salutation automatique, une fois par jour, à la première visite.
  useEffect(() => {
    let alreadyGreetedToday = true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      alreadyGreetedToday = localStorage.getItem(`${storageNs}-greeted`) === today;
      if (!alreadyGreetedToday) localStorage.setItem(`${storageNs}-greeted`, today);
    } catch {
      return;
    }
    if (alreadyGreetedToday) return;

    void (async () => {
      const text = mode.kind === "client" ? await buildDailySummary(mode.clientId) : await buildCoachDigest(mode.coachId);
      setMessages([{ role: "jarvis", text }]);
      setOpen(true);
      speakJarvis(text);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function speakJarvis(text: string) {
    if (muted) return;
    speakingRef.current = true;
    setSpeaking(true);
    speak(
      text,
      voiceRef.current,
      () => {
        speakingRef.current = false;
        setSpeaking(false);
      },
      () => {
        speakingRef.current = true;
        setSpeaking(true);
      }
    );
  }

  async function handleCommand(rawText: string) {
    setMessages((m) => [...m, { role: "user", text: rawText }]);
    let response: string;
    if (mode.kind === "coach-dashboard") {
      response = await buildCoachDigest(mode.coachId);
    } else {
      const intent = matchIntent(rawText, learned);
      if (intent === "unknown" && aiBoostEnabled) {
        setMessages((m) => [...m, { role: "jarvis", text: "Je réfléchis…" }]);
        response = await callJarvisAI(rawText);
        setMessages((m) => m.slice(0, -1));
      } else if (intent === "unknown") {
        response =
          "Je n'ai pas bien saisi. Vous pouvez me demander où vous en êtes avec l'eau, le sommeil, les pas, votre forfait, votre diète ou le planning du jour.";
      } else {
        response = await buildClientResponse(intent, mode.clientId);
      }
    }
    setMessages((m) => [...m, { role: "jarvis", text: response }]);
    speakJarvis(response);
  }

  function reportMicError(error?: string) {
    if (!error) return;
    const message = describeMicError(error);
    if (!message) return;
    setMessages((m) => [...m, { role: "jarvis", text: message }]);
    speakJarvis(message);
  }

  function stopHandsFree() {
    if (recognizerRef.current) {
      recognizerRef.current.onend = null;
      try {
        recognizerRef.current.stop();
      } catch {
        // déjà arrêté
      }
      recognizerRef.current = null;
    }
    clearTimeout(awaitTimerRef.current);
    awaitingCommandRef.current = false;
    setListening(false);
  }

  function startHandsFreeRecognition() {
    stopHandsFree();
    const recognizer = createRecognizer(
      (transcript, isFinal) => {
        // Dire "Jarvis" pendant qu'il parle l'interrompt et lui rend
        // l'écoute, plutôt que d'attendre la fin de sa phrase.
        if (speakingRef.current && containsWakeWord(transcript)) {
          stopSpeaking();
          speakingRef.current = false;
          setSpeaking(false);
          return;
        }
        if (!isFinal) return;
        const norm = normalizeText(transcript);
        const idx = norm.indexOf("jarvis");
        if (idx === -1) {
          if (awaitingCommandRef.current) {
            awaitingCommandRef.current = false;
            clearTimeout(awaitTimerRef.current);
            void handleCommand(transcript);
          }
          return;
        }
        const after = transcript.slice(idx + "jarvis".length).trim();
        if (after) {
          awaitingCommandRef.current = false;
          clearTimeout(awaitTimerRef.current);
          void handleCommand(after);
        } else {
          awaitingCommandRef.current = true;
          speakJarvis("Oui ? Je vous écoute.");
          clearTimeout(awaitTimerRef.current);
          awaitTimerRef.current = setTimeout(() => {
            awaitingCommandRef.current = false;
          }, 6000);
        }
      },
      (error) => {
        // Erreur bloquante (micro refusé/absent) : inutile de reboucler à
        // l'infini sur le même échec, on coupe et on explique pourquoi.
        const blocking = error === "not-allowed" || error === "service-not-allowed" || error === "audio-capture";
        if (blocking) {
          handsFreeRef.current = false;
          setHandsFree(false);
          setListening(false);
          reportMicError(error);
          return;
        }
        reportMicError(error);
        // Redémarre automatiquement tant que le mode mains libres reste actif.
        if (handsFreeRef.current) {
          try {
            recognizerRef.current?.start();
          } catch {
            // ignoré, un prochain onend retentera
          }
        } else {
          setListening(false);
        }
      },
      { continuous: true, interimResults: true }
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

  function toggleHandsFree() {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    try {
      localStorage.setItem(`${storageNs}-handsfree`, next ? "1" : "0");
    } catch {
      // ignoré
    }
    if (next) startHandsFreeRecognition();
    else stopHandsFree();
  }

  function startPushToTalk() {
    if (handsFree) return;
    stopHandsFree();
    const recognizer = createRecognizer(
      (transcript, isFinal) => {
        if (isFinal) void handleCommand(transcript);
      },
      (error) => {
        setListening(false);
        reportMicError(error);
      },
      { continuous: false, interimResults: false }
    );
    if (!recognizer) return;
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setListening(true);
    } catch {
      // ignoré
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(`${storageNs}-muted`, next ? "1" : "0");
    } catch {
      // ignoré
    }
    if (next) stopSpeaking();
  }

  function onVoiceChange(name: string) {
    setSelectedVoiceName(name);
    const voice = voices.find((v) => v.name === name) ?? null;
    voiceRef.current = voice;
    try {
      localStorage.setItem(`${storageNs}-voice`, name);
    } catch {
      // ignoré
    }
  }

  async function toggleAiBoost() {
    if (!isCoach) return;
    const next = !aiBoostEnabled;
    setAiBoostEnabled(next);
    const supabase = createClient();
    await supabase.from("profiles").update({ ai_boost_enabled: next }).eq("id", mode.coachId);
    setMessages((m) => [
      ...m,
      {
        role: "jarvis",
        text: next
          ? "Mode IA activé. J'utiliserai l'IA quand je ne comprendrai pas votre demande."
          : "Mode IA désactivé. Je reste sur mes réponses habituelles.",
      },
    ]);
  }

  async function submitLearn() {
    if (mode.kind !== "coach-dashboard" && !isCoach) return;
    const phrase = learnPhrase.trim();
    if (!phrase) return;
    const row = await addLearnedPhrase(mode.coachId, learnAction, phrase);
    if (row) {
      setLearned((current) => [...current, row]);
      setLearnPhrase("");
    }
  }

  async function removeLearn(id: string) {
    setLearned((current) => current.filter((lp) => lp.id !== id));
    await deleteLearnedPhrase(id);
  }

  function submitText() {
    const value = textInput.trim();
    if (!value) return;
    setTextInput("");
    void handleCommand(value);
  }

  function close() {
    setOpen(false);
    stopSpeaking();
  }

  const showAiControls = mode.kind === "client";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir Jarvis"
        className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-primary py-3 pl-4 pr-5 text-primary-foreground shadow-lg transition-transform active:scale-90"
      >
        <Sparkles className="size-5" />
        <span className="text-sm font-semibold">Jarvis</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl sm:h-[75vh] sm:rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-accent" />
                <h2 className="text-sm font-semibold text-foreground">Jarvis</h2>
                {speaking && <span className="shrink-0 text-xs text-muted-foreground">parle…</span>}
                {listening && !speaking && (
                  <span className="shrink-0 text-xs text-primary">
                    {awaitingCommandRef.current ? "vous écoute…" : handsFree ? 'en écoute (dites "Jarvis")' : "écoute…"}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {isCoach && showAiControls && (
                  <button
                    type="button"
                    onClick={toggleAiBoost}
                    aria-label={aiBoostEnabled ? "Désactiver le mode IA" : "Activer le mode IA"}
                    title="Jarvis boosté à l'IA (payant, pour toi et tes clients)"
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      aiBoostEnabled ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}
                  >
                    <Zap className="size-4" />
                  </button>
                )}
                {!isCoach && showAiControls && aiBoostEnabled && (
                  <span title="Mode IA activé par ton coach" className="flex size-8 items-center justify-center text-primary">
                    <Zap className="size-4" />
                  </span>
                )}
                {isCoach && (
                  <button
                    type="button"
                    onClick={() => setLearnOpen((o) => !o)}
                    aria-label="Apprendre une phrase à Jarvis"
                    title="Apprendre une phrase à Jarvis"
                    className={cn("flex size-8 items-center justify-center rounded-full", learnOpen ? "bg-secondary" : "text-muted-foreground")}
                  >
                    <GraduationCap className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Réactiver la voix" : "Couper la voix"}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground"
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  aria-label="Réglages de la voix"
                  className={cn("flex size-8 items-center justify-center rounded-full", settingsOpen ? "bg-secondary" : "text-muted-foreground")}
                >
                  <Settings className="size-4" />
                </button>
                <button type="button" onClick={close} aria-label="Fermer" className="flex size-8 items-center justify-center text-muted-foreground">
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {isCoach && aiBoostEnabled && aiSpendTotal > 0 && (
              <p className="border-b border-border px-4 py-1.5 text-xs text-muted-foreground">
                💳 {aiSpendCycle.toFixed(2)} $ ce mois-ci · {aiSpendTotal.toFixed(2)} $ au total
              </p>
            )}

            {settingsOpen && voices.length > 0 && (
              <div className="flex items-center gap-2 border-b border-border p-3">
                <select
                  value={selectedVoiceName}
                  onChange={(e) => onVoiceChange(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="secondary" onClick={() => speakJarvis("Bonjour. Jarvis à votre service.")}>
                  Tester
                </Button>
              </div>
            )}

            {learnOpen && isCoach && (
              <div className="flex flex-col gap-2 border-b border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Apprends une nouvelle formulation pour une demande que Jarvis sait déjà traiter.
                </p>
                <div className="flex gap-2">
                  <select
                    value={learnAction}
                    onChange={(e) => setLearnAction(e.target.value as JarvisIntent)}
                    className="h-9 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
                  >
                    {LEARNABLE_INTENTS.map((i) => (
                      <option key={i.intent} value={i.intent}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={learnPhrase}
                    onChange={(e) => setLearnPhrase(e.target.value)}
                    placeholder="Ex: fais le point"
                    className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <Button type="button" size="sm" onClick={submitLearn}>
                    Apprendre
                  </Button>
                </div>
                {learned.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {learned.map((lp) => (
                      <div key={lp.id} className="flex items-center justify-between rounded-md bg-secondary px-2 py-1 text-xs">
                        <span>
                          « {lp.phrase} » → {LEARNABLE_INTENTS.find((i) => i.intent === lp.action_id)?.label ?? lp.action_id}
                        </span>
                        <button type="button" onClick={() => removeLearn(lp.id)} className="text-muted-foreground hover:text-destructive">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Demandez-moi où vous en êtes aujourd&apos;hui, ou dites simplement bonjour.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    m.role === "jarvis" ? "bg-secondary text-secondary-foreground" : "ml-auto bg-primary text-primary-foreground"
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-border p-3">
              {voiceSupported && (
                <>
                  <button
                    type="button"
                    onClick={toggleHandsFree}
                    aria-label={handsFree ? "Désactiver le mode mains libres" : 'Activer le mode mains libres (dire "Jarvis")'}
                    title={handsFree ? "Mode mains libres activé" : 'Dire "Jarvis" pour parler'}
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90",
                      handsFree ? "bg-primary text-primary-foreground" : "border border-input text-muted-foreground"
                    )}
                  >
                    👂
                  </button>
                  <button
                    type="button"
                    onClick={startPushToTalk}
                    disabled={handsFree}
                    aria-label="Parler à Jarvis"
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40",
                      listening && !handsFree ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                    )}
                  >
                    {listening && !handsFree ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </button>
                </>
              )}
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitText()}
                placeholder="Écrivez à Jarvis..."
                className="h-10 flex-1 rounded-full border border-input bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={submitText}
                aria-label="Envoyer"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
