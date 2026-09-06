// Cases à cocher de l'écran "Antécédents médicaux" de l'onboarding — l'IA
// doit connaître ça AVANT de construire le programme (contre-indications,
// exercices à éviter/adapter). Partagée avec le prompt système.
export const ANTECEDENTS_OPTIONS = [
  "Aucun souci particulier",
  "Douleurs / blessure au dos",
  "Douleurs / blessure aux genoux",
  "Douleurs / blessure aux épaules",
  "Problème cardiaque",
  "Asthme / souci respiratoire",
  "Grossesse",
] as const;
