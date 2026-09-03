export function PageHeader({
  icon,
  eyebrow,
  title,
  action,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl">
          <span aria-hidden>{icon}</span>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
          <h1 className="text-xl font-bold leading-tight text-foreground">{title}</h1>
        </div>
      </div>
      {action}
    </div>
  );
}
