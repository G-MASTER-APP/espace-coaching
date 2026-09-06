"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AiNameStep({ onSaved }: { onSaved: (name: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Donne-lui un nom pour continuer.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/ia-coach/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      onSaved(trimmed);
    } catch {
      setError("Impossible d'enregistrer — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Avant de commencer, comment veux-tu appeler ton Coach IA ?
      </p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Ex. Max, Coach Alex, Léo…"
        maxLength={30}
        autoFocus
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" onClick={submit} disabled={saving}>
        {saving ? "Enregistrement…" : "Continuer"}
      </Button>
    </div>
  );
}
