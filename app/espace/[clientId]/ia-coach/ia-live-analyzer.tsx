"use client";

import { useEffect, useRef, useState } from "react";

import { speak } from "@/lib/jarvis/voice";

const CHECK_INTERVAL_MS = 5000;

export function IaLiveAnalyzer({ muted }: { muted: boolean }) {
  const [exerciseName, setExerciseName] = useState("");
  const [active, setActive] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      intervalRef.current = setInterval(checkFrame, CHECK_INTERVAL_MS);
    } catch {
      setError("Impossible d'accéder à la caméra.");
    }
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function checkFrame() {
    if (busyRef.current || !videoRef.current) return;
    busyRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];

      const res = await fetch("/api/ia-coach/analyze-live-frame", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ frame, exerciseName: exerciseName.trim() || null }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur.");
        stop();
        return;
      }

      setFeedback(data.feedback);
      if (!muted && data.feedback) speak(data.feedback, null);
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
        Quel exercice ?
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          placeholder="Ex. Squat, pompes, développé couché…"
          disabled={active}
          className="rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
        ⚠️ Ce mode consomme ton quota IA bien plus vite qu&apos;une analyse classique (une vérification toutes les 5
        secondes). Utilise-le avec modération.
      </p>

      <div className="mt-3 overflow-hidden rounded-xl bg-secondary/60">
        <video ref={videoRef} muted playsInline className={`w-full ${active ? "block" : "hidden"}`} />
        {!active && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            La caméra s&apos;affichera ici une fois la session démarrée.
          </p>
        )}
      </div>

      <button
        onClick={active ? stop : start}
        className="mt-3 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
      >
        {active ? "Arrêter la session" : "Démarrer la session live"}
      </button>

      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        L&apos;IA vérifie ta posture toutes les {CHECK_INTERVAL_MS / 1000} secondes pendant la session.
      </p>

      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {feedback && (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3.5">
          <p className="text-sm font-bold text-foreground">{feedback}</p>
        </div>
      )}
    </div>
  );
}
