/**
 * Recipe URL importer — extracts structured recipe data from web pages.
 * Supports JSON-LD (schema.org/Recipe), microdata, and open-graph fallbacks.
 */

export interface ParsedRecipe {
  title?: string;
  description?: string;
  imageUrl?: string;
  sourceUrl: string;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  servings?: number;
  cuisine?: string;
  tags?: string[];
  ingredients: { amount?: string; unit?: string; name: string }[];
  steps: { order: number; instruction: string; timerSeconds?: number }[];
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
}

class RecipeImportError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "RecipeImportError";
    this.status = status;
  }
}

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: "\"",
  apos: "'",
  lt: "<",
  gt: ">",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\"",
  ldquo: "\"",
  hellip: "...",
  ndash: "-",
  mdash: "-",
  bull: "•",
};

function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);?/gi, (entity, value: string) => {
    const normalized = value.toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }

    return HTML_ENTITY_MAP[normalized] ?? entity;
  });
}

function parseISODuration(duration?: string): number | undefined {
  if (!duration) return undefined;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  return hours * 60 + mins || undefined;
}

function parseServings(val?: string | number): number | undefined {
  if (!val) return undefined;
  const n = typeof val === "number" ? val : parseInt(String(val));
  return isNaN(n) ? undefined : n;
}

function splitSharedIngredientNames(raw: string) {
  return raw
    .split(/,|(?:\s+and\s+)/i)
    .map((part) => normalizeImportedText(part) || part)
    .map((part) => part.replace(/^each\s+/i, "").trim())
    .filter(Boolean);
}

const INGREDIENT_UNIT_PATTERN =
  "(cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|clove|cloves|slice|slices|piece|pieces|pinch|dash|handful|can|cans|package|packages|bunch|head|sprig|sprigs)";

