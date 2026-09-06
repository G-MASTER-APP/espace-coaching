import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCostUsd, computeCycleStart } from "@/lib/ia-coach/pricing";
import { sendPushToUser } from "@/lib/push/send";
import { notifyCoachOfClient } from "@/lib/ia-coach/notify-coach";

const ANALYSIS_PROMPT = `Tu es le coach sportif personnel du client (via l'application G-Master). Voici plusieurs images extraites d'une vidéo (ou une photo) de lui en train de faire un exercice{exercise}. Analyse sa technique à partir de ces images : posture, alignement, amplitude, points de vigilance. Donne un retour court (5-8 lignes), concret, direct, en tutoyant le client, en français. Si l'exercice n'est pas identifiable, dis-le clairement plutôt que d'inventer une analyse.{question}`;

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
  const { storagePath, frames, exerciseName, question } = body as {
    storagePath: string;
    frames: string[];
    exerciseName: string | null;
    question: string | null;
  };

  if (!storagePath || !Array.isArray(frames) || frames.length === 0) {
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
    return NextResponse.json(
      { error: "Tu as atteint ta limite de dépense IA pour ce mois. Contacte Joris pour l'augmenter." },
      { status: 403 }
    );
  }

  const { data: analysis, error: insertError } = await supabase
    .from("ia_video_analyses")
    .insert({
      client_id: user.id,
      exercise_name: exerciseName || null,
      question: question || null,
      storage_path: storagePath,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !analysis) {
    return NextResponse.json({ error: "Impossible d'enregistrer l'analyse." }, { status: 500 });
  }

  try {
    const prompt = ANALYSIS_PROMPT.replace("{exercise}", exerciseName ? ` (${exerciseName})` : "").replace(
      "{question}",
      question?.trim()
        ? ` Le client a aussi une question : "${question.trim()}". Réponds-y clairement, en plus de l'analyse technique.`
        : ""
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...frames.slice(0, 8).map((frame) => ({
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: frame },
              })),
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
    const feedback = data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "Aucun retour généré.";

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const costUsd = computeCostUsd(inputTokens, outputTokens);

    await supabase
      .from("ia_video_analyses")
      .update({ status: "done", feedback, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd })
      .eq("id", analysis.id);

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

    const { data: coachRow } = await supabase.from("profiles").select("coach_id").eq("id", user.id).single();
    if (coachRow?.coach_id) {
      sendPushToUser(coachRow.coach_id, {
        title: "Analyse vidéo — Coach IA",
        body: exerciseName ? `Un client IA a analysé "${exerciseName}".` : "Un client IA vient d'envoyer une vidéo à analyser.",
        url: `/espace/${user.id}/ia-coach`,
      }).catch(() => {});
    }

    return NextResponse.json({ id: analysis.id, feedback });
  } catch (err) {
    await supabase
      .from("ia_video_analyses")
      .update({ status: "error", feedback: "L'analyse a échoué. Réessaie dans un instant." })
      .eq("id", analysis.id);
    console.error(err);
    return NextResponse.json({ error: "L'analyse a échoué." }, { status: 502 });
  }
}
