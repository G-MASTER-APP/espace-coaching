"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { OBJECTIF_OPTIONS } from "@/lib/ia-coach/objectif-options";

export function ObjectifSelector({
  initialTags,
  initialDetails = "",
  onSaved,
  isOnboarding = false,
}: {
  initialTags: string[];
  initialDetails?: string;
  onSaved: (tags: string[], details: string, reply: string | null) => void;
  isOnboarding?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(initialTags);
  const [details, setDetails] = useState(initialDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  function toggle(tag: string) {
    setSelected((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    );
  }

  async function submit() {
    if (selected.length === 0) {
      setError("Choisis au moins un objectif.");
      return;
    }
    setError(null);
    setJustSaved(false);
    setSaving(true);
    try {
      const saveRes = await fetch("/api/ia-coach/objectif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: selected, details }),
      });
      if (!saveRes.ok) {
        const body = (await saveRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "save_failed");
      }

      const changed =
        JSON.stringify([...selected].sort()) !== JSON.stringify([...initialTags].sort()) ||
        details.trim() !== initialDetails.trim();
      let reply: string | null = null;
      // Pendant l'onboarding, d'autres questions suivent encore (sport,
      // antécédents) avant que l'IA ait tout ce qu'il faut pour construire
      // le programme — on enregistre et on avance, sans la faire parler
      // maintenant. Hors onboarding (onglet Objectif édité plus tard), le
      // programme existe déjà : on la prévient tout de suite du changement.
      if (changed && !isOnboarding) {
        const parts = [`${isOnboarding ? "Mon objectif" : "J'ai mis à jour mon objectif"} : ${selected.join(", ")}.`];
        if (details.trim()) parts.push(`Précisément : ${details.trim()}`);
        const chatRes = await fetch("/api/ia-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: parts.join(" ") }),
        });
        if (chatRes.ok) {
          const data = (await chatRes.json()) as { reply?: string };
          reply = data.reply ?? null;
        }
      }
      onSaved(selected, details, reply);
      if (!isOnboarding) {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2500);
      }
    } catch {
      setError("Impossible d'enregistrer — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isOnboarding && (
        <p className="text-sm text-muted-foreground">
          Avant de commencer, dis-nous ton objectif principal — tu pourras le changer à tout moment.
        </p>
      )}
      <div className="flex flex-col gap-2">
        {OBJECTIF_OPTIONS.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="size-4"
            />
            {opt}
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground">
        Un but précis ? (optionnel)
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Ex. Je veux perdre 5 kg en 3 mois"
          rows={2}
          maxLength={500}
          className="resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="font-normal normal-case text-muted-foreground">
          L&apos;IA en tient compte pour tes directives quotidiennes.
        </span>
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {justSaved && <p className="text-xs font-semibold text-primary">✓ Objectif enregistré.</p>}
      <Button type="button" onClick={submit} disabled={saving}>
        {saving ? "Enregistrement…" : isOnboarding ? "Question suivante" : "Enregistrer"}
      </Button>
    </div>
  );
}
