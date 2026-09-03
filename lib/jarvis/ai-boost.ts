"use client";

/**
 * Appelle notre route serveur (app/api/jarvis-ai), jamais l'API OpenAI
 * directement — la clé ne doit jamais transiter par le navigateur.
 */
export async function callJarvisAI(text: string): Promise<string> {
  try {
    const res = await fetch("/api/jarvis-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as { reply?: string; error?: string };
    if (!res.ok || !data.reply) {
      return data.error ?? "Je n'ai pas pu joindre l'IA pour le moment.";
    }
    return data.reply;
  } catch {
    return "Je n'ai pas pu joindre l'IA — vérifiez la connexion.";
  }
}
