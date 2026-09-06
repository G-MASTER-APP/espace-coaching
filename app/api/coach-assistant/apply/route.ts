import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { OBJECTIF_OPTIONS } from "@/lib/ia-coach/objectif-options";

type ApplyBody = {
  clientId?: string;
  kind?: "programme" | "diete" | "objectif";
  draft?: unknown;
};

const DIETE_KEYS = ["calories_target", "protein_target_g", "carbs_target_g", "fat_target_g"] as const;

export async function POST(request: Request) {
  const { clientId, kind, draft } = (await request.json()) as ApplyBody;
  if (!clientId || !kind || draft === undefined) {
    return NextResponse.json({ error: "Requête incomplète." }, { status: 400 });
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

  const { data: client } = await supabase.from("profiles").select("coach_id").eq("id", clientId).single();
  if (!client || client.coach_id !== user.id) {
    return NextResponse.json({ error: "Ce client ne t'est pas rattaché." }, { status: 403 });
  }

  if (kind === "programme") {
    if (!Array.isArray(draft)) {
      return NextResponse.json({ error: "Programme invalide." }, { status: 400 });
    }
    const { data: existing } = await supabase.from("programs").select("id").eq("user_id", clientId).maybeSingle();
    const { error } = existing
      ? await supabase.from("programs").update({ seances: draft }).eq("user_id", clientId)
      : await supabase.from("programs").insert({ user_id: clientId, seances: draft });
    if (error) return NextResponse.json({ error: "Impossible d'appliquer le programme." }, { status: 500 });
  } else if (kind === "diete") {
    const raw = draft as Record<string, unknown>;
    const patch = Object.fromEntries(
      DIETE_KEYS.filter((k) => typeof raw[k] === "number").map((k) => [k, raw[k]])
    );
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Diète invalide." }, { status: 400 });
    }
    const { error } = await supabase.from("nutrition_goals").update(patch).eq("user_id", clientId);
    if (error) return NextResponse.json({ error: "Impossible d'appliquer la diète." }, { status: 500 });
  } else if (kind === "objectif") {
    const { tags, details } = draft as { tags?: string[]; details?: string };
    const validTags = (tags ?? []).filter((t): t is string => (OBJECTIF_OPTIONS as readonly string[]).includes(t));
    const { error } = await supabase
      .from("client_objectifs")
      .upsert({ user_id: clientId, tags: validTags, details: details?.trim() || null }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: "Impossible d'appliquer l'objectif." }, { status: 500 });
  } else {
    return NextResponse.json({ error: "Type de brouillon inconnu." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
