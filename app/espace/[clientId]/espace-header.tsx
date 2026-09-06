"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { logout } from "@/app/(auth)/actions";
import { PushBell } from "@/components/push-bell";

type Client = { id: string; full_name: string | null };

export function EspaceHeader({
  role,
  clients,
  currentClientId,
}: {
  role: "coach" | "client";
  clients: Client[];
  currentClientId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
      {role === "coach" ? (
        <>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Clients
          </Link>
          <select
            value={currentClientId}
            onChange={(e) => {
              const tab = pathname?.split("/").pop() ?? "planning";
              router.push(`/espace/${e.target.value}/${tab}`);
            }}
            className="ml-auto rounded-md border border-input bg-transparent px-2 py-1 text-sm text-foreground"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name || "Sans nom"}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <span className="text-sm font-bold tracking-tight text-foreground">G-MASTER</span>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/choix-coach"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Changer de coach
            </Link>
            <PushBell />
          </div>
        </>
      )}
      <form action={logout}>
        <button
          type="submit"
          aria-label="Se déconnecter"
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </header>
  );
}
