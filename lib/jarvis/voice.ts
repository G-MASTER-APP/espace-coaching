"use client";

/**
 * Web Speech API (reconnaissance + synthèse vocale du navigateur — gratuite,
 * pas de clé API). Non standardisée : on passe par `any` plutôt que
 * d'écrire des types ambient pour une API non supportée partout (absente
 * sur Safari/iOS notamment — voir isVoiceSupported).
 *
 * Les correctifs iOS Safari ci-dessous (unlockSpeechOnce, keepSpeechAlive,
 * resume() avant chaque speak()) viennent d'un problème confirmé en test
 * réel sur iPhone : sans ça, la voix reste muette après un moment de
 * silence ou tant qu'aucun vrai tap n'a eu lieu sur la page.
 */

type RecognitionResultHandler = (transcript: string, isFinal: boolean) => void;
// Codes natifs de SpeechRecognition (voir MDN SpeechRecognitionErrorEvent) —
// remontés tels quels pour que l'appelant puisse afficher un message précis
// plutôt que d'échouer en silence (c'était le cas avant : un refus de micro
// ne montrait jamais rien, on aurait juré que le bouton ne faisait rien).
type RecognitionEndHandler = (error?: string) => void;

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Message humain pour un code d'erreur SpeechRecognition. `null` = pas assez important pour interrompre l'utilisateur. */
export function describeMicError(error: string): string | null {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "Le micro est bloqué pour ce site. Autorise-le (icône 🔒 ou 🎤 dans la barre d'adresse), puis réessaie.";
    case "audio-capture":
      return "Aucun micro détecté sur cet appareil.";
    case "network":
      return "Problème réseau avec la reconnaissance vocale — réessaie.";
    case "no-speech":
    case "aborted":
      return null;
    default:
      return `Erreur du micro (${error}).`;
  }
}

export function createRecognizer(
  onResult: RecognitionResultHandler,
  onEnd: RecognitionEndHandler,
  options: { continuous: boolean; interimResults: boolean }
) {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const SpeechRecognitionCtor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
    | (new () => any)
    | undefined;
  if (!SpeechRecognitionCtor) return null;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = "fr-FR";
  recognition.continuous = options.continuous;
  recognition.interimResults = options.interimResults;

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      onResult(String(result[0].transcript).trim(), Boolean(result.isFinal));
    }
  };
  recognition.onerror = (event: any) => onEnd(event?.error);
  recognition.onend = () => onEnd();

  return recognition;
}

const MALE_VOICE_HINTS = /paul|henri|thomas|nicolas|guillaume|damien|male|homme/i;
const FEMALE_VOICE_HINTS = /hortense|julie|amelie|amélie|denise|audrey|celine|céline|léa|lea|female|femme/i;

export function listFrenchVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  const fr = all.filter((v) => v.lang?.toLowerCase().startsWith("fr"));
  return fr.length ? fr : all;
}

/** Préfère une voix masculine (façon Jarvis) parmi les voix françaises. */
export function pickPreferredVoice(savedName?: string | null): SpeechSynthesisVoice | null {
  const list = listFrenchVoices();
  if (!list.length) return null;
  return (
    list.find((v) => v.name === savedName) ||
    list.find((v) => MALE_VOICE_HINTS.test(v.name)) ||
    list.find((v) => !FEMALE_VOICE_HINTS.test(v.name)) ||
    list[0]
  );
}

/** À appeler une fois, tôt (ex: au premier tap sur la page). */
export function unlockSpeechOnce() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const unlock = () => {
    try {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
    } catch {
      // ignoré : simple déblocage, pas grave si ça échoue
    }
    document.removeEventListener("touchend", unlock);
    document.removeEventListener("click", unlock);
  };
  document.addEventListener("touchend", unlock, { once: true });
  document.addEventListener("click", unlock, { once: true });
}

/** Empêche le moteur vocal de "s'endormir" pendant une écoute prolongée (bug iOS). */
export function startSpeechKeepAlive(): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  const id = setInterval(() => {
    if (!window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 10000);
  return () => clearInterval(id);
}

export function speak(text: string, voice: SpeechSynthesisVoice | null, onEnd?: () => void, onStart?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  if (voice) utterance.voice = voice;
  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  return window.speechSynthesis.speaking;
}
