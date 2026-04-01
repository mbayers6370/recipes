import { normalizeGroceryName } from "@/lib/grocery-normalization";
import { normalizeIngredientUnit } from "@/lib/ingredient-units";

type GroceryLike = {
  name?: string | null;
  amount?: string | null;
  unit?: string | null;
  isChecked?: boolean | null;
};

export function normalizeGroceryUnit(unit?: string | null) {
  return normalizeIngredientUnit(unit);
}

function buildSignature(item: GroceryLike) {
  const name = normalizeGroceryName(item.name);
  const unit = normalizeGroceryUnit(item.unit);
  if (!name) return null;
  return `${name}::${unit}`;
}

export function countRecipeOverlap(params: {
  recipeIngredients: GroceryLike[];
  listItems: GroceryLike[];
}) {
  const activeSignatures = new Set(
    params.listItems
      .filter((item) => !item.isChecked)
      .map((item) => buildSignature(item))
      .filter((value): value is string => Boolean(value))
  );

  const recipeSignatures = Array.from(
    new Set(
      params.recipeIngredients
        .map((item) => buildSignature(item))
        .filter((value): value is string => Boolean(value))
    )
  );

  const overlapCount = recipeSignatures.filter((signature) => activeSignatures.has(signature)).length;
  const ingredientCount = recipeSignatures.length;
  const shouldWarn =
    ingredientCount > 0 &&
    overlapCount >= Math.max(3, Math.ceil(ingredientCount * 0.6));

  return {
    overlapCount,
    ingredientCount,
    shouldWarn,
  };
}
