"use client";

import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { speak, stopSpeaking } from "@/lib/jarvis/voice";

const FRAME_COUNT = 6;

async function extractFrames(file: File): Promise<string[]> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Vidéo illisible."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  const frames: string[] = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = ((i + 0.5) / FRAME_COUNT) * video.duration;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = t;
    });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

async function extractImageFrame(file: File): Promise<string[]> {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image illisible."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  URL.revokeObjectURL(img.src);
  return [dataUrl.split(",")[1]];
}

export function IaVideoAnalyzer({ clientId, muted }: { clientId: string; muted: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState<"idle" | "extracting" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFeedback(null);
    setErrorMsg(null);
    stopSpeaking();
    try {
      setStep("extracting");
      const frames = file.type.startsWith("image/") ? await extractImageFrame(file) : await extractFrames(file);

      setStep("uploading");
      const supabase = createClient();
      const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : "bin";
      const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("ia-analyses").upload(path, file, {
        contentType: file.type,
      });
      if (uploadError) throw uploadError;

      setStep("analyzing");
      const res = await fetch("/api/ia-coach/analyze-video", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storagePath: path,
          frames,
          exerciseName: exerciseName.trim() || null,
          question: question.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'analyse.");

      setFeedback(data.feedback);
      setStep("done");
      if (!muted) speak(data.feedback, null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStep("error");
    }
  }

  const busy = step === "extracting" || step === "uploading" || step === "analyzing";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
        Quel exercice ?
        <input
          type="text"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          placeholder="Ex. Squat, pompes, développé couché…"
          disabled={busy}
          className="rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <label className="mt-3 flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
        Une question ? (optionnel)
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex. Est-ce normal que je sente ça dans le bas du dos ?"
          disabled={busy}
          rows={2}
          className="resize-none rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="mt-4 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {step === "idle" && "Envoyer une vidéo ou une photo"}
        {step === "extracting" && "Extraction des images…"}
        {step === "uploading" && "Envoi…"}
        {step === "analyzing" && "Analyse en cours par l'IA…"}
        {step === "done" && "Envoyer une autre vidéo ou photo"}
        {step === "error" && "Réessayer"}
      </button>

      {errorMsg && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{errorMsg}</p>}

      {feedback && (
        <div className="mt-4 rounded-xl bg-secondary/60 p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Retour du Coach IA</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{feedback}</p>
        </div>
      )}
    </div>
  );
}
