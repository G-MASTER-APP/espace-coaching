"use client";

import { createClient } from "@/lib/supabase/client";
import type { LearnedPhrase } from "./intents";

export type LearnedPhraseRow = LearnedPhrase & { id: string };

export async function fetchLearnedPhrases(): Promise<LearnedPhraseRow[]> {
  const supabase = createClient();
  const { data } = await supabase.from("jarvis_learned_phrases").select("id, action_id, phrase");
  return data ?? [];
}

export async function addLearnedPhrase(
  coachId: string,
  actionId: string,
  phrase: string
): Promise<LearnedPhraseRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("jarvis_learned_phrases")
    .insert({ coach_id: coachId, action_id: actionId, phrase })
    .select("id, action_id, phrase")
    .single();
  return error ? null : data;
}

export async function deleteLearnedPhrase(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("jarvis_learned_phrases").delete().eq("id", id);
}
