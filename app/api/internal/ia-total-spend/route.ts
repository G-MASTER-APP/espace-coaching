import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Appelée en cross-origin depuis l'outil statique "Emploi du temps"
// (file:// ou hébergement séparé) : CORS ouvert, la vraie protection est le
// secret partagé (voir plus bas), pas l'origine.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Expose le total de dépense IA de cette app à G-MASTER-PROGRAM et à
 * l'outil "Emploi du temps", pour afficher un compteur combiné. Protégé par
 * un secret partagé entre les projets (pas de données client, juste un
 * total en dollars, mais on évite qu'un tiers puisse le récupérer en
 * devinant l'URL).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.INTERNAL_STATS_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401, headers: CORS_HEADERS });
  }

  const admin = createAdminClient();
  const { data } = await admin.from("ia_coaching").select("spend_total");
  const totalSpend = (data ?? []).reduce((sum, row) => sum + (row.spend_total ?? 0), 0);

  return NextResponse.json({ totalSpend }, { headers: CORS_HEADERS });
}
