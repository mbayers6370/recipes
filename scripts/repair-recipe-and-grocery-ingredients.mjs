import pg from "pg";
import { normalizeGroceryName } from "../lib/grocery-normalization.ts";
import { splitIngredient } from "../lib/recipe-parser.ts";

process.loadEnvFile?.(".env");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const { Client } = pg;
const client = new Client({ connectionString });

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function isMeasurementOnlyText(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return true;

  return /^(?:up\s+to\s+|to\s+)?[\d\s./¼½¾⅓⅔⅛⅜⅝⅞-]+\s*(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|can|cans|package|packages|bunch|bunches|head|heads|sprig|sprigs|clove|cloves|stick|sticks)$/i.test(
    text
  ) || /^(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|can|cans|package|packages|bunch|bunches|head|heads|sprig|sprigs|clove|cloves|stick|sticks)$/i.test(text);
}

function isMeaningfulIngredientName(name) {
  const cleaned = cleanText(name);
  return Boolean(cleaned) && !isMeasurementOnlyText(cleaned);
}

function normalizeRecipeIngredients(ingredients) {
  return (ingredients || [])
    .flatMap((ingredient) => {
      const raw = [cleanText(ingredient.amount), cleanText(ingredient.unit), cleanText(ingredient.name)]
        .filter(Boolean)
        .join(" ");

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
            id: crypto.randomUUID(),
            amount,
            unit,
            name,
            notes: cleanText(ingredient.notes) || undefined,
          };
        })
        .filter((parsed) => isMeaningfulIngredientName(parsed.name));
    });
}

function inferRecipeUnitsForGroceries(ingredients) {
  const map = new Map();

  for (const ingredient of normalizeRecipeIngredients(ingredients)) {
    const amount = cleanText(ingredient.amount);
    const unit = cleanText(ingredient.unit);
    const name = normalizeGroceryName(ingredient.name);

    if (!name || !amount || !unit) continue;

    const key = `${name}::${amount}`;
    const set = map.get(key) ?? new Set();
    set.add(unit);
    map.set(key, set);
  }

  return map;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function repairRecipes() {
  const { rows } = await client.query("select id, ingredients from recipes");
  const normalizedRecipes = [];
  let updated = 0;

  for (const row of rows) {
    const original = Array.isArray(row.ingredients) ? row.ingredients : [];
    const normalized = normalizeRecipeIngredients(original);
    normalizedRecipes.push({ id: row.id, ingredients: normalized });

    if (sameJson(original, normalized)) continue;

    await client.query("update recipes set ingredients = $1::jsonb where id = $2", [
      JSON.stringify(normalized),
      row.id,
    ]);
    updated += 1;
  }

  return { updated, normalizedRecipes };
}

function buildUnitMap(normalizedRecipes) {
  const combined = new Map();

  for (const recipe of normalizedRecipes) {
    const recipeMap = inferRecipeUnitsForGroceries(recipe.ingredients);

    for (const [key, units] of recipeMap.entries()) {
      const set = combined.get(key) ?? new Set();
      for (const unit of units) set.add(unit);
      combined.set(key, set);
    }
  }

  return combined;
}

async function repairGroceries(unitMap) {
  const { rows } = await client.query("select id, name, amount, unit from grocery_items");
  let updated = 0;
  let deleted = 0;

  for (const row of rows) {
    const raw = [cleanText(row.amount), cleanText(row.unit), cleanText(row.name)]
      .filter(Boolean)
      .join(" ");

    const parsed = splitIngredient(raw)[0] || {};
    let nextAmount = cleanText(parsed.amount) || cleanText(row.amount);
    let nextUnit = cleanText(parsed.unit) || cleanText(row.unit);
    let nextName = cleanText(parsed.name) || cleanText(row.name);

    if (!isMeaningfulIngredientName(nextName)) {
      await client.query("delete from grocery_items where id = $1", [row.id]);
      deleted += 1;
      continue;
    }

    const normalizedName = normalizeGroceryName(nextName) || nextName;
    const candidateUnits = unitMap.get(`${normalizedName}::${nextAmount}`);

    if (!nextUnit && candidateUnits && candidateUnits.size === 1) {
      nextUnit = Array.from(candidateUnits)[0];
    }

    if (
      nextName === cleanText(row.name) &&
      nextAmount === cleanText(row.amount) &&
      nextUnit === cleanText(row.unit)
    ) {
      continue;
    }

    await client.query(
      "update grocery_items set name = $1, amount = $2, unit = $3 where id = $4",
      [normalizedName, nextAmount || null, nextUnit || null, row.id]
    );
    updated += 1;
  }

  return { updated, deleted };
}

async function main() {
  await client.connect();

  const recipeResult = await repairRecipes();
  const unitMap = buildUnitMap(recipeResult.normalizedRecipes);
  const groceryResult = await repairGroceries(unitMap);

  console.log(
    `Repaired ${recipeResult.updated} recipes, updated ${groceryResult.updated} grocery items, deleted ${groceryResult.deleted} invalid grocery items.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
