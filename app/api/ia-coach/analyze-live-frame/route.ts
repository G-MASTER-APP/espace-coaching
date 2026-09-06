import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCostUsd, computeCycleStart } from "@/lib/ia-coach/pricing";
import { notifyCoachOfClient } from "@/lib/ia-coach/notify-coach";

const LIVE_PROMPT = `Tu es le coach sportif du client, et tu le corriges EN DIRECT pendant qu'il fait un mouvement{exercise}. Regarde cette image et donne UNE SEULE consigne très courte (10 mots maximum), comme un coach qui crie une correction pendant la série — pas de politesse, pas d'explication. Si la posture est bonne, dis juste un encouragement bref ("Bon rythme, continue"). En français, à l'impératif ou en style direct.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Le Coach IA n'est pas encore configuré côté serveur." }, { status: 503 });
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
  if (!profile || profile.role !== "client" || profile.coaching_mode !== "ia") {
    return NextResponse.json({ error: "Le Coach IA n'est pas actif pour ce compte." }, { status: 403 });
  }

  const body = await request.json();
  const { frame, exerciseName } = body as { frame: string; exerciseName: string | null };
  if (!frame) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const { data: coaching } = await supabase
    .from("ia_coaching")
    .select("spend_cycle, spend_limit")
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
    return NextResponse.json({ error: "Limite de dépense IA atteinte. Session live arrêtée." }, { status: 403 });
  }

  try {
    const prompt = LIVE_PROMPT.replace("{exercise}", exerciseName ? ` (${exerciseName})` : "");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: frame } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const feedback = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costUsd = computeCostUsd(inputTokens, outputTokens);

    await supabase.from("ia_video_analyses").insert({
      client_id: user.id,
      exercise_name: exerciseName ? `${exerciseName} (live)` : "Session live",
      storage_path: "live-session",
      status: "done",
      feedback,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
    });

    const admin = createAdminClient();
    const { data: current } = await admin
      .from("ia_coaching")
      .select("spend_cycle, spend_cycle_start, spend_total")
      .eq("client_id", user.id)
      .single();
    const todayStr = computeCycleStart(new Date());
    const sameCycle = current?.spend_cycle_start === todayStr;
    await admin
      .from("ia_coaching")
      .update({
        spend_cycle: (sameCycle ? current?.spend_cycle ?? 0 : 0) + costUsd,
        spend_cycle_start: todayStr,
        spend_total: (current?.spend_total ?? 0) + costUsd,
      })
      .eq("client_id", user.id);

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Analyse live échouée." }, { status: 502 });
  }
}
