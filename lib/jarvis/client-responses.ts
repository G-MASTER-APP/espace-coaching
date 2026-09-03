"use client";

import { createClient } from "@/lib/supabase/client";
import { parisToday } from "@/lib/date/paris-day";
import { parisWeekStart, parisIsoDayIndex } from "@/lib/date/paris-week";
import type { JarvisIntent } from "./intents";

type PlanningDay = { done?: boolean; note?: string; priority?: string | null };

export async function buildClientResponse(
  intent: JarvisIntent,
  clientId: string
): Promise<string> {
  const supabase = createClient();
  const today = parisToday();

  switch (intent) {
    case "water": {
      const [{ data: log }, { data: goals }] = await Promise.all([
        supabase
          .from("coaching_daily_logs")
          .select("water_l")
          .eq("user_id", clientId)
          .eq("log_date", today)
          .maybeSingle(),
        supabase.from("coaching_goals").select("water_target_l").eq("user_id", clientId).maybeSingle(),
      ]);
      const drunk = log?.water_l ?? 0;
      const target = goals?.water_target_l ?? 0;
      return `Vous avez bu ${drunk.toFixed(2)} litre${drunk >= 2 ? "s" : ""} sur un objectif de ${target} litres aujourd'hui.`;
    }

    case "sleep": {
      const [{ data: log }, { data: goals }] = await Promise.all([
        supabase
          .from("coaching_daily_logs")
          .select("sleep_h, sleep_quality")
          .eq("user_id", clientId)
          .eq("log_date", today)
          .maybeSingle(),
        supabase.from("coaching_goals").select("sleep_target_h").eq("user_id", clientId).maybeSingle(),
      ]);
      if (!log?.sleep_h) return "Vous n'avez pas encore renseigné votre sommeil de cette nuit.";
      const qualityText = log.sleep_quality ? `, qualité ${log.sleep_quality} sur 5` : "";
      return `Vous avez dormi ${log.sleep_h} heures${qualityText}, pour un objectif de ${goals?.sleep_target_h ?? "?"} heures.`;
    }

    case "steps": {
      const [{ data: log }, { data: goals }] = await Promise.all([
        supabase
          .from("coaching_daily_logs")
          .select("steps")
          .eq("user_id", clientId)
          .eq("log_date", today)
          .maybeSingle(),
        supabase.from("coaching_goals").select("steps_target").eq("user_id", clientId).maybeSingle(),
      ]);
      return `Vous en êtes à ${log?.steps ?? 0} pas sur un objectif de ${goals?.steps_target ?? "?"} pas aujourd'hui.`;
    }

    case "package": {
      const { data: goals } = await supabase
        .from("coaching_goals")
        .select("package_sessions, package_start_date")
        .eq("user_id", clientId)
        .maybeSingle();
      if (!goals) return "Aucun forfait n'est encore configuré.";
      const { data: logs } = await supabase
        .from("coaching_daily_logs")
        .select("sessions_done")
        .eq("user_id", clientId)
        .gte("log_date", goals.package_start_date);
      const total = (logs ?? []).reduce((sum, l) => sum + (l.sessions_done ?? 0), 0);
      return `Vous en êtes à ${total} séance${total > 1 ? "s" : ""} réalisée${total > 1 ? "s" : ""} sur ${goals.package_sessions} prévues dans votre forfait.`;
    }

    case "diet": {
      const [{ data: goals }, { data: entries }] = await Promise.all([
        supabase.from("nutrition_goals").select("calories_target").eq("user_id", clientId).maybeSingle(),
        supabase.from("food_log_entries").select("calories").eq("user_id", clientId).eq("log_date", today),
      ]);
      if (!goals) return "Aucun objectif nutritionnel n'est encore défini.";
      const consumed = (entries ?? []).reduce((sum, e) => sum + (e.calories ?? 0), 0);
      const remaining = Math.max(0, goals.calories_target - consumed);
      return `Vous avez consommé ${Math.round(consumed)} calories sur ${goals.calories_target} prévues. Il vous en reste ${Math.round(remaining)}.`;
    }

    case "planning": {
      const weekStart = parisWeekStart();
      const { data } = await supabase
        .from("plannings")
        .select("days")
        .eq("user_id", clientId)
        .eq("week_start", weekStart)
        .maybeSingle();
      const days = Array.isArray(data?.days) ? (data!.days as PlanningDay[]) : [];
      const todayEntry = days[parisIsoDayIndex()];
      if (!todayEntry?.note) return "Rien de particulier n'est noté dans votre planning aujourd'hui.";
      return `Aujourd'hui au planning : ${todayEntry.note}.`;
    }

    case "summary":
    case "unknown":
    default:
      return buildDailySummary(clientId);
  }
}

export async function buildDailySummary(clientId: string): Promise<string> {
  const supabase = createClient();
  const today = parisToday();
  const weekStart = parisWeekStart();

  const [{ data: planning }, { data: goals }, { data: log }] = await Promise.all([
    supabase.from("plannings").select("days").eq("user_id", clientId).eq("week_start", weekStart).maybeSingle(),
    supabase
      .from("coaching_goals")
      .select("water_target_l, sleep_target_h, steps_target")
      .eq("user_id", clientId)
      .maybeSingle(),
    supabase
      .from("coaching_daily_logs")
      .select("water_l, sleep_h, steps")
      .eq("user_id", clientId)
      .eq("log_date", today)
      .maybeSingle(),
  ]);

  const days = Array.isArray(planning?.days) ? (planning!.days as PlanningDay[]) : [];
  const todayEntry = days[parisIsoDayIndex()];

  const parts: string[] = ["Bonjour. Voici votre point du jour."];

  if (todayEntry?.note) {
    parts.push(`Au programme : ${todayEntry.note}.`);
  } else {
    parts.push("Rien de spécifique noté au planning aujourd'hui.");
  }

  if (goals) {
    parts.push(
      `Objectifs du jour : ${goals.water_target_l} litres d'eau, ${goals.sleep_target_h} heures de sommeil, ${goals.steps_target} pas.`
    );
  }

  if (log && (log.water_l > 0 || log.sleep_h || log.steps > 0)) {
    parts.push(
      `Déjà fait : ${log.water_l.toFixed(2)} litre${log.water_l >= 2 ? "s" : ""} d'eau${
        log.sleep_h ? `, ${log.sleep_h} heures de sommeil` : ""
      }${log.steps > 0 ? `, ${log.steps} pas` : ""}.`
    );
  }

  parts.push("Demandez-moi où vous en êtes à tout moment, je reste à votre écoute.");

  return parts.join(" ");
}
