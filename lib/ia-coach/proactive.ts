import { createAdminClient } from "@/lib/supabase/admin";
import { computeCostUsd, computeCycleStart } from "@/lib/ia-coach/pricing";
import { buildSystemPrompt, extractStructuredBlocks } from "@/lib/ia-coach/system-prompt";
import { applyExtractedHabits } from "@/lib/ia-coach/apply-habits";
import { sendPushToUser } from "@/lib/push/send";

export type ProactiveKind = "daily" | "evening" | "weekly" | "monthly";

const TRIGGER_PROMPT: Record<ProactiveKind, string> = {
  daily:
    "[Message système — le client n'a rien écrit, c'est toi qui prends l'initiative] " +
    "Donne au client sa guidance du jour sur les trois fronts de son programme : combien de pas viser " +
    "aujourd'hui, quoi manger (diète), et ce qu'il doit faire côté sport (séance du jour ou repos actif) — " +
    "en lien avec son programme et son objectif. Rappelle-lui aussi, en une phrase, de ne pas oublier de te " +
    "dire ce qu'il mange/fait dans la journée pour que tu puisses vraiment le suivre. Sois bref (4-6 " +
    "phrases), concret, motivant — le client n'a pas de temps à perdre, va droit au but.",
  evening:
    "[Message système — le client n'a rien écrit, c'est toi qui prends l'initiative] " +
    "C'est la fin de journée : fais un micro-résumé de ce qu'il a fait aujourd'hui (repas loggés, activité, " +
    "ressenti mentionné pendant la journée), en 2-3 phrases maximum. Termine par UNE consigne claire et " +
    "concrète pour demain (prochaine séance, point de vigilance côté diète). Reste très court — le but est " +
    "que ça se lise en quelques secondes.",
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
  evening: "résumé du soir",
  weekly: "bilan de la semaine",
  monthly: "bilan du mois",
};

const DATE_COLUMN: Record<ProactiveKind, string> = {
  daily: "last_daily_at",
  evening: "last_evening_at",
  weekly: "last_weekly_at",
  monthly: "last_monthly_at",
};

/**
 * Fait parler le Coach IA en premier (pas de message du client), pour la
 * guidance quotidienne / le résumé du soir / le bilan hebdo / le bilan
 * mensuel. Appelée depuis la route cron — jamais depuis le navigateur du
 * client.
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
      "spend_cycle, spend_limit, onboarding_done, program, ai_name, objectif_tags, objectif_details, sport_tags, sport_details, antecedents_tags, antecedents_details, activite_tags, activite_details, last_daily_at, last_evening_at, last_weekly_at, last_monthly_at"
    )
    .eq("client_id", clientId)
    .single();
  if (!coaching) return { skipped: true, reason: "not_found" };

  const [{ data: dailyGoals }, { data: nutritionGoals }] = await Promise.all([
    admin
      .from("coaching_goals")
      .select("steps_target, water_target_l, sleep_target_h")
      .eq("user_id", clientId)
      .maybeSingle(),
    admin
      .from("nutrition_goals")
      .select("calories_target, protein_target_g, carbs_target_g, fat_target_g")
      .eq("user_id", clientId)
      .maybeSingle(),
  ]);

  // Onboarding pas fini : le client n'a pas encore de programme, on ne
  // dérange pas avec une relance quotidienne/soir/hebdo/mensuelle.
  if (!coaching.onboarding_done) return { skipped: true, reason: "onboarding_not_done" };

  if (coaching.spend_cycle >= coaching.spend_limit) return { skipped: true, reason: "limit_reached" };

  // Idempotent : si le cron est relancé deux fois le même jour (retry,
  // double déclenchement), on ne relance pas une deuxième fois.
  const todayDate = new Date().toISOString().slice(0, 10);
  const lastRunFor: Record<ProactiveKind, string | null> = {
    daily: coaching.last_daily_at,
    evening: coaching.last_evening_at,
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
    objectifTags: coaching.objectif_tags,
    objectifDetails: coaching.objectif_details,
    sportTags: coaching.sport_tags,
    sportDetails: coaching.sport_details,
    antecedentsTags: coaching.antecedents_tags,
    antecedentsDetails: coaching.antecedents_details,
    activiteTags: coaching.activite_tags,
    activiteDetails: coaching.activite_details,
    currentGoals: { ...dailyGoals, ...nutritionGoals },
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
      // Le message reste censé être bref (recap/relance), mais ce prompt
      // autorise aussi un ajustement programme/habitudes (JSON) si la
      // situation le justifie — même marge que la route de chat principale
      // (4000) pour ne jamais couper ces blocs en plein milieu.
      max_tokens: 4000,
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
  const { displayText, program, habits } = extractStructuredBlocks(rawText);
  await applyExtractedHabits(admin, clientId, habits);

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

  const update: Record<string, unknown> = {
    spend_cycle: (sameCycle ? current?.spend_cycle ?? 0 : 0) + costUsd,
    spend_cycle_start: todayStr,
    spend_total: (current?.spend_total ?? 0) + costUsd,
    [DATE_COLUMN[kind]]: todayDate,
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
