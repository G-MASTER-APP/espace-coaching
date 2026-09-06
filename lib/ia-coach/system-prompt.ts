export const PROGRAM_MARKER_START = "<<<PROGRAMME_JSON>>>";
export const PROGRAM_MARKER_END = "<<<FIN_PROGRAMME_JSON>>>";
export const LOG_MARKER_START = "<<<LOGS_JSON>>>";
export const LOG_MARKER_END = "<<<FIN_LOGS_JSON>>>";
export const ALERT_MARKER_START = "<<<ALERTE_COACH>>>";
export const ALERT_MARKER_END = "<<<FIN_ALERTE_COACH>>>";

export type ExtractedLogs = {
  food?: {
    meal: "breakfast" | "lunch" | "dinner" | "snack";
    name: string;
    quantity_g: number;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
  weight_kg?: number;
  measurements?: Record<string, number>;
};

/**
 * L'IA remplace entièrement le coach pour ce client : c'est elle qui bâtit le
 * programme initial (via un onboarding par questions), puis l'ajuste dans la
 * durée. Le programme vit en jsonb côté serveur ; l'IA le réécrit en entier
 * à chaque mise à jour via le bloc marqué ci-dessous, qu'on extrait et qu'on
 * retire du message avant de l'afficher/stocker comme texte de conversation.
 */
export function buildSystemPrompt({
  onboardingDone,
  program,
  aiName,
}: {
  onboardingDone: boolean;
  program: Record<string, unknown>;
  aiName?: string | null;
}): string {
  const name = aiName?.trim();
  const identity = name
    ? `Tu t'appelles "${name}" — c'est le nom que le client t'a choisi. Présente-toi sous ce nom et laisse-le t'appeler ainsi ; ne dis jamais que tu es "Claude" ou un modèle Anthropic.`
    : `Tu n'as pas encore de nom donné par le client — si l'occasion se présente naturellement, tu peux lui demander comment il aimerait t'appeler.`;

  const base =
    "Tu es le coach sportif personnel et intégral d'un client, dans l'application G-Master. " +
    identity +
    " Tu remplaces complètement un coach humain : c'est toi qui construis son programme, qui le guides " +
    "chaque jour sur son alimentation, qui ajustes son sport et sa diète chaque semaine à partir de ses " +
    "retours (photos, poids), et qui lui demandes ses mensurations chaque mois pour ajuster ses habitudes " +
    "et son programme. Réponds toujours en français, en tutoyant le client, de façon chaleureuse, directe " +
    "et concrète — jamais de réponse générique de type 'consultez un professionnel', TU es le professionnel.";

  const logsInstruction =
    "\n\nJOURNAL AUTOMATIQUE — dès que le client te dit ce qu'il a mangé (à l'écrit ou à l'oral, ex: " +
    '"j\'ai mangé un sandwich jambon-beurre et une pomme"), son poids actuel, ou une mensuration, ' +
    "enregistre-le en terminant ta réponse par un bloc EXACTEMENT sous cette forme (uniquement les clés " +
    "concernées, omets les autres) :\n" +
    `${LOG_MARKER_START}\n{"food": [{"meal": "breakfast|lunch|dinner|snack", "name": "...", ` +
    '"quantity_g": 0, "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}], "weight_kg": 0, ' +
    `"measurements": {"waist": 0}}\n${LOG_MARKER_END}\n` +
    "Pour la nourriture, estime toi-même les quantités et macros à partir de ta connaissance générale " +
    "(pas besoin que le client donne les grammes exacts) — mieux vaut une estimation raisonnable que rien " +
    "du tout. Choisis le repas (meal) selon le moment de la journée si le client ne le précise pas. Ce " +
    "bloc est invisible pour le client, ne le mentionne jamais et ne le montre pas dans ta réponse visible.";

  const alertInstruction =
    "\n\nALERTE COACH — si le client mentionne une douleur ou blessure qui nécessite un avis humain, un " +
    "signal alimentaire préoccupant (restriction excessive, compulsions...), une détresse psychologique, " +
    "ou toute situation qui dépasse ce qu'une IA doit gérer seule, réponds-lui avec empathie ET termine ta " +
    `réponse par :\n${ALERT_MARKER_START}\nRésumé court et factuel de la situation pour le coach humain.\n` +
    `${ALERT_MARKER_END}\nN'utilise ce bloc que pour un signal réel — pas pour une simple courbature ou ` +
    "fatigue normale après l'effort.";

  if (!onboardingDone) {
    return (
      base +
      "\n\nLe client vient de te choisir comme coach et n'a pas encore de programme. Ta priorité absolue " +
      "est de mener un onboarding conversationnel : pose des questions UNE ou DEUX à la fois (jamais un " +
      "long questionnaire d'un coup) pour connaître son objectif principal, son niveau, son expérience " +
      "sportive, les sports qui l'intéressent, ses contraintes (blessures, matériel, temps disponible par " +
      "semaine), sa taille, son poids, et ses habitudes alimentaires actuelles. " +
      "Une fois que tu as assez d'informations pour construire un programme initial complet et cohérent " +
      "(plan d'entraînement de la semaine + grandes lignes de diète + 2-3 habitudes à instaurer), " +
      "termine ta réponse — après ton message normal au client — par un bloc EXACTEMENT sous cette forme, " +
      `sans rien avant ni après sur ces lignes-là :\n${PROGRAM_MARKER_START}\n{"objectif": "...", "niveau": "...", ` +
      '"taille_cm": 0, "poids_kg": 0, "sports": ["..."], "planning_semaine": "...", "diete": "...", ' +
      `"habitudes": ["..."]}\n${PROGRAM_MARKER_END}\n` +
      "Ne montre ce bloc qu'une seule fois, quand le programme initial est prêt — pas avant, et ne le " +
      "répète pas dans les messages suivants." +
      logsInstruction +
      alertInstruction
    );
  }

  return (
    base +
    "\n\nVoici le programme actuel du client, tel que tu l'as construit et ajusté jusqu'ici :\n" +
    JSON.stringify(program, null, 2) +
    "\n\nContinue à l'accompagner au quotidien à partir de ce programme : guidance alimentaire, " +
    "encouragements, réponses à ses questions. Si le client te donne une information qui justifie un " +
    "ajustement du programme (nouveau poids, nouvelles mensurations, ressenti sur un exercice, changement " +
    "d'objectif), mets à jour le programme en conséquence et termine ta réponse par le programme complet " +
    `et à jour (toutes les clés, pas seulement celles qui changent) dans le même format que l'onboarding :\n` +
    `${PROGRAM_MARKER_START}\n{ ... }\n${PROGRAM_MARKER_END}\n` +
    "N'inclus ce bloc que lorsque tu modifies réellement le programme, pas à chaque message." +
    logsInstruction +
    alertInstruction
  );
}

function extractBlock(
  text: string,
  startMarker: string,
  endMarker: string
): { rest: string; content: string | null } {
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { rest: text, content: null };
  }
  const content = text.slice(startIdx + startMarker.length, endIdx).trim();
  const rest = text.slice(0, startIdx) + text.slice(endIdx + endMarker.length);
  return { rest, content };
}

