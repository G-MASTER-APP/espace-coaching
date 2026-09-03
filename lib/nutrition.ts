export const MEALS = [
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "lunch", label: "Déjeuner" },
  { key: "dinner", label: "Dîner" },
  { key: "snack", label: "Collations" },
] as const;

export type MealKey = (typeof MEALS)[number]["key"];

export type FoodLogEntry = {
  id: string;
  meal: MealKey;
  name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type SavedFood = {
  id: string;
  name: string;
  is_recipe: boolean;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

export function macrosForQuantity(per100g: number, grams: number): number {
  return Math.round(((per100g * grams) / 100) * 10) / 10;
}
