import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { buildCoachAssistantPrompt, extractCoachAssistantDrafts } from "@/lib/coach-assistant/system-prompt";
import type { Seance } from "@/app/espace/[clientId]/ia-coach/seance-player";

const HISTORY_LIMIT = 20;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "L'assistant n'est pas encore configuré côté serveur." }, { status: 503 });
  }

  const { clientId, text, history } = (await request.json()) as {
    clientId?: string;
    text?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };
  if (!clientId || !text || !text.trim()) {
    return NextResponse.json({ error: "Client ou message manquant." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { data: viewer } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!viewer || viewer.role !== "coach") {
    return NextResponse.json({ error: "Réservé au coach." }, { status: 403 });
  }

  const { data: client } = await supabase
    .from("profiles")
    .select("full_name, coach_id, coaching_mode")
    .eq("id", clientId)
    .single();
  if (!client || client.coach_id !== user.id) {
    return NextResponse.json({ error: "Ce client ne t'est pas rattaché." }, { status: 403 });
  }
  if (client.coaching_mode === "ia") {
    // Son programme/diète/objectif vivent dans ia_coaching, pas dans les
    // tables que cet assistant lit/écrit — l'IA les gère déjà elle-même.
    return NextResponse.json({ error: "Ce client est suivi par le Coach IA, pas par toi directement." }, { status: 400 });
  }

  const [{ data: program }, { data: dietRow }, { data: objectifRow }] = await Promise.all([
    supabase.from("programs").select("seances").eq("user_id", clientId).maybeSingle(),
    supabase
      .from("nutrition_goals")
      .select("calories_target, protein_target_g, carbs_target_g, fat_target_g")
      .eq("user_id", clientId)
      .maybeSingle(),
    supabase.from("client_objectifs").select("tags, details").eq("user_id", clientId).maybeSingle(),
  ]);

  const systemPrompt = buildCoachAssistantPrompt({
    clientName: client.full_name?.trim() || "ce client",
    currentSeances: (program?.seances as Seance[]) ?? [],
    currentDiet: dietRow ?? null,
    currentObjectif: objectifRow ? { tags: objectifRow.tags ?? [], details: objectifRow.details ?? undefined } : null,
  });

  const orderedHistory = (history ?? []).slice(-HISTORY_LIMIT);

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
        max_tokens: 3000,
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
    const rawText: string | undefined = data.content?.find((c: { type: string }) => c.type === "text")?.text;
    if (!rawText) {
      throw new Error("Réponse Anthropic sans bloc texte exploitable.");
    }

    const { displayText, draftProgramme, draftDiete, draftObjectif } = extractCoachAssistantDrafts(rawText);
    if (!displayText) {
      throw new Error("Réponse vide après extraction des blocs.");
    }

    return NextResponse.json({ reply: displayText, draftProgramme, draftDiete, draftObjectif });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "L'assistant n'a pas pu répondre — réessaie dans un instant." }, { status: 502 });
  }
}
