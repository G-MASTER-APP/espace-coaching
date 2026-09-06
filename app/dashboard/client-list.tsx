"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellRing, ArrowLeftRight } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { IaLimitEditor } from "./ia-limit-editor";
import { dismissIaAlert, toggleCoachingMode } from "./actions";

type Client = {
  id: string;
  full_name: string | null;
  last_active_at: string | null;
  coaching_mode: string | null;
  ia: {
    client_id: string;
    spend_total: number;
    spend_cycle: number;
    spend_limit: number;
    ai_name: string | null;
    alert_message: string | null;
    alert_created_at: string | null;
  } | null;
};
type ReminderState = "idle" | "sending" | "sent" | "error";

export function ClientList({ clients: initialClients }: { clients: Client[] }) {
  const [clients, setClients] = useState(initialClients);
  const [query, setQuery] = useState("");
  const [reminders, setReminders] = useState<Record<string, ReminderState>>({});
  const [pending, startTransition] = useTransition();

  // Le compteur $ (spend_total/spend_cycle) vient des props chargées à
  // l'ouverture de la page — sans ça, il resterait figé pendant que le
  // coach discute avec un client Coach IA sur un autre onglet, donnant
  // l'impression trompeuse que "ça n'augmente pas" alors que ça augmente
  // bien côté base de données.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-ia-spend")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ia_coaching" },
        (payload) => {
          const row = payload.new as {
            client_id: string;
            spend_total: number;
            spend_cycle: number;
            spend_limit: number;
            ai_name: string | null;
            alert_message: string | null;
            alert_created_at: string | null;
          };
          setClients((current) =>
            current.map((c) => (c.id === row.client_id ? { ...c, ia: { ...c.ia, ...row } } : c))
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

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

  function switchMode(client: Client) {
    const next = client.coaching_mode === "ia" ? "joris" : "ia";
    const label = next === "ia" ? "Coach IA" : "Coach Joris";
    if (!window.confirm(`Basculer ${client.full_name || "ce client"} vers ${label} ?`)) return;
    startTransition(() => {
      void toggleCoachingMode(client.id, next);
    });
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
            <Card key={client.id} className="flex flex-col gap-2 px-4 py-3">
              {client.ia?.alert_message && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5">
                  <p className="text-xs font-semibold text-destructive">⚠️ Alerte Coach IA</p>
                  <p className="text-xs text-foreground">{client.ia.alert_message}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={pending}
                    onClick={() => startTransition(() => void dismissIaAlert(client.id))}
                  >
                    Marquer comme vu
                  </Button>
                </div>
              )}
              <div className="flex flex-row items-center justify-between">
                <Link
                  href={`/espace/${client.id}/${client.coaching_mode === "ia" ? "ia-coach" : "planning"}`}
                  className="flex-1"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{client.full_name || "Sans nom"}</p>
                    {client.coaching_mode === "ia" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        🤖 {client.ia?.ai_name || "IA"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {client.last_active_at
                      ? `Actif le ${new Date(client.last_active_at).toLocaleDateString("fr-FR")}`
                      : "Jamais connecté"}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => switchMode(client)}
                  disabled={pending}
                  aria-label="Changer de mode de coaching"
                  title={client.coaching_mode === "ia" ? "Repasser en Coach Joris" : "Passer en Coach IA"}
                  className="mr-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <ArrowLeftRight className="size-4" />
                </button>
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
              </div>
              {client.coaching_mode === "ia" && client.ia && (
                <IaLimitEditor
                  clientId={client.id}
                  spendTotal={client.ia.spend_total}
                  spendCycle={client.ia.spend_cycle}
                  spendLimit={client.ia.spend_limit}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