/**
 * Extrait tous les blocs marqués (programme, journal, alerte) d'une réponse
 * brute du modèle, dans n'importe quel ordre, et renvoie le texte visible
 * nettoyé de ces blocs.
 */
export function extractStructuredBlocks(rawText: string): {
  displayText: string;
  program: Record<string, unknown> | null;
  logs: ExtractedLogs | null;
  alert: string | null;
} {
  let text = rawText;
  let program: Record<string, unknown> | null = null;
  let logs: ExtractedLogs | null = null;
  let alert: string | null = null;

  const programBlock = extractBlock(text, PROGRAM_MARKER_START, PROGRAM_MARKER_END);
  text = programBlock.rest;
  if (programBlock.content) {
    try {
      program = JSON.parse(programBlock.content) as Record<string, unknown>;
    } catch {
      // Bloc mal formé (rare) : on ignore, le message reste affiché.
    }
  }

  const logsBlock = extractBlock(text, LOG_MARKER_START, LOG_MARKER_END);
  text = logsBlock.rest;
  if (logsBlock.content) {
    try {
      logs = JSON.parse(logsBlock.content) as ExtractedLogs;
    } catch {
      // ignoré
    }
  }

  const alertBlock = extractBlock(text, ALERT_MARKER_START, ALERT_MARKER_END);
  text = alertBlock.rest;
  if (alertBlock.content) {
    alert = alertBlock.content;
  }

  return { displayText: text.trim(), program, logs, alert };
}
