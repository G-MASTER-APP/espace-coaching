import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const { name } = (await request.json()) as { name?: string };
  const cleanName = name?.trim().slice(0, 30);
  if (!cleanName) {
    return NextResponse.json({ error: "Nom vide." }, { status: 400 });
  }

  // Écriture réservée au coach côté RLS (ia_coaching) : on passe par le
  // service_role, comme pour le reste des champs de ia_coaching.
  const admin = createAdminClient();
  const { error } = await admin.from("ia_coaching").update({ ai_name: cleanName }).eq("client_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Impossible d'enregistrer le nom." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name: cleanName });
}
