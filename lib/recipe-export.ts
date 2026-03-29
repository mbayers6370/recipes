import type { Recipe } from "@/types";

type ExportableIngredient = {
  amount?: string | null;
  unit?: string | null;
  name?: string | null;
  notes?: string | null;
};

type ExportableStep = {
  instruction?: string | null;
  timerSeconds?: number | null;
};

type ExportableRecipe = Pick<
  Recipe,
  | "title"
  | "description"
  | "servings"
  | "prepTime"
  | "cookTime"
  | "totalTime"
  | "cuisine"
  | "notes"
  | "sourceUrl"
> & {
  ingredients?: unknown;
  steps?: unknown;
};

export function exportRecipeAsMarkdown(recipe: ExportableRecipe) {
  const lines: string[] = [`# ${recipe.title}`, ""];

  if (recipe.description) {
    lines.push(recipe.description, "");
  }

  const meta = [
    recipe.servings ? `Serves ${recipe.servings}` : null,
    recipe.prepTime ? `Prep ${recipe.prepTime} min` : null,
    recipe.cookTime ? `Cook ${recipe.cookTime} min` : null,
    recipe.totalTime ? `Total ${recipe.totalTime} min` : null,
    recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : null,
  ].filter(Boolean);

  if (meta.length > 0) {
    lines.push(meta.join(" | "), "");
  }

  const ingredients = normalizeIngredients(recipe.ingredients);
  const steps = normalizeSteps(recipe.steps);

  if (ingredients.length) {
    lines.push("## Ingredients", "");
    for (const ingredient of ingredients) {
      const content = [ingredient.amount, ingredient.unit, ingredient.name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const notes = ingredient.notes ? ` (${ingredient.notes})` : "";
      lines.push(`- ${content}${notes}`);
    }
    lines.push("");
  }

  if (steps.length) {
    lines.push("## Steps", "");
    for (const [index, step] of steps.entries()) {
      const timer = step.timerSeconds ? ` [Timer: ${formatTimer(step.timerSeconds)}]` : "";
      lines.push(`${index + 1}. ${step.instruction || ""}${timer}`);
    }
    lines.push("");
  }

  if (recipe.notes) {
    lines.push("## Notes", "", recipe.notes, "");
  }

  if (recipe.sourceUrl) {
    lines.push(`Source: ${recipe.sourceUrl}`, "");
  }

  return lines.join("\n").trim();
}

export function exportRecipesAsJson(recipes: unknown[]) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: recipes.length,
      recipes,
    },
    null,
    2
  );
}

export function recipeExportFilename(title: string, extension: "md" | "json") {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "recipe";

  return `${safe}.${extension}`;
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function normalizeIngredients(value: unknown): ExportableIngredient[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExportableIngredient => typeof item === "object" && item !== null);
}

function normalizeSteps(value: unknown): ExportableStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ExportableStep => typeof item === "object" && item !== null);
}
