import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Proxy serveur vers Open Food Facts. Un User-Agent explicite est requis par
 * leur politique d'usage — les requêtes anonymes sans UA correct sont
 * fréquemment limitées ("Page temporarily unavailable"). On retente une
 * fois en cas d'échec transitoire (l'API a des pics de charge).
 */
const OFF_USER_AGENT = "GMasterCoaching/1.0 (+https://g-master.fr)";

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
};

type FoodResult = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

async function fetchOnce(query: string) {
  const url = new URL("https://world.openfoodfacts.org/api/v2/search");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("fields", "code,product_name,brands,nutriments");

  return fetch(url, {
    headers: { "User-Agent": OFF_USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Base d'aliments courants intégrée à l'app : toujours disponible (pas
  // d'appel réseau externe), et prioritaire sur Open Food Facts dans les
  // résultats — ce dernier reste utile pour les produits de marque
  // spécifiques mais est connu pour être parfois indisponible (voir
  // fetchOnce ci-dessous), donc son échec ne doit jamais faire échouer
  // toute la recherche.
  const supabase = await createClient();
  const { data: commonMatches } = await supabase
    .from("common_foods")
    .select("id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(15);

  const localResults: FoodResult[] = (commonMatches ?? []).map((f) => ({
    id: `common-${f.id}`,
    name: f.name,
    brand: null,
    caloriesPer100g: Math.round(f.calories_per_100g),
    proteinPer100g: Math.round(f.protein_per_100g * 10) / 10,
    carbsPer100g: Math.round(f.carbs_per_100g * 10) / 10,
    fatPer100g: Math.round(f.fat_per_100g * 10) / 10,
  }));

  let offResults: FoodResult[] = [];
  let offError: string | null = null;
  try {
    let response = await fetchOnce(query);
    if (!response.ok) {
      response = await fetchOnce(query);
    }
    if (response.ok) {
      const data = (await response.json()) as { products?: OffProduct[] };
      offResults = (data.products ?? [])
        .filter((p) => p.product_name && typeof p.nutriments?.["energy-kcal_100g"] === "number")
        .map((p, index) => ({
          id: `off-${index}-${p.product_name}`,
          name: p.product_name as string,
          brand: p.brands?.split(",")[0]?.trim() || null,
          caloriesPer100g: Math.round(p.nutriments!["energy-kcal_100g"] ?? 0),
          proteinPer100g: Math.round((p.nutriments!["proteins_100g"] ?? 0) * 10) / 10,
          carbsPer100g: Math.round((p.nutriments!["carbohydrates_100g"] ?? 0) * 10) / 10,
          fatPer100g: Math.round((p.nutriments!["fat_100g"] ?? 0) * 10) / 10,
        }));
    } else {
      offError = "Recherche Open Food Facts indisponible pour le moment.";
    }
  } catch {
    offError = "Recherche Open Food Facts indisponible pour le moment.";
  }

  const results = [...localResults, ...offResults].slice(0, 30);
  // On ne remonte l'erreur OFF que si elle laisse la recherche vide —
  // sinon les résultats locaux suffisent, pas besoin d'inquiéter l'utilisateur.
  return NextResponse.json({ results, error: results.length === 0 ? offError : undefined });
}
