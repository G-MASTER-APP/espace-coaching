// Petits aperçus visuels (pas de vraies captures d'écran — elles se
// périmeraient dès que l'UI évolue) pour les écrans d'intro obligatoires,
// façon mockup léger plutôt qu'icône seule.

function FrameChrome() {
  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3 py-2">
      <span className="h-2 w-2 rounded-full bg-destructive/60" />
      <span className="h-2 w-2 rounded-full bg-primary/60" />
      <span className="h-2 w-2 rounded-full bg-primary/30" />
    </div>
  );
}

export function CoachJorisVisual() {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <FrameChrome />
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {["📅 Planning", "🥗 Diète", "📏 Bilan"].map((s) => (
          <div key={s} className="rounded-lg bg-secondary/60 px-1.5 py-2 text-center">
            <p className="text-[9px] font-semibold text-foreground">{s}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          J
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-secondary/60" />
      </div>
    </div>
  );
}

export function CoachIaVisual() {
  return (
    <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <FrameChrome />
      <div className="flex flex-col gap-1.5 p-3">
        <div className="max-w-[75%] rounded-xl bg-secondary px-2.5 py-1.5 text-left text-[9px] text-secondary-foreground">
          Comment s&apos;est passée ta séance ?
        </div>
        <div className="ml-auto max-w-[75%] rounded-xl bg-primary px-2.5 py-1.5 text-left text-[9px] text-primary-foreground">
          J&apos;ai mangé du poulet-riz 🍗
        </div>
        <div className="max-w-[75%] rounded-xl bg-secondary px-2.5 py-1.5 text-left text-[9px] text-secondary-foreground">
          Noté ✅ On ajuste ta diète demain.
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          🎤
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-secondary/60" />
      </div>
    </div>
  );
}
