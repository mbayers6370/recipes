export type IngredientUnitOption = {
  value: string;
  label: string;
  aliases: string[];
};

export const INGREDIENT_UNIT_OPTIONS: IngredientUnitOption[] = [
  { value: "tsp", label: "tsp", aliases: ["teaspoon", "teaspoons", "tsps", "tsp."] },
  { value: "tbsp", label: "tbsp", aliases: ["tablespoon", "tablespoons", "tbsps", "tbsp.", "tbs"] },
  { value: "cup", label: "cup", aliases: ["cups"] },
  { value: "fl oz", label: "fl oz", aliases: ["fluid ounce", "fluid ounces", "fl. oz.", "floz"] },
  { value: "pt", label: "pt", aliases: ["pint", "pints", "pts"] },
  { value: "qt", label: "qt", aliases: ["quart", "quarts", "qts"] },
  { value: "gal", label: "gal", aliases: ["gallon", "gallons"] },
  { value: "ml", label: "ml", aliases: ["milliliter", "milliliters", "millilitre", "millilitres"] },
  { value: "l", label: "l", aliases: ["liter", "liters", "litre", "litres"] },
  { value: "oz", label: "oz", aliases: ["ounce", "ounces"] },
  { value: "lb", label: "lb", aliases: ["lbs", "pound", "pounds"] },
  { value: "g", label: "g", aliases: ["gram", "grams"] },
  { value: "kg", label: "kg", aliases: ["kilogram", "kilograms"] },
  { value: "clove", label: "clove", aliases: ["cloves"] },
  { value: "can", label: "can", aliases: ["cans"] },
  { value: "jar", label: "jar", aliases: ["jars"] },
  { value: "bottle", label: "bottle", aliases: ["bottles"] },
  { value: "package", label: "package", aliases: ["packages", "pkg", "pkgs"] },
  { value: "bag", label: "bag", aliases: ["bags"] },
  { value: "box", label: "box", aliases: ["boxes"] },
  { value: "stick", label: "stick", aliases: ["sticks"] },
  { value: "slice", label: "slice", aliases: ["slices"] },
  { value: "piece", label: "piece", aliases: ["pieces"] },
  { value: "bunch", label: "bunch", aliases: ["bunches"] },
  { value: "head", label: "head", aliases: ["heads"] },
  { value: "sprig", label: "sprig", aliases: ["sprigs"] },
  { value: "pinch", label: "pinch", aliases: ["pinches"] },
  { value: "dash", label: "dash", aliases: ["dashes"] },
  { value: "handful", label: "handful", aliases: ["handfuls"] },
  { value: "to taste", label: "to taste", aliases: [] },
];

const UNIT_ALIAS_MAP = new Map<string, string>();

for (const option of INGREDIENT_UNIT_OPTIONS) {
  UNIT_ALIAS_MAP.set(option.value, option.value);
  UNIT_ALIAS_MAP.set(option.label.toLowerCase(), option.value);

  for (const alias of option.aliases) {
    UNIT_ALIAS_MAP.set(alias.toLowerCase(), option.value);
  }
}

function cleanUnit(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

export function normalizeIngredientUnit(unit?: string | null) {
  const cleaned = cleanUnit(unit);
  if (!cleaned) return "";
  return UNIT_ALIAS_MAP.get(cleaned) || cleaned;
}

export function searchIngredientUnits(query?: string | null) {
  const cleaned = cleanUnit(query);
  if (!cleaned) return INGREDIENT_UNIT_OPTIONS;

  return INGREDIENT_UNIT_OPTIONS.filter((option) => {
    const haystack = [option.value, option.label, ...option.aliases].map((entry) => cleanUnit(entry));
    return haystack.some((entry) => entry.startsWith(cleaned) || entry.includes(cleaned));
  });
}