function cleanIngredientName(name: string) {
  return name
    .replace(/^of\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIngredient(raw: string): Array<{
  amount?: string;
  unit?: string;
  name: string;
}> {
  const sharedEachMatch = raw
    .trim()
    .match(
      new RegExp(
        `^(?:up\\s+to\\s+|to\\s+)?([\\d\\s\\u00BC-\\u00BE\\u2150-\\u215E\\/]+)?\\s*${INGREDIENT_UNIT_PATTERN}s?\\s+each\\s+(.+)$`,
        "i"
      )
    );

  if (sharedEachMatch) {
    const amount = sharedEachMatch[1]?.trim();
    const unit = sharedEachMatch[2]?.trim();
    const names = splitSharedIngredientNames(sharedEachMatch[3]);

    if (names.length > 0) {
      return names.map((name) => ({
        amount,
        unit,
        name: cleanIngredientName(name),
      }));
    }
  }

  const packagedMatch = raw
    .trim()
    .match(
      new RegExp(
        `^(?:up\\s+to\\s+|to\\s+)?([\\d\\s\\u00BC-\\u00BE\\u2150-\\u215E\\/]+)\\s+([\\d\\s\\u00BC-\\u00BE\\u2150-\\u215E\\/.-]+\\s*(?:oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters))?\\s*(can|cans|package|packages|bunch|bunches|head|heads|sprig|sprigs|clove|cloves|stick|sticks)\\s+(.+)$`,
        "i"
      )
    );

  if (packagedMatch) {
    const packageSize = packagedMatch[2]?.trim();
    const packageType = packagedMatch[3]?.trim();
    return [
      {
        amount: packagedMatch[1]?.trim(),
        unit: [packageSize, packageType].filter(Boolean).join(" ").trim() || packageType,
        name: cleanIngredientName(packagedMatch[4]?.trim() || raw.trim()),
      },
    ];
  }

  // Try to extract leading number + unit
  const match = raw
    .trim()
    .match(
      new RegExp(
        `^(?:up\\s+to\\s+|to\\s+)?([\\d\\s\\u00BC-\\u00BE\\u2150-\\u215E\\/]+)?\\s*${INGREDIENT_UNIT_PATTERN}s?\\s+(.+)$`,
        "i"
      )
    );

  if (match) {
    return [
      {
        amount: match[1]?.trim(),
        unit: match[2]?.trim(),
        name: cleanIngredientName(match[3]?.trim() || raw.trim()),
      },
    ];
  }

  const numMatch = raw.trim().match(/^([\d\s\u00BC-\u00BE\u2150-\u215E\/]+)\s+(.+)/);
  if (numMatch) {
    return [{ amount: numMatch[1].trim(), name: cleanIngredientName(numMatch[2].trim()) }];
  }

  return [{ name: cleanIngredientName(raw.trim()) }];
}

const SECTION_HEADER_PATTERNS = {
  ingredients: /^(ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|shopping list)$/i,
  steps: /^(instructions?|directions?|method|steps?|how to make|prep|preparation)$/i,
};

const STEP_START_PATTERNS = /^(mix|stir|whisk|bake|cook|add|combine|heat|preheat|place|pour|serve|season|chop|slice|saute|sauté|boil|simmer|roast|refrigerate|freeze|blend|shake|marinate|toast|broil)\b/i;

const SOCIAL_UI_PATTERNS = [
  /^write a comment/i,
  /^view( all)? replies/i,
  /^reply$/i,
  /^send message$/i,
  /^message$/i,
  /^search$/i,
  /^follow$/i,
  /^following$/i,
  /^liked by/i,
  /^\d+\s*(comments?|shares?)$/i,
  /^(photo|video)$/i,
];

const FOOD_TITLE_HINTS = [
  "pudding",
  "cake",
  "cookies",
  "cookie",
  "pasta",
  "salad",
  "soup",
  "bread",
  "pizza",
  "chicken",
  "beef",
  "pork",
  "tofu",
  "oats",
  "granola",
  "smoothie",
  "muffin",
  "rice",
  "chia",
  "recipe",
];

const SOCIAL_NOISE_PATTERNS = [
  /^#\w+/i,
  /^@\w+/i,
  /follow (me|for more)/i,
  /like (and|&)? ?save/i,
  /save (this|for later)/i,
  /comment/i,
  /share/i,
  /link in bio/i,
  /full recipe/i,
  /recipe (below|in caption|linked)/i,
  /subscribe/i,
  /dm me/i,
  /tag (me|someone)/i,
  /watch until the end/i,
  /part \d+/i,
  /^\d+[kmb]? views?$/i,
  /^\d+[kmb]? likes?$/i,
  ...SOCIAL_UI_PATTERNS,
];

function normalizeTextLine(line: string) {
  return decodeHtmlEntities(line)
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportedText(text?: string | null) {
  if (!text) return undefined;

  return normalizeTextLine(
    decodeHtmlEntities(text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function normalizeImportedList(items?: string[] | null) {
  if (!items) return [];

  return items
    .map((item) => normalizeImportedText(item))
    .filter((item): item is string => Boolean(item));
}

function isSectionHeader(line: string, kind: keyof typeof SECTION_HEADER_PATTERNS) {
  return SECTION_HEADER_PATTERNS[kind].test(line.replace(/:$/, "").trim());
}

function looksLikeIngredient(line: string) {
  const cleaned = line.replace(/^[-*•]\s*/, "").trim();

  return /^((\d+([./]\d+)?|\d+\s+\d\/\d|[¼½¾⅓⅔⅛⅜⅝⅞])\s+)?(cup|cups|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|pounds?|g|grams?|kg|ml|l|liters?|clove|cloves|slice|slices|piece|pieces|pinch|dash|handful|can|cans|package|packages|bunch|head|sprig|sprigs)\b/i.test(cleaned)
    || /^[-*•]\s+/.test(line)
    || /^(\d+([./]\d+)?|\d+\s+\d\/\d|[¼½¾⅓⅔⅛⅜⅝⅞])\s+\w+/.test(cleaned);
}

function looksLikeStep(line: string) {
  const cleaned = line.trim();

  return /^(\d+[\.\)]\s*|[-*•]\s*)/.test(cleaned)
    || STEP_START_PATTERNS.test(cleaned);
}

function isLikelySocialNoise(line: string) {
  const cleaned = line.trim();
  if (!cleaned || cleaned.length < 2) return true;
  return SOCIAL_NOISE_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function cleanScreenshotLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeTextLine)
    .filter(Boolean)
    .filter((line) => !isLikelySocialNoise(line));
}

function pickTitle(lines: string[], titleOverride?: string) {
  if (titleOverride?.trim()) return titleOverride.trim();

  const candidate = lines.find((line, index) => {
    if (index > 7) return false;
    if (isSectionHeader(line, "ingredients") || isSectionHeader(line, "steps")) return false;
    if (looksLikeIngredient(line) || looksLikeStep(line)) return false;
    if (looksLikeSocialAuthor(line) || isLikelySocialNoise(line)) return false;
    if (line.length > 80) return false;
    return /[a-z]/i.test(line);
  });

  return candidate || "Untitled Recipe";
}

function looksLikeSocialAuthor(line: string) {
  const cleaned = line.replace(/^AE\s+/i, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length < 2 || words.length > 4) return false;
  if (FOOD_TITLE_HINTS.some((hint) => cleaned.toLowerCase().includes(hint))) return false;

  return words.every((word) => /^[A-Z][a-z]+(?:['’-][A-Z]?[a-z]+)?$/.test(word));
}

function cleanIngredientLine(line: string) {
  return line
    .replace(/^[-*•]\s*/, "")
    .replace(/\s+(then\s+)?cook\b.*$/i, "")
    .replace(/\s+(mix|stir|whisk|combine|refrigerate|freeze)\b.*$/i, "")
    .trim();
}

function cleanStepLine(line: string) {
  return line
    .replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "")
    .trim();
}

function splitIngredientAndStep(line: string) {
  const cleaned = line.trim();
  const match = cleaned.match(
    /^(.*?\b(?:milk|yogurt|yoghurt|vanilla|cinnamon|syrup|salt|chia|granola|oats|oil|tahini|seeds?|almonds?|pecans?|coconut|cashews?|berries|flour|sugar|butter|eggs?|cheese|cream|water))\s+(mix|stir|whisk|combine|cook|refrigerate)\b(.*)$/i
  );

  if (!match) return null;

  const ingredient = cleanIngredientLine(match[1]);
  const step = cleanStepLine(`${match[2]}${match[3]}`);

  if (!ingredient || !step) return null;

  return { ingredient, step };
}

function parseSectionlessRecipe(lines: string[], startIndex: number) {
  const ingredientLines: string[] = [];
  const stepLines: string[] = [];
  let hasStartedSteps = false;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line || isLikelySocialNoise(line) || looksLikeSocialAuthor(line)) {
      continue;
    }

    const merged = splitIngredientAndStep(line);
    if (merged) {
      ingredientLines.push(merged.ingredient);
      stepLines.push(merged.step);
      hasStartedSteps = true;
      continue;
    }

    if (!hasStartedSteps && looksLikeStep(line)) {
      stepLines.push(cleanStepLine(line));
      hasStartedSteps = true;
      continue;
    }

    if (hasStartedSteps) {
      stepLines.push(cleanStepLine(line));
      continue;
    }

    const cleanedIngredient = cleanIngredientLine(line);
    if (cleanedIngredient) {
      ingredientLines.push(cleanedIngredient);
    }
  }

  return { ingredientLines, stepLines };
}

function collectSection(lines: string[], startIndex: number, matcher: (line: string) => boolean) {
  const collected: string[] = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSectionHeader(line, "ingredients") || isSectionHeader(line, "steps")) continue;

    if (collected.length > 0 && !matcher(line) && !looksLikeIngredient(line) && !looksLikeStep(line)) {
      break;
    }

    if (matcher(line)) {
      collected.push(line);
    }
  }

  return collected;
}

function extractFromJsonLd(html: string): Partial<ParsedRecipe> | null {
  const scriptMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const match of scriptMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const candidates = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"]
        ? parsed["@graph"]
        : [parsed];

      const recipe = candidates.find(
        (item: { "@type"?: string | string[] }) =>
          item["@type"] === "Recipe" ||
          (Array.isArray(item["@type"]) && item["@type"].includes("Recipe"))
      );

      if (!recipe) continue;

      const ingredients = (recipe.recipeIngredient || []).flatMap(
        (raw: string) => splitIngredient(normalizeImportedText(raw) || raw)
      );

      const steps = (
        recipe.recipeInstructions || []
      ).map((step: { "@type"?: string; text?: string } | string, i: number) => ({
        order: i,
        instruction:
          normalizeImportedText(typeof step === "string" ? step : step.text || String(step))
          || (typeof step === "string" ? step : step.text || String(step)),
      }));

      const nutrition = recipe.nutrition
        ? {
            calories: recipe.nutrition.calories
              ? parseInt(recipe.nutrition.calories)
              : undefined,
            protein: recipe.nutrition.proteinContent
              ? parseFloat(recipe.nutrition.proteinContent)
              : undefined,
            carbs: recipe.nutrition.carbohydrateContent
              ? parseFloat(recipe.nutrition.carbohydrateContent)
              : undefined,
            fat: recipe.nutrition.fatContent
              ? parseFloat(recipe.nutrition.fatContent)
              : undefined,
            fiber: recipe.nutrition.fiberContent
              ? parseFloat(recipe.nutrition.fiberContent)
              : undefined,
          }
        : undefined;

      const imageVal = recipe.image;
      const imageUrl =
        typeof imageVal === "string"
          ? imageVal
          : Array.isArray(imageVal)
          ? imageVal[0]
          : imageVal?.url;

      return {
        title: normalizeImportedText(recipe.name),
        description: normalizeImportedText(recipe.description),
        imageUrl,
        prepTime: parseISODuration(recipe.prepTime),
        cookTime: parseISODuration(recipe.cookTime),
        totalTime: parseISODuration(recipe.totalTime),
        servings: parseServings(recipe.recipeYield),
        cuisine: Array.isArray(recipe.recipeCuisine)
          ? normalizeImportedText(recipe.recipeCuisine[0])
          : normalizeImportedText(recipe.recipeCuisine),
        tags: recipe.keywords
          ? typeof recipe.keywords === "string"
            ? normalizeImportedList(recipe.keywords.split(","))
            : normalizeImportedList(recipe.keywords)
          : [],
        ingredients,
        steps,
        nutrition,
      };
    } catch {
      continue;
    }
  }

  return null;
}

