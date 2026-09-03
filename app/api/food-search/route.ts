import { NextResponse, type NextRequest } from "next/server";

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

  let response: Response;
  try {
    response = await fetchOnce(query);
    if (!response.ok) {
      response = await fetchOnce(query);
    }
  } catch {
    return NextResponse.json(
      { results: [], error: "Recherche indisponible pour le moment." },
      { status: 502 }
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { results: [], error: "Recherche indisponible pour le moment." },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { products?: OffProduct[] };

  const results: FoodResult[] = (data.products ?? [])
    .filter((p) => p.product_name && typeof p.nutriments?.["energy-kcal_100g"] === "number")
    .map((p, index) => ({
      id: `off-${index}-${p.product_name}`,
      name: p.product_name as string,
      brand: p.brands?.split(",")[0]?.trim() || null,
      caloriesPer100g: Math.round(p.nutriments!["energy-kcal_100g"] ?? 0),
      proteinPer100g: Math.round((p.nutriments!["proteins_100g"] ?? 0) * 10) / 10,
      carbsPer100g: Math.round((p.nutriments!["carbohydrates_100g"] ?? 0) * 10) / 10,
      fatPer100g: Math.round((p.nutriments!["fat_100g"] ?? 0) * 10) / 10,
    }))
    .slice(0, 20);

  return NextResponse.json({ results });
}
