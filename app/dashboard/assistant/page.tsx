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

  const { data: clients } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("coach_id", user.id)
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
