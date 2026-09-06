import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runProactiveCheckIn } from "@/lib/ia-coach/proactive";

/**
 * Deux passages quotidiens (matin et soir), un seul point d'entrée : le
 * paramètre ?slot= (voir vercel.json) distingue les deux, pour rester sous
 * la limite de crons de Vercel Hobby plutôt que d'en multiplier les
 * définitions. Le matin regroupe aussi daily/hebdo/mensuel (dimanche =
 * bilan hebdo, 1er du mois = bilan mensuel) ; le soir ne fait que le
 * résumé du soir.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const slot = request.nextUrl.searchParams.get("slot") === "evening" ? "evening" : "morning";

  const admin = createAdminClient();
  const { data: clients } = await admin.from("profiles").select("id").eq("coaching_mode", "ia");

  const today = new Date();
  const isSunday = today.getUTCDay() === 0;
  const isFirstOfMonth = today.getUTCDate() === 1;

  const results: Record<string, { skipped: boolean; reason?: string }> = {};

  for (const client of clients ?? []) {
    try {
      if (slot === "evening") {
        results[`${client.id}:evening`] = await runProactiveCheckIn(client.id, "evening");
        continue;
      }

      results[`${client.id}:daily`] = await runProactiveCheckIn(client.id, "daily");
      if (isSunday) {
        results[`${client.id}:weekly`] = await runProactiveCheckIn(client.id, "weekly");
      }
      if (isFirstOfMonth) {
        results[`${client.id}:monthly`] = await runProactiveCheckIn(client.id, "monthly");
      }
    } catch (err) {
      console.error(`Coach IA cron error (${slot}) for client ${client.id}:`, err);
      results[`${client.id}:error`] = { skipped: true, reason: "exception" };
    }
  }

  return NextResponse.json({ ok: true, slot, clientCount: clients?.length ?? 0, results });
}
