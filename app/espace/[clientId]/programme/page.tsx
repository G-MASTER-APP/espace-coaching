import { createClient } from "@/lib/supabase/server";
import { ProgrammeView } from "./programme-view";

export default async function ProgrammePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  const isCoach = viewer?.role === "coach";

  const { data: target } = await supabase
    .from("profiles")
    .select("coaching_mode")
    .eq("id", clientId)
    .maybeSingle();

  const [{ data: program }, { data: videos }] = await Promise.all([
    supabase.from("programs").select("id, program_url").eq("user_id", clientId).maybeSingle(),
    supabase
      .from("program_videos")
      .select("id, title, url, position")
      .eq("user_id", clientId)
      .order("position"),
  ]);

  return (
    <ProgrammeView
      clientId={clientId}
      isCoach={isCoach}
      programId={program?.id ?? null}
      programUrl={program?.program_url ?? ""}
      initialVideos={videos ?? []}
      isIaClient={target?.coaching_mode === "ia"}
    />
  );
}
