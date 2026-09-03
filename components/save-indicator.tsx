export function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  if (status === "idle") return null;
  return (
    <span className="text-xs text-muted-foreground">
      {status === "saving" ? "Enregistrement..." : "Enregistré"}
    </span>
  );
}
