export const VIDEO_CATEGORIES = [
  { key: "recovery", label: "Récupération", icon: "🧊" },
  { key: "nutrition", label: "Nutrition", icon: "🥗" },
  { key: "supplements", label: "Compléments", icon: "💊" },
  { key: "other", label: "Autre", icon: "🎬" },
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number]["key"];
