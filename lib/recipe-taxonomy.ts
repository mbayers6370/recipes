export const RECIPE_TYPE_OPTIONS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
] as const;

export type RecipeType = (typeof RECIPE_TYPE_OPTIONS)[number];

const TYPE_TAG_PREFIX = "type:";
const IMPORTED_TAG = "source:imported";
const RECIPE_TYPE_ALIASES: Record<string, RecipeType> = {
  breakfasts: "breakfast",
  lunches: "lunch",
  dinners: "dinner",
  snacks: "snack",
  desserts: "dessert",
};

function normalizeRecipeType(type?: string | null): RecipeType | null {
  if (!type) return null;

  const normalized = type.trim().toLowerCase();
  const canonical = RECIPE_TYPE_ALIASES[normalized] ?? normalized;

  return RECIPE_TYPE_OPTIONS.includes(canonical as RecipeType)
    ? (canonical as RecipeType)
    : null;
}

export function getRecipeTypeTag(type?: string | null) {
  const normalized = normalizeRecipeType(type);
  return normalized ? `${TYPE_TAG_PREFIX}${normalized}` : null;
}

export function getRecipeType(tags?: string[] | null): RecipeType | null {
  const typeTag = tags?.find((tag) => tag.startsWith(TYPE_TAG_PREFIX));
  if (!typeTag) return null;

  return normalizeRecipeType(typeTag.slice(TYPE_TAG_PREFIX.length));
}

export function stripRecipeTypeTags(tags?: string[] | null) {
  return (tags || []).filter((tag) => !tag.startsWith(TYPE_TAG_PREFIX));
}

export function setRecipeTypeTag(tags: string[] | null | undefined, type?: string | null) {
  const cleaned = stripRecipeTypeTags(tags);
  const typeTag = getRecipeTypeTag(type);
  return typeTag ? [typeTag, ...cleaned] : cleaned;
}

export function formatRecipeType(type?: string | null) {
  if (!type) return "";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function isImportedRecipe(tags?: string[] | null) {
  return (tags || []).includes(IMPORTED_TAG);
}

export function stripImportedRecipeTags(tags?: string[] | null) {
  return (tags || []).filter((tag) => tag !== IMPORTED_TAG);
}

export function setImportedRecipeTag(tags: string[] | null | undefined, imported = true) {
  const cleaned = stripImportedRecipeTags(tags);
  return imported ? [IMPORTED_TAG, ...cleaned] : cleaned;
}
