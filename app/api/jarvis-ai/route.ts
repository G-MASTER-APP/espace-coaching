import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SYSTEM_PROMPT =
  "Tu es Jarvis, l'assistant vocal personnel d'un espace de coaching sportif (G-MASTER). " +
  "Réponds en français, en 2-3 phrases maximum, de façon naturelle, directe et un peu formelle (vouvoiement). " +
  "Tu ne peux pas agir toi-même dans l'application (remplir l'eau, le sommeil, etc.) — pour ça l'utilisateur " +
  "doit utiliser les commandes normales de Jarvis, pas toi.";

function computeCycleStart(today: Date): string {
  // Cycle calendaire simple (1er du mois) plutôt que de deviner la date de
  // facturation réelle du compte OpenAI, propre à chaque compte/clé.
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "Le mode IA n'est pas encore configuré côté serveur." },
      { status: 503 }
    );
  }

  const { text } = (await request.json()) as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Requête vide." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role, coach_id")
    .eq("id", user.id)
    .single();
  if (!viewer) {
    return NextResponse.json({ error: "Profil introuvable." }, { status: 403 });
  }

  const coachId = viewer.role === "coach" ? user.id : viewer.coach_id;
  if (!coachId) {
    return NextResponse.json({ error: "Aucun coach rattaché." }, { status: 403 });
  }

  // Re-vérifié côté serveur (pas seulement côté client) : sinon un client
  // pourrait appeler cette route directement et faire payer son coach même
  // si celui-ci a désactivé le mode IA.
  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("ai_boost_enabled")
    .eq("id", coachId)
    .single();
  if (!coachProfile?.ai_boost_enabled) {
    return NextResponse.json({ error: "Le mode IA est désactivé par le coach." }, { status: 403 });
  }

  let reply: string;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        max_completion_tokens: 220,
      }),
    });

    if (!r.ok) {
      return NextResponse.json(
        { error: "Je n'ai pas réussi à joindre l'IA — vérifiez la clé ou le plafond de dépense OpenAI." },
        { status: 502 }
      );
    }

    const data = await r.json();
    reply = data.choices?.[0]?.message?.content?.trim() || "Je n'ai rien à répondre.";
    usage = data.usage;
  } catch {
    return NextResponse.json({ error: "Je n'ai pas pu joindre l'IA — vérifiez la connexion." }, { status: 502 });
  }

  if (usage) {
    const priceIn = Number(process.env.OPENAI_PRICE_PER_1M_INPUT) || 0;
    const priceOut = Number(process.env.OPENAI_PRICE_PER_1M_OUTPUT) || 0;
    const cost =
      ((usage.prompt_tokens ?? 0) / 1_000_000) * priceIn +
      ((usage.completion_tokens ?? 0) / 1_000_000) * priceOut;

    const admin = createAdminClient();
    const { data: current } = await admin
      .from("profiles")
      .select("ai_spend_cycle, ai_spend_cycle_start, ai_spend_total")
      .eq("id", coachId)
      .single();

    const todayStr = computeCycleStart(new Date());
    const sameCycle = current?.ai_spend_cycle_start === todayStr;

    await admin
      .from("profiles")
      .update({
        ai_spend_cycle: (sameCycle ? current?.ai_spend_cycle ?? 0 : 0) + cost,
        ai_spend_cycle_start: todayStr,
        ai_spend_total: (current?.ai_spend_total ?? 0) + cost,
      })
      .eq("id", coachId);
  }

  return NextResponse.json({ reply });
}
