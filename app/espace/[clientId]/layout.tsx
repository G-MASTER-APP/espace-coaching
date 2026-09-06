import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { EspaceHeader } from "./espace-header";
import { BottomTabBar } from "./bottom-tab-bar";
import { touchLastActive } from "./actions";
import { JarvisWidget } from "@/components/jarvis/jarvis-widget";

export default async function EspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!viewer) redirect("/login");

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, coach_id, coaching_mode")
    .eq("id", clientId)
    .maybeSingle();

  const isOwnSpace = viewer.id === clientId;
  const isCoachOfClient = viewer.role === "coach" && client?.coach_id === viewer.id;

  // Un client ne peut voir que son propre espace ; un coach uniquement
  // celui de ses clients (coach_id le pointe). Défense en profondeur : la
  // RLS bloque déjà les requêtes elles-mêmes, ceci évite juste une page
  // "vide" pour un espace auquel on n'a pas accès.
  if (!client || (!isOwnSpace && !isCoachOfClient)) {
    redirect(viewer.role === "coach" ? "/dashboard" : `/espace/${viewer.id}/planning`);
  }

  let coachClients: { id: string; full_name: string | null }[] = [];
  if (viewer.role === "coach") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("coach_id", viewer.id)
      .order("full_name");
    coachClients = data ?? [];
  } else {
    await touchLastActive(clientId);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <EspaceHeader role={viewer.role as "coach" | "client"} clients={coachClients} currentClientId={clientId} />
      <div className="flex-1 pb-20">{children}</div>
      {/* key={clientId} : remonte le widget (et son état) quand le coach
          change de client via le sélecteur, plutôt que de garder la
          conversation du client précédent affichée par erreur. */}
      <JarvisWidget
        key={clientId}
        mode={{ kind: "client", clientId, coachId: client.coach_id ?? viewer.id }}
        isCoach={viewer.role === "coach"}
      />
      <BottomTabBar clientId={clientId} showIaCoachTab={client.coaching_mode === "ia"} />
    </div>
  );
}
