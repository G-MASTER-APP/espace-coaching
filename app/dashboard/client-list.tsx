"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Client = { id: string; full_name: string | null; last_active_at: string | null };
type ReminderState = "idle" | "sending" | "sent" | "error";

export function ClientList({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [reminders, setReminders] = useState<Record<string, ReminderState>>({});

  async function sendReminder(clientId: string) {
    setReminders((r) => ({ ...r, [clientId]: "sending" }));
    try {
      const res = await fetch("/api/push/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      setReminders((r) => ({ ...r, [clientId]: res.ok ? "sent" : "error" }));
    } catch {
      setReminders((r) => ({ ...r, [clientId]: "error" }));
    }
    setTimeout(() => setReminders((r) => ({ ...r, [clientId]: "idle" })), 2500);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => (c.full_name ?? "").toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Rechercher un client..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun client trouvé.</p>
        )}
        {filtered.map((client) => {
          const reminderState = reminders[client.id] ?? "idle";
          return (
            <Card key={client.id} className="flex flex-row items-center justify-between px-4 py-3 transition-colors hover:bg-secondary/60">
              <Link href={`/espace/${client.id}/planning`} className="flex-1">
                <p className="font-medium text-foreground">{client.full_name || "Sans nom"}</p>
                <p className="text-xs text-muted-foreground">
                  {client.last_active_at
                    ? `Actif le ${new Date(client.last_active_at).toLocaleDateString("fr-FR")}`
                    : "Jamais connecté"}
                </p>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  void sendReminder(client.id);
                }}
                disabled={reminderState === "sending"}
                aria-label="Envoyer un rappel"
                title={
                  reminderState === "sent"
                    ? "Rappel envoyé"
                    : reminderState === "error"
                      ? "Aucun appareil abonné aux notifications"
                      : "Envoyer un rappel"
                }
                className={
                  reminderState === "sent"
                    ? "text-primary"
                    : reminderState === "error"
                      ? "text-destructive"
                      : "text-muted-foreground hover:text-foreground"
                }
              >
                {reminderState === "sent" ? <BellRing className="size-4" /> : <Bell className="size-4" />}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
