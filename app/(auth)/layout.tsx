export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-1 text-center">
        <span className="text-lg font-bold tracking-tight text-foreground">G-MASTER</span>
        <span className="text-xs font-medium uppercase tracking-widest text-accent">
          Espace Coaching
        </span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
