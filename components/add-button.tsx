import { Plus } from "lucide-react";

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 self-start rounded-full border border-primary/25 bg-primary/8 px-4 py-2 text-xs font-semibold text-primary transition-all duration-150 active:scale-95 hover:bg-primary/15"
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  );
}
