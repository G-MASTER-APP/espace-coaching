import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { IaCoachView } from "./ia-coach-view";

export default async function IaCoachPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("profiles")
    .select("coaching_mode")
    .eq("id", clientId)
    .single();

  // Le layout a déjà vérifié l'accès (propriétaire ou coach du client) ; ici
  // on vérifie juste que ce client a bien choisi le Coach IA — sinon cet
  // onglet n'a pas de sens pour lui.
  if (client?.coaching_mode !== "ia") {
    redirect(`/espace/${clientId}/planning`);
  }

  const isCoachView = user.id !== clientId;

  const [{ data: coaching }, { data: messages }, { data: analyses }] = await Promise.all([
    supabase
      .from("ia_coaching")
      .select(
        "spend_total, spend_cycle, spend_limit, onboarding_done, program, ai_name, objectif_tags, objectif_details"
      )
      .eq("client_id", clientId)
      .single(),
    supabase
      .from("ia_messages")
      .select("id, role, content, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("ia_video_analyses")
      .select("id, exercise_name, feedback, cost_usd, created_at")
      .eq("client_id", clientId)
      .eq("status", "done")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <IaCoachView
      clientId={clientId}
      isCoachView={isCoachView}
      initialMessages={messages ?? []}
      coaching={
        coaching
          ? { ...coaching, objectif_tags: coaching.objectif_tags ?? [] }
          : {
              spend_total: 0,
              spend_cycle: 0,
              spend_limit: 15,
              onboarding_done: false,
              program: {},
              ai_name: null,
              objectif_tags: [],
              objectif_details: null,
            }
      }
      analyses={analyses ?? []}
    />
  );
}
