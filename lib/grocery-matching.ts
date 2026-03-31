import { normalizeGroceryName } from "@/lib/grocery-normalization";

type GroceryLike = {
  name?: string | null;
  amount?: string | null;
  unit?: string | null;
  isChecked?: boolean | null;
};

export function normalizeGroceryUnit(unit?: string | null) {
  const cleaned = (unit || "").trim().toLowerCase().replace(/\./g, "");
  if (!cleaned) return "";

  const aliases: Record<string, string> = {
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tbsps: "tbsp",
    tbsp: "tbsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    tsps: "tsp",
    tsp: "tsp",
    ounce: "oz",
    ounces: "oz",
    oz: "oz",
    pound: "lb",
    pounds: "lb",
    lb: "lb",
    lbs: "lb",
    gram: "g",
    grams: "g",
    g: "g",
    kilogram: "kg",
    kilograms: "kg",
    kg: "kg",
    liter: "l",
    liters: "l",
    litre: "l",
    litres: "l",
    l: "l",
    milliliter: "ml",
    milliliters: "ml",
    millilitre: "ml",
    millilitres: "ml",
    ml: "ml",
    clove: "clove",
    cloves: "clove",
    can: "can",
    cans: "can",
    package: "package",
    packages: "package",
    pkg: "package",
    pkgs: "package",
    stick: "stick",
    sticks: "stick",
  };

  return aliases[cleaned] || cleaned;
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
