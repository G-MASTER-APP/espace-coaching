import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCostUsd, computeCycleStart } from "@/lib/ia-coach/pricing";
import { buildSystemPrompt, extractStructuredBlocks } from "@/lib/ia-coach/system-prompt";
import { applyExtractedLogs } from "@/lib/ia-coach/apply-logs";
import { notifyCoachOfClient } from "@/lib/ia-coach/notify-coach";

const HISTORY_LIMIT = 30;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Le Coach IA n'est pas encore configuré côté serveur." },
      { status: 503 }
    );
  }

  const { text } = (await request.json()) as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

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

  // Seul le client concerné parle à son Coach IA — le coach humain a une vue
  // lecture seule ailleurs, jamais via cette route.
  if (!profile || profile.role !== "client" || profile.coaching_mode !== "ia") {
    return NextResponse.json({ error: "Le Coach IA n'est pas actif pour ce compte." }, { status: 403 });
  }

  const { data: coaching } = await supabase
    .from("ia_coaching")
    .select("spend_cycle, spend_limit, onboarding_done, program, ai_name, objectif_tags, objectif_details")
    .eq("client_id", user.id)
    .single();

  if (!coaching) {
    return NextResponse.json({ error: "Profil Coach IA introuvable." }, { status: 404 });
  }

  if (coaching.spend_cycle >= coaching.spend_limit) {
    await notifyCoachOfClient(supabase, user.id, {
      title: "Limite IA atteinte",
      body: "Un client a atteint sa limite de dépense IA ce mois-ci.",
      url: "/dashboard",
    });
    return NextResponse.json(
      { error: "Tu as atteint ta limite de dépense IA pour ce mois. Contacte Joris pour l'augmenter." },
      { status: 403 }
    );
  }

  const { data: history } = await supabase
    .from("ia_messages")
    .select("role, content")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const orderedHistory = (history ?? []).slice().reverse();

  await supabase.from("ia_messages").insert({ client_id: user.id, role: "user", content: text });

  const systemPrompt = buildSystemPrompt({
    onboardingDone: coaching.onboarding_done,
    program: (coaching.program as Record<string, unknown>) ?? {},
    aiName: coaching.ai_name,
    objectifTags: coaching.objectif_tags,
    objectifDetails: coaching.objectif_details,
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          ...orderedHistory.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const rawText: string =
      data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "Je n'ai rien à répondre.";

    const { displayText, program, logs, alert } = extractStructuredBlocks(rawText);

    await supabase.from("ia_messages").insert({ client_id: user.id, role: "assistant", content: displayText });
    await applyExtractedLogs(supabase, user.id, logs);

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costUsd = computeCostUsd(inputTokens, outputTokens);

    // Écriture réservée au coach côté RLS (ia_coaching) : on passe par le
    // service_role, comme pour le compteur Jarvis du coach.
    const admin = createAdminClient();
    const { data: current } = await admin
      .from("ia_coaching")
      .select("spend_cycle, spend_cycle_start, spend_total")
      .eq("client_id", user.id)
      .single();

    const todayStr = computeCycleStart(new Date());
    const sameCycle = current?.spend_cycle_start === todayStr;

    const update: Record<string, unknown> = {
      spend_cycle: (sameCycle ? current?.spend_cycle ?? 0 : 0) + costUsd,
      spend_cycle_start: todayStr,
      spend_total: (current?.spend_total ?? 0) + costUsd,
    };
    if (program) {
      update.program = program;
      update.onboarding_done = true;
    }
    if (alert) {
      update.alert_message = alert;
      update.alert_created_at = new Date().toISOString();
    }

    await admin.from("ia_coaching").update(update).eq("client_id", user.id);

    if (alert) {
      await notifyCoachOfClient(supabase, user.id, {
        title: "⚠️ Alerte Coach IA",
        body: alert.slice(0, 150),
        url: `/espace/${user.id}/ia-coach`,
      });
    }

    return NextResponse.json({ reply: displayText, onboardingDone: Boolean(program) || coaching.onboarding_done });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Le Coach IA n'a pas pu répondre — réessaie dans un instant." }, { status: 502 });
  }
}
