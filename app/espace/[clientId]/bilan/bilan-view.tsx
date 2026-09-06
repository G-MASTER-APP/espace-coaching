"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/page-header";
import { BODY_ZONES, type Measurements } from "@/lib/body-zones";
import { BilanForm } from "./bilan-form";
import { BilanPhotos } from "./bilan-photos";

type Bilan = {
  id: string;
  measured_at: string;
  measurements: Measurements;
  photos_url: string | null;
  weight_kg: number | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function BilanView({ clientId, bilans }: { clientId: string; bilans: Bilan[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel(`bilan-${clientId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "body_measurements", filter: `user_id=eq.${clientId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, clientId, router]);

  async function deleteBilan(id: string) {
    await supabase.from("body_measurements").delete().eq("id", id);
    router.refresh();
  }

  const [latest, previous] = bilans;

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <PageHeader icon="📊" eyebrow="Suivi" title="Bilan" />

      <BilanForm clientId={clientId} />

      <BilanPhotos clientId={clientId} />

      {latest && previous && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Évolution</h2>
          <p className="text-xs text-muted-foreground">
            Entre le {formatDate(previous.measured_at)} et le {formatDate(latest.measured_at)}
          </p>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-col divide-y divide-border">
              {previous.weight_kg !== null && latest.weight_kg !== null && (
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-foreground">Poids</span>
                  {(() => {
                    const delta = latest.weight_kg! - previous.weight_kg!;
                    return (
                      <span className={delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-accent" : "text-primary"}>
                        {latest.weight_kg} kg {delta !== 0 && `(${delta > 0 ? "+" : ""}${delta.toFixed(1)})`}
                      </span>
                    );
                  })()}
                </div>
              )}
              {BODY_ZONES.map((zone) => {
                const before = previous.measurements[zone.key];
                const after = latest.measurements[zone.key];
                if (before === undefined || after === undefined) return null;
                const delta = after - before;
                return (
                  <div key={zone.key} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-foreground">{zone.label}</span>
                    <span className={delta === 0 ? "text-muted-foreground" : delta > 0 ? "text-accent" : "text-primary"}>
                      {after} cm {delta !== 0 && `(${delta > 0 ? "+" : ""}${delta})`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Historique</h2>
        {bilans.length === 0 && (
          <p className="text-sm text-muted-foreground">Pas encore de bilan enregistré.</p>
        )}
        {bilans.map((bilan) => (
          <details key={bilan.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <span className="text-sm font-medium text-foreground">{formatDate(bilan.measured_at)}</span>
              <div className="flex items-center gap-3">
                {bilan.photos_url && (
                  <a
                    href={bilan.photos_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Voir les photos"
                  >
                    <ImageIcon className="size-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void deleteBilan(bilan.id);
                  }}
                  aria-label="Supprimer ce bilan"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {bilan.weight_kg !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Poids</span>
                  <span className="text-foreground">{bilan.weight_kg} kg</span>
                </div>
              )}
              {BODY_ZONES.map((zone) => {
                const value = bilan.measurements[zone.key];
                if (value === undefined) return null;
                return (
                  <div key={zone.key} className="flex justify-between">
                    <span className="text-muted-foreground">{zone.label}</span>
                    <span className="text-foreground">{value} cm</span>
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
