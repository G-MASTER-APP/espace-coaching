export const BODY_ZONES = [
  { key: "neck", label: "Cou" },
  { key: "shoulders", label: "Épaules" },
  { key: "chest", label: "Poitrine" },
  { key: "biceps_left", label: "Biceps gauche" },
  { key: "biceps_right", label: "Biceps droit" },
  { key: "waist", label: "Taille" },
  { key: "hips", label: "Hanches" },
  { key: "thigh_left", label: "Cuisse gauche" },
  { key: "thigh_right", label: "Cuisse droite" },
  { key: "calf_left", label: "Mollet gauche" },
  { key: "calf_right", label: "Mollet droit" },
] as const;

export type BodyZoneKey = (typeof BODY_ZONES)[number]["key"];
export type Measurements = Partial<Record<BodyZoneKey, number>>;

// 0 à 300 cm par pas de 5, pour le menu déroulant de saisie.
export const CM_OPTIONS = Array.from({ length: 61 }, (_, i) => i * 5);
