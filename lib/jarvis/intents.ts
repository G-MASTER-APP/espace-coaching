export type JarvisIntent =
  | "summary"
  | "water"
  | "sleep"
  | "steps"
  | "package"
  | "diet"
  | "planning"
  | "unknown";

export type LearnedPhrase = { action_id: string; phrase: string };

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Détection par mots-clés (sujet, peu importe le reste de la phrase) plutôt
// qu'un vrai modèle de langage — gratuit, tolère pas mal de formulations
// différentes pour une même demande sans dépendre d'une API payante.
const PATTERNS: { intent: JarvisIntent; keywords: string[] }[] = [
  { intent: "water", keywords: ["eau", " bu", "boire", "hydrat"] },
  { intent: "sleep", keywords: ["sommeil", "dormi", "dors", "nuit"] },
  { intent: "steps", keywords: ["pas", "marche"] },
  { intent: "package", keywords: ["forfait", "seance"] },
  {
    intent: "diet",
    keywords: ["diete", "calorie", "manger", "repas", "macro", "proteine", "glucide", "lipide"],
  },
  { intent: "planning", keywords: ["planning", "semaine", "prevu", "aujourd hui je fais"] },
  { intent: "summary", keywords: ["resume", "recap", "bonjour", "salut", "quoi faire"] },
];

// Utilisé pour peupler le sélecteur du panneau "🎓 apprendre une phrase".
export const LEARNABLE_INTENTS: { intent: JarvisIntent; label: string }[] = [
  { intent: "water", label: "Eau" },
  { intent: "sleep", label: "Sommeil" },
  { intent: "steps", label: "Pas" },
  { intent: "package", label: "Forfait" },
  { intent: "diet", label: "Diète" },
  { intent: "planning", label: "Planning du jour" },
  { intent: "summary", label: "Résumé du jour" },
];

export function matchIntent(rawText: string, learned: LearnedPhrase[] = []): JarvisIntent {
  const text = normalizeText(rawText);
  for (const pattern of PATTERNS) {
    if (pattern.keywords.some((kw) => text.includes(normalizeText(kw)))) {
      return pattern.intent;
    }
  }
  // Phrases enseignées par le coach (panneau 🎓) : une correspondance libre,
  // en plus des motifs intégrés ci-dessus.
  const taught = learned.find((lp) => lp.phrase && text.includes(normalizeText(lp.phrase)));
  if (taught) return taught.action_id as JarvisIntent;
  return "unknown";
}

export function containsWakeWord(rawText: string): boolean {
  return normalizeText(rawText).includes("jarvis");
}
