"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { BODY_ZONES, CM_OPTIONS, type Measurements } from "@/lib/body-zones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BilanForm({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [photosUrl, setPhotosUrl] = useState("");
  const [weightKg, setWeightKg] = useState("");

  async function submit() {
    setSaving(true);
    const { error } = await supabase.from("body_measurements").insert({
      user_id: clientId,
      measurements,
      photos_url: photosUrl || null,
      weight_kg: weightKg ? Number(weightKg) : null,
    });
    setSaving(false);
    if (!error) {
      setOpen(false);
      setMeasurements({});
      setPhotosUrl("");
      setWeightKg("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" /> Nouveau bilan
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Nouveau bilan</h2>
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
      <div className="grid grid-cols-2 gap-3">
        {BODY_ZONES.map((zone) => (
          <div key={zone.key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{zone.label}</label>
            <select
              value={measurements[zone.key] ?? ""}
              onChange={(e) =>
                setMeasurements((current) => ({
                  ...current,
                  [zone.key]: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
            >
              <option value="">—</option>
              {CM_OPTIONS.map((cm) => (
                <option key={cm} value={cm}>
                  {cm} cm
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Photos (lien Drive, album...)</label>
        <Input
          value={photosUrl}
          onChange={(e) => setPhotosUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={saving}>
          {saving ? "Enregistrement..." : "Enregistrer le bilan"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
