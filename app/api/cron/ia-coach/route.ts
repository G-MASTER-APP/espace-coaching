import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runProactiveCheckIn } from "@/lib/ia-coach/proactive";

/**
 * Un seul cron quotidien (au lieu de trois séparés) : Vercel Hobby limite le
 * nombre et la fréquence des crons, donc on regroupe daily/weekly/monthly
 * ici et on décide nous-mêmes, à chaque exécution, qui doit être relancé
 * aujourd'hui (dimanche = bilan hebdo, 1er du mois = bilan mensuel).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: clients } = await admin.from("profiles").select("id").eq("coaching_mode", "ia");

  const today = new Date();
  const isSunday = today.getUTCDay() === 0;
  const isFirstOfMonth = today.getUTCDate() === 1;

  const results: Record<string, { skipped: boolean; reason?: string }> = {};

  for (const client of clients ?? []) {
    try {
      const daily = await runProactiveCheckIn(client.id, "daily");
      results[`${client.id}:daily`] = daily;

      if (isSunday) {
        const weekly = await runProactiveCheckIn(client.id, "weekly");
        results[`${client.id}:weekly`] = weekly;
      }
      if (isFirstOfMonth) {
        const monthly = await runProactiveCheckIn(client.id, "monthly");
        results[`${client.id}:monthly`] = monthly;
      }
    } catch (err) {
      console.error(`Coach IA cron error for client ${client.id}:`, err);
      results[`${client.id}:error`] = { skipped: true, reason: "exception" };
    }
  }

  return NextResponse.json({ ok: true, clientCount: clients?.length ?? 0, results });
}
