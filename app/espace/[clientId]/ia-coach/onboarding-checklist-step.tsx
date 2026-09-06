"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Étape générique d'onboarding à cases à cocher (même principe que
// l'objectif) : utilisée pour "Sport & matériel" puis "Antécédents
// médicaux", à la suite les unes des autres jusqu'à la dernière question.
export function OnboardingChecklistStep({
  title,
  subtitle,
  options,
  freeformLabel = "Autre / précisions (optionnel)",
  freeformPlaceholder,
  freeformRequired = false,
  freeformErrorMessage,
  apiPath,
  continueLabel,
  buildSummary,
  onSubmitStart,
  onSaved,
}: {
  title: string;
  subtitle?: string;
  options: readonly string[];
  freeformLabel?: string;
  freeformPlaceholder: string;
  // Si vrai, le champ libre doit être rempli avant de continuer (ex: "quel
  // est ton objectif précis dans ce sport ?" — sans quoi l'IA ne peut pas
  // construire une séance pertinente).
  freeformRequired?: boolean;
  freeformErrorMessage?: string;
  apiPath: string;
  continueLabel: string;
  // Fourni uniquement sur la DERNIÈRE question de l'onboarding : le texte
  // renvoyé est envoyé au Coach IA (déclenche sa réponse — construction du
  // programme). Absent sur les questions intermédiaires : on enregistre et
  // on avance, sans appeler l'IA.
  buildSummary?: (tags: string[], details: string) => string;
  // Appelé juste avant l'appel réseau (validation passée) — permet au
  // parent d'afficher un écran de chargement pendant que l'IA construit le
  // programme, plutôt qu'un simple bouton désactivé.
  onSubmitStart?: () => void;
  onSaved: (tags: string[], details: string, reply: string | null) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(tag: string) {
    setSelected((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  }

  async function submit() {
    if (selected.length === 0) {
      setError("Coche au moins une case.");
      return;
    }
    if (freeformRequired && !details.trim()) {
      setError(freeformErrorMessage ?? "Ce champ est obligatoire.");
      return;
    }
    setError(null);
    setSaving(true);
    onSubmitStart?.();
    try {
      const saveRes = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: selected, details }),
      });
      if (!saveRes.ok) throw new Error();

      let reply: string | null = null;
      if (buildSummary) {
        const chatRes = await fetch("/api/ia-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: buildSummary(selected, details) }),
        });
        if (chatRes.ok) {
          const data = (await chatRes.json()) as { reply?: string };
          reply = data.reply ?? null;
        }
      }
      onSaved(selected, details, reply);
    } catch {
      setError("Impossible d'enregistrer — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt) => (
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
        {freeformLabel}
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={freeformPlaceholder}
          rows={2}
          maxLength={500}
          className="resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="button" onClick={submit} disabled={saving}>
        {saving ? "Enregistrement…" : continueLabel}
      </Button>
    </div>
  );
}
