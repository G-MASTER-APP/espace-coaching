"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { macrosForQuantity, type MealKey, type SavedFood } from "@/lib/nutrition";

type SearchResult = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

type Tab = "search" | "saved" | "create-food" | "create-recipe";

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Rechercher" },
  { key: "saved", label: "Mes aliments" },
  { key: "create-food", label: "Créer un aliment" },
  { key: "create-recipe", label: "Créer une recette" },
];

export function AddFoodPanel({
  clientId,
  meal,
  today,
  savedFoods,
  onClose,
  onSaved,
}: {
  clientId: string;
  meal: MealKey;
  today: string;
  savedFoods: SavedFood[];
  onClose: () => void;
  onSaved: (food: SavedFood) => void;
}) {
  const [tab, setTab] = useState<Tab>("search");

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Ajouter un aliment</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex gap-3 overflow-x-auto border-b border-border px-4 pt-2 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "shrink-0 border-b-2 px-1 pb-2 font-medium",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "search" && <SearchTab clientId={clientId} meal={meal} today={today} onDone={onClose} />}
          {tab === "saved" && (
            <SavedTab clientId={clientId} meal={meal} today={today} savedFoods={savedFoods} onDone={onClose} />
          )}
          {tab === "create-food" && (
            <CreateFoodTab clientId={clientId} meal={meal} today={today} onDone={onClose} onSaved={onSaved} />
          )}
          {tab === "create-recipe" && (
            <CreateRecipeTab clientId={clientId} meal={meal} today={today} onDone={onClose} onSaved={onSaved} />
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        min="0"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function SearchTab({
  clientId,
  meal,
  today,
  onDone,
}: {
  clientId: string;
  meal: MealKey;
  today: string;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebouncedCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: SearchResult[]; error?: string };
      setResults(data.results ?? []);
      if (data.error) setError(data.error);
    } catch {
      setError("Recherche indisponible pour le moment.");
    } finally {
      setLoading(false);
    }
  }, 400);

  function onQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    debouncedSearch(value);
  }

  async function addEntry() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("food_log_entries").insert({
      user_id: clientId,
      log_date: today,
      meal,
      name: selected.name,
      quantity_g: quantity,
      calories: macrosForQuantity(selected.caloriesPer100g, quantity),
      protein_g: macrosForQuantity(selected.proteinPer100g, quantity),
      carbs_g: macrosForQuantity(selected.carbsPer100g, quantity),
      fat_g: macrosForQuantity(selected.fatPer100g, quantity),
    });
    setSaving(false);
    onDone();
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{selected.name}</p>
          {selected.brand && <p className="text-xs text-muted-foreground">{selected.brand}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Quantité (g)</label>
          <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 0)} />
        </div>
        <p className="text-xs text-muted-foreground">
          {macrosForQuantity(selected.caloriesPer100g, quantity)} kcal ·{" "}
          {macrosForQuantity(selected.proteinPer100g, quantity)}g prot. ·{" "}
          {macrosForQuantity(selected.carbsPer100g, quantity)}g gluc. ·{" "}
          {macrosForQuantity(selected.fatPer100g, quantity)}g lip.
        </p>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={addEntry} disabled={saving}>
            {saving ? "Ajout..." : "Ajouter"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Rechercher un aliment (ex: poulet, riz...)"
        autoFocus
      />
      {loading && <p className="text-xs text-muted-foreground">Recherche...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-1.5">
        {results.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="flex flex-col items-start rounded-lg border border-border px-3 py-2 text-left hover:bg-secondary/60"
          >
            <span className="text-sm font-medium text-foreground">{r.name}</span>
            <span className="text-xs text-muted-foreground">
              {r.brand ? `${r.brand} · ` : ""}
              {r.caloriesPer100g} kcal / 100g
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SavedTab({
  clientId,
  meal,
  today,
  savedFoods,
  onDone,
}: {
  clientId: string;
  meal: MealKey;
  today: string;
  savedFoods: SavedFood[];
  onDone: () => void;
}) {
  const supabase = createClient();
  const [selected, setSelected] = useState<SavedFood | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [saving, setSaving] = useState(false);

  async function addEntry() {
    if (!selected) return;
    setSaving(true);
    await supabase.from("food_log_entries").insert({
      user_id: clientId,
      log_date: today,
      meal,
      name: selected.name,
      quantity_g: quantity,
      calories: macrosForQuantity(selected.calories_per_100g, quantity),
      protein_g: macrosForQuantity(selected.protein_per_100g, quantity),
      carbs_g: macrosForQuantity(selected.carbs_per_100g, quantity),
      fat_g: macrosForQuantity(selected.fat_per_100g, quantity),
      food_id: selected.id,
    });
    setSaving(false);
    onDone();
  }

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-foreground">{selected.name}</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Quantité (g)</label>
          <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 0)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={addEntry} disabled={saving}>
            {saving ? "Ajout..." : "Ajouter"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
            Retour
          </Button>
        </div>
      </div>
    );
  }

  if (savedFoods.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun aliment enregistré pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {savedFoods.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setSelected(f)}
          className="flex flex-col items-start rounded-lg border border-border px-3 py-2 text-left hover:bg-secondary/60"
        >
          <span className="text-sm font-medium text-foreground">
            {f.name} {f.is_recipe && <span className="text-xs text-accent">(recette)</span>}
          </span>
          <span className="text-xs text-muted-foreground">{f.calories_per_100g} kcal / 100g</span>
        </button>
      ))}
    </div>
  );
}

