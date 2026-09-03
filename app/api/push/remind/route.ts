import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { clientId } = (await request.json()) as { clientId?: string };
  if (!clientId) return NextResponse.json({ error: "clientId manquant." }, { status: 400 });

  // Vérifié côté serveur indépendamment de l'UI : seul le coach du client
  // visé peut déclencher un rappel, même si la requête vient d'ailleurs.
  const { data: client } = await supabase
    .from("profiles")
    .select("id, coach_id, full_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client || client.coach_id !== user.id) {
    return NextResponse.json({ error: "Ce client ne vous est pas rattaché." }, { status: 403 });
  }

  const { sent } = await sendPushToUser(clientId, {
    title: "G-MASTER",
    body: "Ton coach te rappelle de remplir ton suivi du jour.",
    url: `/espace/${clientId}/accompagnement`,
  });

  if (sent === 0) {
    return NextResponse.json({ error: "Ce client n'a activé les notifications sur aucun appareil." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, sent });
}
