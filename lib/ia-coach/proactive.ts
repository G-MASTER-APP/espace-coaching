import { createAdminClient } from "@/lib/supabase/admin";
import { computeCostUsd, computeCycleStart } from "@/lib/ia-coach/pricing";
import { buildSystemPrompt, extractStructuredBlocks } from "@/lib/ia-coach/system-prompt";
import { sendPushToUser } from "@/lib/push/send";

export type ProactiveKind = "daily" | "weekly" | "monthly";

const TRIGGER_PROMPT: Record<ProactiveKind, string> = {
  daily:
    "[Message système — le client n'a rien écrit, c'est toi qui prends l'initiative] " +
    "Donne au client sa guidance alimentaire du jour : quoi manger, dans quel esprit, en lien avec son " +
    "programme et son objectif. Sois bref (3-5 phrases), concret, motivant.",
  weekly:
    "[Message système — le client n'a rien écrit, c'est toi qui prends l'initiative] " +
    "C'est le bilan de la semaine : demande au client une photo récente et son poids actuel pour ajuster " +
    "son sport et sa diète en conséquence. Explique brièvement pourquoi (suivi de sa progression).",
  monthly:
    "[Message système — le client n'a rien écrit, c'est toi qui prends l'initiative] " +
    "C'est le bilan du mois : demande au client ses mensurations (tour de taille, hanches, poitrine, ou ce " +
    "qui te semble pertinent selon son objectif) pour ajuster ses habitudes et son programme sur la durée.",
};

const PUSH_SUFFIX: Record<ProactiveKind, string> = {
  daily: "guidance du jour",
  weekly: "bilan de la semaine",
  monthly: "bilan du mois",
};

/**
 * Fait parler le Coach IA en premier (pas de message du client), pour la
 * guidance quotidienne / le bilan hebdo / le bilan mensuel. Appelée depuis
 * la route cron — jamais depuis le navigateur du client.
 */
export async function runProactiveCheckIn(
  clientId: string,
  kind: ProactiveKind
): Promise<{ skipped: boolean; reason?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { skipped: true, reason: "no_api_key" };

  const admin = createAdminClient();

  const { data: coaching } = await admin
    .from("ia_coaching")
    .select(
      "spend_cycle, spend_limit, onboarding_done, program, ai_name, last_daily_at, last_weekly_at, last_monthly_at"
    )
    .eq("client_id", clientId)
    .single();
  if (!coaching) return { skipped: true, reason: "not_found" };

  // Onboarding pas fini : le client n'a pas encore de programme, on ne
  // dérange pas avec une relance quotidienne/hebdo/mensuelle.
  if (!coaching.onboarding_done) return { skipped: true, reason: "onboarding_not_done" };

  if (coaching.spend_cycle >= coaching.spend_limit) return { skipped: true, reason: "limit_reached" };

  // Idempotent : si le cron est relancé deux fois le même jour (retry,
  // double déclenchement), on ne relance pas une deuxième fois.
  const todayDate = new Date().toISOString().slice(0, 10);
  const lastRunFor: Record<ProactiveKind, string | null> = {
    daily: coaching.last_daily_at,
    weekly: coaching.last_weekly_at,
    monthly: coaching.last_monthly_at,
  };
  if (lastRunFor[kind] === todayDate) return { skipped: true, reason: "already_done_today" };

  const { data: history } = await admin
    .from("ia_messages")
    .select("role, content")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(30);
  const orderedHistory = (history ?? []).slice().reverse();

  const systemPrompt = buildSystemPrompt({
    onboardingDone: true,
    program: (coaching.program as Record<string, unknown>) ?? {},
    aiName: coaching.ai_name,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        ...orderedHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: TRIGGER_PROMPT[kind] },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const rawText: string = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  const { displayText, program } = extractStructuredBlocks(rawText);

  if (displayText) {
    await admin.from("ia_messages").insert({ client_id: clientId, role: "assistant", content: displayText });
  }

  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const costUsd = computeCostUsd(inputTokens, outputTokens);

  const { data: current } = await admin
    .from("ia_coaching")
    .select("spend_cycle, spend_cycle_start, spend_total")
    .eq("client_id", clientId)
    .single();
  const todayStr = computeCycleStart(new Date());
  const sameCycle = current?.spend_cycle_start === todayStr;

  const dateColumn = kind === "daily" ? "last_daily_at" : kind === "weekly" ? "last_weekly_at" : "last_monthly_at";

  const update: Record<string, unknown> = {
    spend_cycle: (sameCycle ? current?.spend_cycle ?? 0 : 0) + costUsd,
    spend_cycle_start: todayStr,
    spend_total: (current?.spend_total ?? 0) + costUsd,
    [dateColumn]: todayDate,
  };
  if (program) update.program = program;

  await admin.from("ia_coaching").update(update).eq("client_id", clientId);

  if (displayText) {
    sendPushToUser(clientId, {
      title: `${coaching.ai_name?.trim() || "Ton Coach IA"} — ${PUSH_SUFFIX[kind]}`,
      body: displayText.slice(0, 120),
      url: `/espace/${clientId}/ia-coach`,
    }).catch(() => {});
  }

  return { skipped: false };
}
