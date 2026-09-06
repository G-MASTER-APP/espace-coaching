import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JarvisWidget } from "@/components/jarvis/jarvis-widget";
import { ClientList } from "./client-list";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (viewer?.role !== "coach") {
    redirect(`/espace/${user.id}/planning`);
  }

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name, last_active_at, coaching_mode")
    .eq("coach_id", user.id)
    .order("full_name");

  const iaClientIds = (clients ?? []).filter((c) => c.coaching_mode === "ia").map((c) => c.id);
  const { data: iaCoaching } =
    iaClientIds.length > 0
      ? await supabase
          .from("ia_coaching")
          .select("client_id, spend_total, spend_cycle, spend_limit, ai_name, alert_message, alert_created_at")
          .in("client_id", iaClientIds)
      : { data: [] };

  const clientsWithIa = (clients ?? []).map((client) => ({
    ...client,
    ia: iaCoaching?.find((row) => row.client_id === client.id) ?? null,
  }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 py-8">
      <PageHeader
        icon="👥"
        eyebrow="Espace Coaching"
        title="Mes clients"
        action={
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Déconnexion
            </Button>
          </form>
        }
      />
      <ClientList clients={clientsWithIa} />
      <JarvisWidget mode={{ kind: "coach-dashboard", coachId: user.id }} isCoach />
    </main>
  );
}
