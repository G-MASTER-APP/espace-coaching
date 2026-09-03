"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { VideoCard } from "@/components/video-card";
import { AddButton } from "@/components/add-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VIDEO_CATEGORIES, type VideoCategory } from "@/lib/video-categories";

type VideoRow = { id: string; title: string; url: string; category: VideoCategory; position: number };

export function VideosView({
  clientId,
  isCoach,
  initialVideos,
}: {
  clientId: string;
  isCoach: boolean;
  initialVideos: VideoRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [videos, setVideos] = useState<VideoRow[]>(initialVideos);
  const [addingCategory, setAddingCategory] = useState<VideoCategory | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel(`videos-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resource_videos", filter: `user_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setVideos((current) => current.filter((v) => v.id !== old.id));
            return;
          }
          const row = payload.new as VideoRow;
          setVideos((current) => {
            const exists = current.some((v) => v.id === row.id);
            return exists ? current.map((v) => (v.id === row.id ? row : v)) : [...current, row];
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId]);

  async function addVideo(category: VideoCategory) {
    if (!newTitle.trim() || !newUrl.trim()) return;
    const inCategory = videos.filter((v) => v.category === category);
    const position = inCategory.length ? Math.max(...inCategory.map((v) => v.position)) + 1 : 0;
    const { data, error } = await supabase
      .from("resource_videos")
      .insert({ user_id: clientId, title: newTitle.trim(), url: newUrl.trim(), category, position })
      .select("id, title, url, category, position")
      .single();
    if (!error && data) {
      setVideos((current) => [...current, data]);
      setNewTitle("");
      setNewUrl("");
      setAddingCategory(null);
    }
  }

  async function deleteVideo(id: string) {
    setVideos((current) => current.filter((v) => v.id !== id));
    await supabase.from("resource_videos").delete().eq("id", id);
  }

  const hasAny = videos.length > 0;

  return (
    <div className="flex flex-col gap-8 px-4 py-6">
      <PageHeader icon="🎥" eyebrow="Ressources" title="Vidéo" />

      {!isCoach && !hasAny && (
        <p className="text-sm text-muted-foreground">Ton coach n&apos;a pas encore ajouté de vidéo.</p>
      )}

      {VIDEO_CATEGORIES.map((cat) => {
        const catVideos = videos
          .filter((v) => v.category === cat.key)
          .sort((a, b) => a.position - b.position);
        if (!isCoach && catVideos.length === 0) return null;

        return (
          <section key={cat.key} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="flex size-8 items-center justify-center rounded-full bg-secondary text-base"
              >
                {cat.icon}
              </span>
              <h2 className="text-sm font-semibold text-foreground">{cat.label}</h2>
            </div>
            <div className="flex flex-col gap-3">
              {catVideos.map((video) => (
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
              {catVideos.length === 0 && isCoach && (
                <p className="text-xs text-muted-foreground">Pas encore de vidéo dans cette catégorie.</p>
              )}
            </div>

            {isCoach &&
              (addingCategory === cat.key ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Titre (ex: Routine d'étirements)"
                    autoFocus
                  />
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="Lien YouTube, Drive..."
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => addVideo(cat.key)}>
                      Ajouter
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingCategory(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <AddButton
                  label={`Ajouter à ${cat.label.toLowerCase()}`}
                  onClick={() => setAddingCategory(cat.key)}
                />
              ))}
          </section>
        );
      })}
    </div>
  );
}
