import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AssistantView } from "./assistant-view";

export default async function CoachAssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (viewer?.role !== "coach") redirect(`/espace/${user.id}/planning`);

  // Exclu les clients Coach IA : leur programme/diète/objectif vivent dans
  // ia_coaching (géré par l'IA elle-même), pas dans programs/nutrition_goals/
  // client_objectifs — un brouillon appliqué ici serait soit un no-op
  // invisible (programme, objectif), soit pire, réécrirait silencieusement
  // ce que le Coach IA gère déjà (diète).
  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("coach_id", user.id)
    // .neq() exclurait à tort les clients qui n'ont pas encore choisi de
    // mode (coaching_mode NULL) à cause du NULL SQL à 3 valeurs — un client
    // pas encore décidé doit rester géré par l'Assistant.
    .or("coaching_mode.is.null,coaching_mode.neq.ia")
    .order("full_name");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 py-6">
      <PageHeader
        icon="🗂️"
        eyebrow="Coach"
        title="Assistant"
        action={
          <Link href="/dashboard">
            <Button type="button" variant="ghost" size="sm">
              Retour
            </Button>
          </Link>
        }
      />
      <p className="text-xs text-muted-foreground">
        Pour t&apos;aider à préparer plus vite un programme, une diète ou un objectif pour un client suivi en
        direct. Il propose, tu valides avant que ça parte au client — rien n&apos;est jamais appliqué tout seul.
      </p>
      <AssistantView clients={clients ?? []} />
    </main>
  );
}
