"use client";

import { useState } from "react";
import { Camera } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PremierBilanPrompt({
  clientId,
  onDone,
}: {
  clientId: string;
  onDone: (saved: boolean) => void;
}) {
  const [weightKg, setWeightKg] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    setPhotos((current) => [...current, ...Array.from(files)]);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: bilanError } = await supabase.from("body_measurements").insert({
        user_id: clientId,
        weight_kg: weightKg ? Number(weightKg) : null,
        measurements: {},
      });
      if (bilanError) throw bilanError;

      for (const file of photos) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${clientId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("bilan-photos")
          .upload(path, file, { contentType: file.type || undefined });
        if (uploadError) throw uploadError;
        await supabase
          .from("bilan_photos")
          .insert({ user_id: clientId, storage_path: path, taken_at: new Date().toISOString().slice(0, 10) });
      }

      onDone(true);
    } catch {
      setError("Impossible d'enregistrer — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-foreground">Ton bilan de départ</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Ton poids et une photo suffisent pour que ton coach ait un point de départ à comparer plus tard.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Poids (kg)</label>
        <Input
          type="number"
          step="0.1"
          min="0"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          placeholder="Ex. 72.5"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <Camera className="size-3.5" />
        {photos.length > 0 ? `${photos.length} photo(s) sélectionnée(s)` : "Ajouter une ou plusieurs photos"}
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={saving} className="flex-1">
          {saving ? "Enregistrement…" : "Enregistrer mon bilan de départ"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)} disabled={saving}>
          Voir ça plus tard
        </Button>
      </div>
    </div>
  );
}
