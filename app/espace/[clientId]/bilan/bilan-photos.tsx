"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Trash2, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type PhotoRow = { id: string; storage_path: string; taken_at: string };
type Photo = PhotoRow & { url: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function BilanPhotos({ clientId }: { clientId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const signUrls = useCallback(
    async (rows: PhotoRow[]): Promise<Photo[]> => {
      if (rows.length === 0) return [];
      const { data } = await supabase.storage
        .from("bilan-photos")
        .createSignedUrls(rows.map((r) => r.storage_path), 3600);
      return rows.map((row, i) => ({ ...row, url: data?.[i]?.signedUrl ?? "" }));
    },
    [supabase]
  );

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from("bilan_photos")
      .select("id, storage_path, taken_at")
      .eq("user_id", clientId)
      .order("taken_at", { ascending: false });
    setPhotos(await signUrls(data ?? []));
  }, [supabase, clientId, signUrls]);

  useEffect(() => {
    void loadPhotos();
    const channel = supabase
      .channel(`bilan-photos-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bilan_photos", filter: `user_id=eq.${clientId}` },
        () => void loadPhotos()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId, loadPhotos]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${clientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("bilan-photos")
        .upload(path, file, { contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      await supabase
        .from("bilan_photos")
        .insert({ user_id: clientId, storage_path: path, taken_at: new Date().toISOString().slice(0, 10) });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: Photo) {
    setSelected((s) => s.filter((id) => id !== photo.id));
    await supabase.storage.from("bilan-photos").remove([photo.storage_path]);
    await supabase.from("bilan_photos").delete().eq("id", photo.id);
  }

  function toggleSelect(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 2) return [current[1], id];
      return [...current, id];
    });
  }

  const comparePair = useMemo(() => {
    if (selected.length !== 2) return null;
    const a = photos.find((p) => p.id === selected[0]);
    const b = photos.find((p) => p.id === selected[1]);
    if (!a || !b) return null;
    return new Date(a.taken_at) <= new Date(b.taken_at) ? ([a, b] as const) : ([b, a] as const);
  }, [selected, photos]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Photos</h2>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary transition-transform active:scale-95">
          <Camera className="size-3.5" />
          {uploading ? "Envoi…" : "Ajouter"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleUpload(file);
            }}
          />
        </label>
      </div>

      {photos.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de photo.</p>}

      {photos.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {selected.length < 2 ? "Touche 2 photos pour les comparer." : "Comparaison ci-dessous."}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <button
                  type="button"
                  onClick={() => toggleSelect(photo.id)}
                  className={cn(
                    "relative aspect-square w-full overflow-hidden rounded-lg border transition-all active:scale-95",
                    selected.includes(photo.id) ? "border-primary ring-2 ring-primary/40" : "border-border"
                  )}
                >
                  {photo.url && <img src={photo.url} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                    {formatDate(photo.taken_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(photo)}
                  aria-label="Supprimer cette photo"
                  className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {comparePair && (
        <PhotoCompareSlider before={comparePair[0]} after={comparePair[1]} onClose={() => setSelected([])} />
      )}
    </section>
  );
}

function PhotoCompareSlider({ before, after, onClose }: { before: Photo; after: Photo; onClose: () => void }) {
  const [position, setPosition] = useState(50);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(before.taken_at)}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la comparaison"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <span>{formatDate(after.taken_at)}</span>
      </div>
      <div className="relative aspect-[3/4] w-full select-none overflow-hidden rounded-lg bg-secondary">
        <img src={after.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <img src={before.url} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${position}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
