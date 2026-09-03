"use client";

import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { SaveIndicator } from "@/components/save-indicator";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";
import { AddButton } from "@/components/add-button";

type VideoRow = { id: string; title: string; url: string; position: number };

export function ProgrammeView({
  clientId,
  isCoach,
  programId: initialProgramId,
  programUrl: initialProgramUrl,
  initialVideos,
}: {
  clientId: string;
  isCoach: boolean;
  programId: string | null;
  programUrl: string;
  initialVideos: VideoRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [programId, setProgramId] = useState(initialProgramId);
  const [programUrl, setProgramUrl] = useState(initialProgramUrl);
  const [programSaveStatus, setProgramSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`programme-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "programs", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const row = payload.new as { id: string; program_url: string | null };
          setProgramId(row.id);
          setProgramUrl(row.program_url ?? "");
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "program_videos", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setVideos((current) => current.filter((v) => v.id !== old.id));
            return;
          }
          const row = payload.new as VideoRow;
          setVideos((current) => {
            const exists = current.some((v) => v.id === row.id);
            const next = exists ? current.map((v) => (v.id === row.id ? row : v)) : [...current, row];
            return next.sort((a, b) => a.position - b.position);
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId]);

  const debouncedSaveProgram = useDebouncedCallback(async (url: string) => {
    setProgramSaveStatus("saving");
    if (programId) {
      const { error } = await supabase.from("programs").update({ program_url: url }).eq("id", programId);
      setProgramSaveStatus(error ? "idle" : "saved");
    } else {
      const { data, error } = await supabase
        .from("programs")
        .insert({ user_id: clientId, program_url: url })
        .select("id")
        .single();
      if (!error && data) setProgramId(data.id);
      setProgramSaveStatus(error ? "idle" : "saved");
    }
  }, 700);

  function onProgramUrlChange(value: string) {
    setProgramUrl(value);
    debouncedSaveProgram(value);
  }

  async function addVideo() {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const position = videos.length ? Math.max(...videos.map((v) => v.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("program_videos")
      .insert({ user_id: clientId, title: newTitle.trim(), url: newUrl.trim(), position })
      .select("id, title, url, position")
      .single();
    if (!error && data) {
      setVideos((current) => [...current, data]);
      setNewTitle("");
      setNewUrl("");
      setAdding(false);
    }
  }

  async function deleteVideo(id: string) {
    setVideos((current) => current.filter((v) => v.id !== id));
    await supabase.from("program_videos").delete().eq("id", id);
  }

  return (
    <div className="flex flex-col gap-8 px-4 py-6">
      <PageHeader icon="💪" eyebrow="Espace" title="Programme" />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Mon programme</h2>
          {isCoach && <SaveIndicator status={programSaveStatus} />}
        </div>
        {isCoach ? (
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <Input
              value={programUrl}
              onChange={(e) => onProgramUrlChange(e.target.value)}
              placeholder="Lien Hevy, Google Sheet, Drive..."
            />
          </div>
        ) : programUrl ? (
          <a
            href={programUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-br from-primary to-primary/80 px-4 py-4 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-150 active:scale-95"
          >
            <Dumbbell className="size-5" />
            <span className="text-sm font-semibold">Ouvrir mon programme</span>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Pas encore de programme partagé.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">Vidéos du programme</h2>
        <div className="flex flex-col gap-3">
          {videos.map((video) => (
            <div key={video.id} className="relative">
              <VideoCard title={video.title} url={video.url} />
              {isCoach && (
                <button
                  type="button"
                  onClick={() => deleteVideo(video.id)}
                  aria-label="Supprimer la vidéo"
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {videos.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de vidéo.</p>}
        </div>

        {isCoach && (
          <div className="mt-1">
            {adding ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Titre (ex: Squat - technique)"
                  autoFocus
                />
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="Lien YouTube, Drive..."
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addVideo}>
                    Ajouter
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <AddButton label="Ajouter une vidéo" onClick={() => setAdding(true)} />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
