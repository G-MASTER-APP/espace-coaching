import { createClient } from "@/lib/supabase/server";
import { VideosView } from "./videos-view";

export default async function VideosPage({
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

  const { data: videos } = await supabase
    .from("resource_videos")
    .select("id, title, url, category, position")
    .eq("user_id", clientId)
    .order("position");

  return <VideosView clientId={clientId} isCoach={isCoach} initialVideos={videos ?? []} />;
}
