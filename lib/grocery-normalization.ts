function cleanIngredientText(value?: string | null) {
  let text = (value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[*]+/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .trim();

  while (/\([^()]*\)/.test(text)) {
    text = text.replace(/\([^()]*\)/g, " ");
  }

  return text
    .replace(/[,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GROCERY_ALIAS_RULES: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(scallions?|spring onions?|green onions?)\b/i, canonical: "scallions" },
  { pattern: /\b(gruy[eè]re(?: cheese)?)\b/i, canonical: "gruyere cheese" },
  { pattern: /\b(ears? of corn|ears? corn|corn on the cob|ear corn|cobs? of corn)\b/i, canonical: "ear of corn" },
  { pattern: /\b(corn kernels?)\b/i, canonical: "corn" },
  { pattern: /\b(butter beans?)\b/i, canonical: "butter beans" },
  { pattern: /\b(black beans?)\b/i, canonical: "black beans" },
  { pattern: /\b(chickpeas?|garbanzo beans?)\b/i, canonical: "chickpeas" },
  { pattern: /\b(cannellini beans?)\b/i, canonical: "cannellini beans" },
  { pattern: /\b(vegetable stock|vegetable broth)\b/i, canonical: "vegetable broth" },
  { pattern: /\b(chicken stock|chicken broth)\b/i, canonical: "chicken broth" },
  { pattern: /\b(beef stock|beef broth)\b/i, canonical: "beef broth" },
  { pattern: /\b(heavy cream|double cream)\b/i, canonical: "heavy cream" },
  { pattern: /\b(confectioners sugar|powdered sugar|icing sugar)\b/i, canonical: "powdered sugar" },
];

const TRAILING_PREP_PATTERNS = [
  /,\s*(chopped|diced|minced|sliced|cubed|melted|softened|room temperature|at room temperature|divided|drained|rinsed|peeled|crushed|for serving|for garnish|plus more.*|to taste)\b.*$/i,
  /\s+-\s*(chopped|diced|minced|sliced|cubed|melted|softened|room temperature|at room temperature|divided|drained|rinsed|peeled|crushed|for serving|for garnish|plus more.*|to taste)\b.*$/i,
];

const LEADING_PREP_PATTERNS = [
  /^(?:finely\s+|roughly\s+|thinly\s+|coarsely\s+)?(chopped|diced|minced|sliced|cubed|peeled|crushed)\s+/i,
  /^fresh\s+/i,
];

const LEADING_PACKAGING_PATTERNS = [
  /^\d+\s*-\s*(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l)\s+/i,
  /^\d+(?:\.\d+)?\s*(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l)\s+/i,
  /^\d+(?:\s+\d+\/\d+|\/\d+)?\s+/i,
  /^(small|medium|large|extra-large|small-medium|medium-large)\s+/i,
  /^(cans?|packages?|pkgs?|pkg|jars?|bottles?|bags?|bunches?|heads?|ears?|cobs?)\s+/i,
  /^\d+\s*(cans?|packages?|pkgs?|pkg|jars?|bottles?|bags?|bunches?|heads?|ears?|cobs?)\s+/i,
  /^\d+\s*-\s*(oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l)\s*(cans?|packages?|pkgs?|pkg|jars?|bottles?|bags?)\s+/i,
];

const INLINE_NOISE_PATTERNS = [
  /\baka\b.*$/i,
  /\bapprox(?:imately)?\b.*$/i,
];

const LEADING_MEASUREMENT_PHRASES = [
  /^(?:up\s+)?to\s+\d+(?:\s+\d+\/\d+|\/\d+|(?:\.\d+)?)?\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|pints?)\b\s+/i,
  /^\d+(?:\s+\d+\/\d+|\/\d+|(?:\.\d+)?)?\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|pints?)\b\s+/i,
];

function stripPrepDescriptors(value: string) {
  let next = value;

  let changed = true;
  while (changed) {
    changed = false;

    for (const pattern of LEADING_PREP_PATTERNS) {
      const updated = next.replace(pattern, "");
      if (updated !== next) {
        next = updated;
        changed = true;
      }
    }
  }

  for (const pattern of TRAILING_PREP_PATTERNS) {
    next = next.replace(pattern, " ");
  }

  for (const pattern of INLINE_NOISE_PATTERNS) {
    next = next.replace(pattern, " ");
  }

  return next
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCandidateName(value: string) {
  let candidate = stripPrepDescriptors(value);

  for (const pattern of LEADING_PACKAGING_PATTERNS) {
    candidate = candidate.replace(pattern, "");
  }

  for (const pattern of LEADING_MEASUREMENT_PHRASES) {
    candidate = candidate.replace(pattern, "");
  }

  candidate = candidate
    .replace(/\bof\b/gi, " of ")
    .replace(/\b(cans?|packages?|pkgs?|pkg|jars?|bottles?|bags?)\b/gi, " ")
    .replace(/\b(small|medium|large|extra-large|small-medium|medium-large)\b/gi, " ")
    .replace(/\b(?:from|about|around|roughly|approximately|approx)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const slashParts = candidate.split("/").map((part) => part.trim()).filter(Boolean);
  return slashParts[0] || candidate;
}

function singularizeWord(word: string) {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes") && word.length > 4) return `${word.slice(0, -2)}`;
  if (word.endsWith("ses") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function normalizeTokens(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => singularizeWord(token))
    .join(" ");
}

export function normalizeGroceryName(rawName?: string | null) {
  const cleaned = cleanIngredientText(rawName);
  const candidate = extractCandidateName(cleaned);

  for (const rule of GROCERY_ALIAS_RULES) {
    if (rule.pattern.test(cleaned) || rule.pattern.test(candidate)) {
      return rule.canonical;
    }
  }

  return normalizeTokens(candidate);
}
