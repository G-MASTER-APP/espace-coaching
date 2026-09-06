import { createClient } from "@/lib/supabase/server";
import { BilanView } from "./bilan-view";

export default async function BilanPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: bilans } = await supabase
    .from("body_measurements")
    .select("id, measured_at, measurements, photos_url, weight_kg")
    .eq("user_id", clientId)
    .order("measured_at", { ascending: false });

  return <BilanView clientId={clientId} bilans={bilans ?? []} />;
}
