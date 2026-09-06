import { OBJECTIF_OPTIONS } from "@/lib/ia-coach/objectif-options";
import type { Seance } from "@/app/espace/[clientId]/ia-coach/seance-player";

export const DRAFT_PROGRAMME_START = "<<<DRAFT_PROGRAMME_JSON>>>";
export const DRAFT_PROGRAMME_END = "<<<FIN_DRAFT_PROGRAMME_JSON>>>";
export const DRAFT_DIETE_START = "<<<DRAFT_DIETE_JSON>>>";
export const DRAFT_DIETE_END = "<<<FIN_DRAFT_DIETE_JSON>>>";
export const DRAFT_OBJECTIF_START = "<<<DRAFT_OBJECTIF_JSON>>>";
export const DRAFT_OBJECTIF_END = "<<<FIN_DRAFT_OBJECTIF_JSON>>>";

export type DraftDiete = {
  calories_target?: number;
  protein_target_g?: number;
  carbs_target_g?: number;
  fat_target_g?: number;
};
export type DraftObjectif = { tags: string[]; details?: string };

/**
 * PAS le Coach IA du client : cet assistant parle à Joris (le coach), jamais
 * directement au client. Il propose des brouillons (programme, diète,
 * objectif) que Joris relit et applique lui-même — aucune écriture directe
 * chez le client depuis ce prompt.
 */
export function buildCoachAssistantPrompt({
  clientName,
  currentSeances,
  currentDiet,
  currentObjectif,
}: {
  clientName: string;
  currentSeances: Seance[];
  currentDiet: DraftDiete | null;
  currentObjectif: DraftObjectif | null;
}): string {
  const contextParts: string[] = [];
  if (currentSeances.length) {
    contextParts.push(`Programme structuré actuel de ${clientName} :\n${JSON.stringify(currentSeances, null, 2)}`);
  }
  if (currentDiet) {
    contextParts.push(`Diète actuelle de ${clientName} : ${JSON.stringify(currentDiet)}`);
  }
  if (currentObjectif?.tags.length) {
    contextParts.push(
      `Objectif actuel de ${clientName} : ${currentObjectif.tags.join(", ")}` +
        (currentObjectif.details ? ` — précision : "${currentObjectif.details}"` : "")
    );
  }
  const context = contextParts.length ? "\n\n" + contextParts.join("\n\n") : "\n\nAucune donnée existante pour ce client pour l'instant.";

  return (
    `Tu es l'assistant personnel de Joris, coach sportif humain dans l'application G-Master. Il te parle de ${clientName}, ` +
    "un de ses clients suivis EN DIRECT par lui (pas un client Coach IA) — tu ne parles JAMAIS au client, uniquement à " +
    "Joris, pour l'aider à préparer plus vite ce qu'il rédigerait sinon à la main. Réponds en français, en tutoyant " +
    "Joris, de façon directe et concrète. N'utilise JAMAIS de syntaxe markdown (pas de **gras**, pas de #titres, pas " +
    "de listes à tirets/étoiles) — le texte s'affiche tel quel, sans rendu." +
    context +
    "\n\nQuand Joris te demande un PROGRAMME DE SPORT pour ce client, réponds par un résumé bref de ce que tu proposes " +
    "puis termine ta réponse par un bloc EXACTEMENT sous cette forme :\n" +
    `${DRAFT_PROGRAMME_START}\n[{"nom": "Push", "exercices": [{"nom": "Développé couché", "series": [{"poids_kg": 20, ` +
    '"repetitions": 10}], "repos_secondes": 90}]}]\n' +
    `${DRAFT_PROGRAMME_END}\n` +
    "Deux formats de séance selon le sport, comme d'habitude : \"exercices\" (musculation, séries poids/répétitions) " +
    "ou \"cardio\" (course, vélo, natation...) avec {\"activite\", \"duree_minutes\", \"distance_km\", " +
    '"allure_cible", "description"} — jamais les deux vides sur une même séance. Le tableau complet des séances ' +
    "remplace le programme précédent, inclus donc TOUTES les séances voulues (pas juste celle qui change)." +
    "\n\nQuand Joris te parle de DIÈTE pour ce client, termine ta réponse par :\n" +
    `${DRAFT_DIETE_START}\n{"calories_target": 2200, "protein_target_g": 150, "carbs_target_g": 220, "fat_target_g": 70}\n${DRAFT_DIETE_END}\n` +
    "Uniquement les clés que tu fixes/changes, omets les autres." +
    "\n\nQuand Joris te parle de l'OBJECTIF de ce client, termine ta réponse par :\n" +
    `${DRAFT_OBJECTIF_START}\n{"tags": ["..."], "details": "..."}\n${DRAFT_OBJECTIF_END}\n` +
    `Les tags doivent venir de cette liste fixe (les mêmes que pour Coach IA) : ${OBJECTIF_OPTIONS.join(", ")}. ` +
    "\"details\" est un texte libre optionnel (ex: \"perdre 5kg en 3 mois\")." +
    "\n\nCes trois blocs sont invisibles pour Joris dans le texte (l'app les affiche sous forme de brouillon à " +
    "valider) — ne les mentionne jamais explicitement, et n'en inclus un que si Joris a effectivement demandé ce " +
    "type de contenu dans son message. Tu peux répondre sans aucun bloc si Joris pose juste une question ou " +
    "discute, sans rien te demander de générer."
  );
}

function extractBlock(text: string, startMarker: string, endMarker: string): { rest: string; content: string | null } {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return { rest: text, content: null };
  const endIdx = text.indexOf(endMarker);
  if (endIdx === -1 || endIdx < startIdx) {
    // Réponse tronquée avant la fin du bloc : inexploitable, on le retire
    // quand même du texte visible plutôt que de laisser du JSON coupé.
    return { rest: text.slice(0, startIdx).trim(), content: null };
  }
  const content = text.slice(startIdx + startMarker.length, endIdx).trim();
  const rest = text.slice(0, startIdx) + text.slice(endIdx + endMarker.length);
  return { rest, content };
}

export function extractCoachAssistantDrafts(rawText: string): {
  displayText: string;
  draftProgramme: Seance[] | null;
  draftDiete: DraftDiete | null;
  draftObjectif: DraftObjectif | null;
} {
  let text = rawText;
  let draftProgramme: Seance[] | null = null;
  let draftDiete: DraftDiete | null = null;
  let draftObjectif: DraftObjectif | null = null;

  const programmeBlock = extractBlock(text, DRAFT_PROGRAMME_START, DRAFT_PROGRAMME_END);
  text = programmeBlock.rest;
  if (programmeBlock.content) {
    try {
      const parsed = JSON.parse(programmeBlock.content);
      if (Array.isArray(parsed)) draftProgramme = parsed as Seance[];
    } catch {
      // ignoré
    }
  }

  const dieteBlock = extractBlock(text, DRAFT_DIETE_START, DRAFT_DIETE_END);
  text = dieteBlock.rest;
  if (dieteBlock.content) {
    try {
      draftDiete = JSON.parse(dieteBlock.content) as DraftDiete;
    } catch {
      // ignoré
    }
  }

  const objectifBlock = extractBlock(text, DRAFT_OBJECTIF_START, DRAFT_OBJECTIF_END);
  text = objectifBlock.rest;
  if (objectifBlock.content) {
    try {
      const parsed = JSON.parse(objectifBlock.content) as DraftObjectif;
      if (Array.isArray(parsed.tags)) draftObjectif = parsed;
    } catch {
      // ignoré
    }
  }

  return { displayText: text.trim(), draftProgramme, draftDiete, draftObjectif };
}
