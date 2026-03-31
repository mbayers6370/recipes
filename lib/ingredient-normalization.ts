import { normalizeGroceryName } from "./grocery-normalization";
import { splitIngredient } from "./recipe-parser";
import type { Ingredient } from "../types";

function cleanText(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isMeasurementOnlyText(value?: string | null) {
  const text = cleanText(value).toLowerCase();
  if (!text) return true;

  return /^(?:up\s+to\s+|to\s+)?[\d\s./¼½¾⅓⅔⅛⅜⅝⅞-]+\s*(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|can|cans|package|packages|bunch|bunches|head|heads|sprig|sprigs|clove|cloves|stick|sticks)$/i.test(
    text
  ) || /^(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|can|cans|package|packages|bunch|bunches|head|heads|sprig|sprigs|clove|cloves|stick|sticks)$/i.test(text);
}

function combineIngredientText(ingredient: Pick<Ingredient, "amount" | "unit" | "name">) {
  return [cleanText(ingredient.amount), cleanText(ingredient.unit), cleanText(ingredient.name)]
    .filter(Boolean)
    .join(" ");
}

function normalizeStructuredIngredient(ingredient: Ingredient): Ingredient[] {
  const raw = combineIngredientText(ingredient);
  if (!raw) return [];

  return splitIngredient(raw)
    .map((parsed) => {
      let amount = cleanText(parsed.amount) || undefined;
      let unit = cleanText(parsed.unit) || undefined;
      let name = cleanText(parsed.name).replace(/\*+$/g, "").trim();

      if (!unit && /^(?:up\s+to\s+|to\s+)?[\d\s./¼½¾⅓⅔⅛⅜⅝⅞-]+\s+/i.test(name)) {
        const nested = splitIngredient(name)[0];
        const nestedName = cleanText(nested?.name);
        const nestedUnit = cleanText(nested?.unit);

        if (nestedName && nestedUnit && isMeaningfulIngredientName(nestedName)) {
          unit = nestedUnit;
          name = nestedName.replace(/\*+$/g, "").trim();
          amount = amount || cleanText(nested?.amount) || undefined;
        }
      }

      return {
        amount,
        unit,
        name,
        notes: cleanText(ingredient.notes) || undefined,
      };
    })
    .filter((parsed) => parsed.name && !isMeasurementOnlyText(parsed.name));
}

export function normalizeRecipeIngredients(ingredients?: Ingredient[] | null) {
  return (ingredients || [])
    .flatMap((ingredient) => normalizeStructuredIngredient(ingredient));
}

export function inferRecipeUnitsForGroceries(ingredients?: Ingredient[] | null) {
  const map = new Map<string, Set<string>>();

  for (const ingredient of normalizeRecipeIngredients(ingredients)) {
    const amount = cleanText(ingredient.amount);
    const unit = cleanText(ingredient.unit);
    const name = normalizeGroceryName(ingredient.name);

    if (!name || !amount || !unit) continue;

    const key = `${name}::${amount}`;
    const set = map.get(key) ?? new Set<string>();
    set.add(unit);
    map.set(key, set);
  }

  return map;
}

export function isMeaningfulIngredientName(name?: string | null) {
  const cleaned = cleanText(name);
  return Boolean(cleaned) && !isMeasurementOnlyText(cleaned);
}