function extractOgImage(html: string): string | undefined {
  const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  return match?.[1];
}

function extractTitle(html: string): string | undefined {
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (ogTitle) return normalizeImportedText(ogTitle[1]);
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return normalizeImportedText(title?.[1]);
}

function extractHeadingTitle(html: string): string | undefined {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return normalizeImportedText(h1?.[1]);
}

function extractReadableTextFromHtml(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|aside|main|h1|h2|h3|h4|h5|h6|li|ul|ol|blockquote|figure|figcaption)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00a0/g, " ")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const headersList: HeadersInit[] = [
    {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    {
      Accept: "text/html,application/xhtml+xml",
    },
  ];

  let lastError: unknown;
  let response: Response | null = null;

  for (const headers of headersList) {
    try {
      response = await fetch(url, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    const message =
      lastError instanceof Error && /(abort|timeout)/i.test(lastError.name + lastError.message)
        ? "That site took too long to respond. Please try again or paste the recipe text instead."
        : "Could not reach that URL. Please check it and try again.";
    throw new RecipeImportError(message);
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new RecipeImportError(
        "That site blocked the import request. Try copy-paste or image OCR instead."
      );
    }

    if (response.status >= 500) {
      throw new RecipeImportError(
        "That site is having trouble right now. Please try again in a moment."
      );
    }

    throw new RecipeImportError("Could not read that recipe URL. Please double-check the link.");
  }

  const html = await response.text();

  // Try JSON-LD first (most reliable)
  const jsonLd = extractFromJsonLd(html);
  if (jsonLd && jsonLd.ingredients && jsonLd.ingredients.length > 0) {
    return {
      ...jsonLd,
      sourceUrl: url,
      ingredients: jsonLd.ingredients || [],
      steps: jsonLd.steps || [],
      imageUrl: jsonLd.imageUrl || extractOgImage(html),
      title: jsonLd.title || extractTitle(html) || "Imported Recipe",
    };
  }

  const textParsed = parseRecipeFromText(
    extractReadableTextFromHtml(html),
    extractHeadingTitle(html) || extractTitle(html)
  );

  if (textParsed.ingredients.length > 0 && textParsed.steps.length > 0) {
    return {
      ...textParsed,
      sourceUrl: url,
      imageUrl: extractOgImage(html),
    };
  }

  throw new RecipeImportError(
    "We could read the page, but couldn't reliably extract the recipe. Please paste the recipe text instead."
  );
}

export { RecipeImportError };

export function parseRecipeFromText(text: string, titleOverride?: string): ParsedRecipe {
  const lines = cleanScreenshotLines(text);
  const ingredientsHeader = lines.findIndex((line) => isSectionHeader(line, "ingredients"));
  const stepsHeader = lines.findIndex((line) => isSectionHeader(line, "steps"));
  const title = pickTitle(lines, titleOverride);
  const titleLineIndex = titleOverride?.trim() ? -1 : lines.indexOf(title);
  const introStart = titleLineIndex >= 0 ? titleLineIndex + 1 : 0;
  const descriptionEnd = [ingredientsHeader, stepsHeader]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const description =
    descriptionEnd && descriptionEnd > introStart
      ? lines.slice(introStart, descriptionEnd).join(" ")
      : undefined;

  const sectionless = parseSectionlessRecipe(lines, introStart);

  const ingredientLines =
    ingredientsHeader >= 0
      ? lines.slice(ingredientsHeader + 1, stepsHeader >= 0 ? stepsHeader : undefined)
      : sectionless.ingredientLines.length > 0
        ? sectionless.ingredientLines
        : collectSection(lines.slice(introStart), 0, looksLikeIngredient);

  const stepLines =
    stepsHeader >= 0
      ? lines.slice(stepsHeader + 1)
      : sectionless.stepLines.length > 0
        ? sectionless.stepLines
        : ingredientsHeader >= 0
          ? collectSection(lines.slice(ingredientsHeader + 1), 0, looksLikeStep)
          : collectSection(lines.slice(introStart), 0, looksLikeStep);

  const ingredients = ingredientLines
    .map(cleanIngredientLine)
    .filter(Boolean)
    .flatMap((line) => splitIngredient(line));

  const steps = stepLines
    .map(cleanStepLine)
    .filter(Boolean)
    .map((instruction, index) => ({
      order: index,
      instruction,
    }));

  const fallbackSteps = lines
    .filter((line) => looksLikeStep(line))
    .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, ""))
    .filter(Boolean)
    .map((instruction, index) => ({
      order: index,
      instruction,
    }));

  return {
    title,
    description,
    sourceUrl: "",
    ingredients,
    steps: steps.length > 0 ? steps : fallbackSteps,
  };
}
