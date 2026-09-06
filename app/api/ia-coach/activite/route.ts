import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVITE_OPTIONS } from "@/lib/ia-coach/activite-options";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, coaching_mode")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "client" || profile.coaching_mode !== "ia") {
    return NextResponse.json({ error: "Le Coach IA n'est pas actif pour ce compte." }, { status: 403 });
  }

  const { tags, details } = (await request.json()) as { tags?: string[]; details?: string };
  const validTags = (tags ?? []).filter((t): t is string => (ACTIVITE_OPTIONS as readonly string[]).includes(t));
  const cleanDetails = details?.trim().slice(0, 500) || null;

  // Écriture réservée au coach côté RLS (ia_coaching) : on passe par le
  // service_role, comme pour le reste des champs de ia_coaching.
  const admin = createAdminClient();
  const { error } = await admin
    .from("ia_coaching")
    .update({ activite_tags: validTags, activite_details: cleanDetails })
    .eq("client_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Impossible d'enregistrer." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tags: validTags, details: cleanDetails });
}