function CreateFoodTab({
  clientId,
  meal,
  today,
  onDone,
  onSaved,
}: {
  clientId: string;
  meal: MealKey;
  today: string;
  onDone: () => void;
  onSaved: (f: SavedFood) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [created, setCreated] = useState<SavedFood | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [saving, setSaving] = useState(false);

  async function createFood() {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("foods")
      .insert({
        user_id: clientId,
        name: name.trim(),
        calories_per_100g: calories,
        protein_per_100g: protein,
        carbs_per_100g: carbs,
        fat_per_100g: fat,
      })
      .select("id, name, is_recipe, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .single();
    setSaving(false);
    if (!error && data) {
      onSaved(data);
      setCreated(data);
    }
  }

  async function logEntry() {
    if (!created) return;
    setSaving(true);
    await supabase.from("food_log_entries").insert({
      user_id: clientId,
      log_date: today,
      meal,
      name: created.name,
      quantity_g: quantity,
      calories: macrosForQuantity(created.calories_per_100g, quantity),
      protein_g: macrosForQuantity(created.protein_per_100g, quantity),
      carbs_g: macrosForQuantity(created.carbs_per_100g, quantity),
      fat_g: macrosForQuantity(created.fat_per_100g, quantity),
      food_id: created.id,
    });
    setSaving(false);
    onDone();
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">{created.name}</span> enregistré dans tes aliments.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Quantité à ajouter aujourd&apos;hui (g)</label>
          <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 0)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={logEntry} disabled={saving}>
            {saving ? "Ajout..." : "Ajouter au journal"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Plus tard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Nom</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Barre protéinée maison" />
      </div>
      <p className="text-xs text-muted-foreground">Valeurs pour 100g :</p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Calories (kcal)" value={calories} onChange={setCalories} />
        <NumberField label="Protéines (g)" value={protein} onChange={setProtein} />
        <NumberField label="Glucides (g)" value={carbs} onChange={setCarbs} />
        <NumberField label="Lipides (g)" value={fat} onChange={setFat} />
      </div>
      <Button type="button" size="sm" onClick={createFood} disabled={saving || !name.trim()}>
        {saving ? "Enregistrement..." : "Enregistrer l'aliment"}
      </Button>
    </div>
  );
}

type IngredientDraft = {
  name: string;
  quantity_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

const EMPTY_INGREDIENT: IngredientDraft = {
  name: "",
  quantity_g: 100,
  calories_per_100g: 0,
  protein_per_100g: 0,
  carbs_per_100g: 0,
  fat_per_100g: 0,
};

function CreateRecipeTab({
  clientId,
  meal,
  today,
  onDone,
  onSaved,
}: {
  clientId: string;
  meal: MealKey;
  today: string;
  onDone: () => void;
  onSaved: (f: SavedFood) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ ...EMPTY_INGREDIENT }]);
  const [created, setCreated] = useState<SavedFood | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [saving, setSaving] = useState(false);

  const totalGrams = ingredients.reduce((sum, i) => sum + (i.quantity_g || 0), 0);
  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + macrosForQuantity(i.calories_per_100g, i.quantity_g),
      protein: acc.protein + macrosForQuantity(i.protein_per_100g, i.quantity_g),
      carbs: acc.carbs + macrosForQuantity(i.carbs_per_100g, i.quantity_g),
      fat: acc.fat + macrosForQuantity(i.fat_per_100g, i.quantity_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
  const per100g =
    totalGrams > 0
      ? {
          calories: Math.round((totals.calories / totalGrams) * 100),
          protein: Math.round((totals.protein / totalGrams) * 100 * 10) / 10,
          carbs: Math.round((totals.carbs / totalGrams) * 100 * 10) / 10,
          fat: Math.round((totals.fat / totalGrams) * 100 * 10) / 10,
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  function updateIngredient(index: number, patch: Partial<IngredientDraft>) {
    setIngredients((current) => current.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)));
  }

  async function createRecipe() {
    if (!name.trim() || totalGrams <= 0) return;
    setSaving(true);
    const { data: food, error } = await supabase
      .from("foods")
      .insert({
        user_id: clientId,
        name: name.trim(),
        is_recipe: true,
        calories_per_100g: per100g.calories,
        protein_per_100g: per100g.protein,
        carbs_per_100g: per100g.carbs,
        fat_per_100g: per100g.fat,
      })
      .select("id, name, is_recipe, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
      .single();

    if (!error && food) {
      const validIngredients = ingredients.filter((i) => i.name.trim() && i.quantity_g > 0);
      if (validIngredients.length > 0) {
        await supabase.from("food_ingredients").insert(
          validIngredients.map((i) => ({
            recipe_id: food.id,
            name: i.name.trim(),
            quantity_g: i.quantity_g,
            calories_per_100g: i.calories_per_100g,
            protein_per_100g: i.protein_per_100g,
            carbs_per_100g: i.carbs_per_100g,
            fat_per_100g: i.fat_per_100g,
          }))
        );
      }
      onSaved(food);
      setCreated(food);
    }
    setSaving(false);
  }

  async function logEntry() {
    if (!created) return;
    setSaving(true);
    await supabase.from("food_log_entries").insert({
      user_id: clientId,
      log_date: today,
      meal,
      name: created.name,
      quantity_g: quantity,
      calories: macrosForQuantity(created.calories_per_100g, quantity),
      protein_g: macrosForQuantity(created.protein_per_100g, quantity),
      carbs_g: macrosForQuantity(created.carbs_per_100g, quantity),
      fat_g: macrosForQuantity(created.fat_per_100g, quantity),
      food_id: created.id,
    });
    setSaving(false);
    onDone();
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">{created.name}</span> enregistrée dans tes recettes.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Quantité à ajouter aujourd&apos;hui (g)</label>
          <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 0)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={logEntry} disabled={saving}>
            {saving ? "Ajout..." : "Ajouter au journal"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            Plus tard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Nom de la recette</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bowl poulet-riz" />
      </div>

      <div className="flex flex-col gap-3">
        {ingredients.map((ing, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Input
              value={ing.name}
              onChange={(e) => updateIngredient(index, { name: e.target.value })}
              placeholder="Ingrédient (ex: Poulet)"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Quantité (g)"
                value={ing.quantity_g}
                onChange={(v) => updateIngredient(index, { quantity_g: v })}
              />
              <NumberField
                label="Kcal/100g"
                value={ing.calories_per_100g}
                onChange={(v) => updateIngredient(index, { calories_per_100g: v })}
              />
              <NumberField
                label="Prot./100g"
                value={ing.protein_per_100g}
                onChange={(v) => updateIngredient(index, { protein_per_100g: v })}
              />
              <NumberField
                label="Gluc./100g"
                value={ing.carbs_per_100g}
                onChange={(v) => updateIngredient(index, { carbs_per_100g: v })}
              />
              <NumberField
                label="Lip./100g"
                value={ing.fat_per_100g}
                onChange={(v) => updateIngredient(index, { fat_per_100g: v })}
              />
            </div>
            {ingredients.length > 1 && (
              <button
                type="button"
                onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))}
                className="self-start text-xs text-muted-foreground hover:text-destructive"
              >
                Retirer
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setIngredients((current) => [...current, { ...EMPTY_INGREDIENT }])}
          className="rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          + Ajouter un ingrédient
        </button>
      </div>

      {totalGrams > 0 && (
        <p className="text-xs text-muted-foreground">
          Total : {Math.round(totals.calories)} kcal pour {totalGrams}g — soit {per100g.calories} kcal/100g
        </p>
      )}

      <Button
        type="button"
        size="sm"
        onClick={createRecipe}
        disabled={saving || !name.trim() || totalGrams <= 0}
      >
        {saving ? "Enregistrement..." : "Enregistrer la recette"}
      </Button>
    </div>
  );
}
