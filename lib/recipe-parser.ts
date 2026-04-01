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

function sanitizeUrl(value?: string | null, baseUrl?: string): string | undefined {
  if (!value) return undefined;

  const normalized = normalizeImportedText(value)?.trim();
  if (!normalized) return undefined;

  const withProtocol = normalized.startsWith("//") ? `https:${normalized}` : normalized;

  try {
    const parsed = baseUrl ? new URL(withProtocol, baseUrl) : new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function extractImageUrl(value: unknown, baseUrl?: string): string | undefined {
  if (!value) return undefined;

  if (typeof value === "string") {
    return sanitizeUrl(value, baseUrl);
  }

  if (Array.isArray(value)) {
    for (const candidate of value) {
      const url = extractImageUrl(candidate, baseUrl);
      if (url) return url;
    }
    return undefined;
  }

  if (typeof value === "object") {
    const imageObject = value as {
      url?: unknown;
      contentUrl?: unknown;
      src?: unknown;
      thumbnailUrl?: unknown;
    };

    return (
      extractImageUrl(imageObject.url, baseUrl)
      || extractImageUrl(imageObject.contentUrl, baseUrl)
      || extractImageUrl(imageObject.src, baseUrl)
      || extractImageUrl(imageObject.thumbnailUrl, baseUrl)
    );
  }

  return undefined;
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
    || /^(\d+([./]\d+)?|\d+\s+\d\/\d|[¼½¾⅓⅔⅛⅜⅝⅞])\s+\([^)]{1,40}\)\s+\w+/i.test(cleaned)
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

function extractFromJsonLd(html: string, baseUrl?: string): Partial<ParsedRecipe> | null {
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

      return {
        title: normalizeImportedText(recipe.name),
        description: normalizeImportedText(recipe.description),
        imageUrl: extractImageUrl(recipe.image, baseUrl),
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

function extractMetaContent(html: string, key: "og:image" | "twitter:image" | "twitter:image:src") {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const nameOrProperty = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
    if (nameOrProperty !== key) continue;

    const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1]?.trim();
    if (content) return content;
  }

  return undefined;
}

function extractOgImage(html: string): string | undefined {
  return (
    extractMetaContent(html, "og:image")
    || extractMetaContent(html, "twitter:image")
    || extractMetaContent(html, "twitter:image:src")
  );
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

const PRIMARY_FETCH_HEADERS: HeadersInit[] = [
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

function buildMirrorUrls(url: string) {
  const stripped = url.replace(/^https?:\/\//i, "");
  return Array.from(
    new Set([
      `https://r.jina.ai/http://${stripped}`,
      `https://r.jina.ai/http://${url}`,
      `https://r.jina.ai/http://https://${stripped}`,
      `https://r.jina.ai/http://http://${stripped}`,
    ])
  );
}

async function fetchRecipePage(url: string) {
  let lastError: unknown;
  let blockedResponse: Response | null = null;

  for (const headers of PRIMARY_FETCH_HEADERS) {
    try {
      const response = await fetch(url, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        return {
          response,
          body: await response.text(),
          sourceUrl: sanitizeUrl(response.url || url) || url,
          isMirror: false,
        };
      }

      if (response.status === 401 || response.status === 403) {
        blockedResponse = response;
        continue;
      }

      if (response.status >= 500) {
        throw new RecipeImportError(
          "That site is having trouble right now. Please try again in a moment."
        );
      }

      throw new RecipeImportError("Could not read that recipe URL. Please double-check the link.");
    } catch (error) {
      lastError = error;
    }
  }

  try {
    for (const mirrorUrl of buildMirrorUrls(url)) {
      const mirrorResponse = await fetch(mirrorUrl, {
        headers: { Accept: "text/plain, text/markdown, text/html;q=0.9, */*;q=0.8" },
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });

      if (mirrorResponse.ok) {
        return {
          response: mirrorResponse,
          body: await mirrorResponse.text(),
          sourceUrl: url,
          isMirror: true,
        };
      }
    }
  } catch (error) {
    lastError = error;
  }

  if (blockedResponse) {
    throw new RecipeImportError(
      "That recipe site blocked our direct fetch, and the fallback reader also failed."
    );
  }

  const message =
    lastError instanceof Error && /(abort|timeout)/i.test(lastError.name + lastError.message)
      ? "That site took too long to respond. Please try again or paste the recipe text instead."
      : "Could not reach that URL. Please check it and try again.";
  throw new RecipeImportError(message);
}

function extractImageFromMirrorText(text: string, baseUrl: string) {
  const linkedImageMatch = text.match(/\[[^\]]*]\((https?:\/\/[^)\s]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^)\s]*)?)\)/i);
  if (linkedImageMatch) {
    return sanitizeUrl(linkedImageMatch[1], baseUrl);
  }

  const markdownMatch = text.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) {
    return sanitizeUrl(markdownMatch[1], baseUrl);
  }

  const bareUrlMatch = text.match(/https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?\S*)?/i);
  if (bareUrlMatch) {
    return sanitizeUrl(bareUrlMatch[0], baseUrl);
  }

  return undefined;
}

function normalizeMirrorMarkdown(text: string) {
  const withoutFrontMatter = text.includes("Markdown Content:")
    ? text.slice(text.indexOf("Markdown Content:") + "Markdown Content:".length)
    : text;

  return withoutFrontMatter
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+\|\s+/g, "\n")
    .replace(/\s+\*\s+/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMirrorBoilerplateLine(line: string) {
  return /^(url source:|markdown content:)/i.test(line)
    || /search please fill out this field/i.test(line)
    || /(newsletters|sweepstakes|my saves|view all|follow us|about us|account settings|get help|log in|log out|get the magazine)/i.test(line)
    || /(dinners|meals|ingredients|occasions|cuisines|kitchen tips|news|features)\s+(dinners|meals|ingredients|occasions|cuisines|kitchen tips|news|features)/i.test(line)
    || /^submitted by\b/i.test(line)
    || /^updated on\b/i.test(line)
    || /^photo by\b/i.test(line)
    || /^(save|rate|print|share|close|add photo|keep screen awake|i made it)$/i.test(line)
    || /^oops! something went wrong/i.test(line)
    || /^this recipe was developed at its original yield/i.test(line);
}

function isRecipeMetadataLine(line: string) {
  return /^\d+\s+(reviews?|photos?)$/i.test(line)
    || /^\d+\s+(mins?|minutes?|hours?)$/i.test(line)
    || /^\d+(\.\d+)?\s*$/.test(line)
    || /^\d+\s+servings?$/i.test(line)
    || /^(prep time|cook time|additional time|total time|servings?|yield|jump to nutrition facts):?$/i.test(line)
    || /^updated on\b/i.test(line)
    || /^submitted by\b/i.test(line);
}

function isCategoryCrumbLine(line: string) {
  const cleaned = line.trim();

  return /^\d+-ingredient\s+[a-z]/i.test(cleaned)
    || /^\d+-minute\s+[a-z]/i.test(cleaned)
    || /^(breakfast|brunch|lunch|dinner|dinners|snack|snacks|dessert|desserts|meals|ingredients|occasions|cuisines|kitchen tips|news|features|appetizers|soups|salads|bread|drinks)\b/i.test(cleaned)
    || /(recipes?|dinners?|meals?|lunch|breakfast|brunch|soups?|salads?|bread|drinks|desserts?)$/i.test(cleaned) && cleaned.split(/\s+/).length <= 4;
}

function isImageCaptionNoise(line: string) {
  const cleaned = line.trim();

  return /^image:\s*/i.test(cleaned)
    || /^photo by\b/i.test(cleaned)
    || /^allrecipes\s*\/\s*/i.test(cleaned)
    || /(?:^|[\s_-])\d{4,}(?:[\s._-]|$)/.test(cleaned)
    || /(?:^|[\s_-])(?:jpg|jpeg|png|webp|avif|gif)(?:$|[\s._-])/i.test(cleaned)
    || /s3\.amazonaws\.com|dotdashmeredith|meredithcorp|mmartini|thmb/i.test(cleaned)
    || /format\(webp\)|strip_icc|quality\(|bytes?_to/i.test(cleaned)
    || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s*\/\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(cleaned);
}

function parseRecipeFromMirrorMarkdown(text: string, sourceUrl: string): ParsedRecipe | null {
  const markdown = normalizeMirrorMarkdown(text);
  const lines = markdown
    .split("\n")
    .map((line) => normalizeImportedText(line) || line.trim())
    .filter(Boolean);

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line) || /^title:\s*/i.test(line));
  const ingredientsIndex = lines.findIndex((line) => /^(##\s+)?ingredients(?:\s*\(\d+\))?\b/i.test(line));
  const stepsIndex = lines.findIndex((line) => /^(##\s+)?(directions|instructions|method|steps)(?:\s*\(\d+\))?\b/i.test(line));

  if (titleIndex < 0 || ingredientsIndex < 0 || stepsIndex < 0 || stepsIndex <= ingredientsIndex) {
    return null;
  }

  const title = normalizeImportedText(lines[titleIndex].replace(/^#\s+/, "").replace(/^title:\s*/i, ""));
  const descriptionLines = lines
    .slice(titleIndex + 1, ingredientsIndex)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => !/^(prep time:|cook time:|total time:|servings:|yield:|jump to)/i.test(line))
    .filter((line) => !isMirrorBoilerplateLine(line))
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => line.length > 30);

  const ingredientLines = lines
    .slice(ingredientsIndex + 1, stepsIndex)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter((line) => !isMirrorBoilerplateLine(line))
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => !isCategoryCrumbLine(line))
    .filter((line) => !isImageCaptionNoise(line))
    .filter((line) => !/^(1\/2x|1x|2x|3x)$/i.test(line))
    .filter((line) => /^[-*•]\s+/.test(line) || looksLikeIngredient(line) || /^(?:\d+([./]\d+)?|\d+\s+\d\/\d|[¼½¾⅓⅔⅛⅜⅝⅞])\b/.test(line))
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean);

  const nextHeaderIndex = lines.findIndex((line, index) => index > stepsIndex && /^(##\s+)?[A-Z][A-Za-z ]+(?:\(\d+\))?$/.test(line));
  const stepSectionEnd = nextHeaderIndex > stepsIndex ? nextHeaderIndex : lines.length;
  const stepLines = lines
    .slice(stepsIndex + 1, stepSectionEnd)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(recipe tips|nutrition facts|photos of|review|i made it)\b/i.test(line))
    .filter((line) => !isMirrorBoilerplateLine(line))
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => !isImageCaptionNoise(line))
    .filter((line) => looksLikeStep(line) || line.length > 20);

  const ingredients = ingredientLines.flatMap((line) => splitIngredient(line));
  const steps = stepLines.map((instruction, index) => ({ order: index, instruction }));

  if (!title || ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  return {
    title,
    description: descriptionLines.join(" ") || undefined,
    sourceUrl,
    ingredients,
    steps,
  };
}

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  const { body, sourceUrl: resolvedSourceUrl, isMirror } = await fetchRecipePage(url);

  if (isMirror) {
    const mirrorParsed = parseRecipeFromMirrorMarkdown(body, resolvedSourceUrl) || parseRecipeFromText(body);

    if (mirrorParsed.ingredients.length > 0 && mirrorParsed.steps.length > 0) {
      return {
        ...mirrorParsed,
        sourceUrl: resolvedSourceUrl,
        imageUrl: extractImageFromMirrorText(body, resolvedSourceUrl),
      };
    }

    throw new RecipeImportError(
      "We reached the recipe through a fallback reader, but still couldn't reliably extract it."
    );
  }

  const html = body;

  // Try JSON-LD first (most reliable)
  const jsonLd = extractFromJsonLd(html, resolvedSourceUrl);
  if (jsonLd && jsonLd.ingredients && jsonLd.ingredients.length > 0) {
    return {
      ...jsonLd,
      sourceUrl: resolvedSourceUrl,
      ingredients: jsonLd.ingredients || [],
      steps: jsonLd.steps || [],
      imageUrl: jsonLd.imageUrl || sanitizeUrl(extractOgImage(html), resolvedSourceUrl),
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
      sourceUrl: resolvedSourceUrl,
      imageUrl: sanitizeUrl(extractOgImage(html), resolvedSourceUrl),
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
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => !isCategoryCrumbLine(line))
    .flatMap((line) => splitIngredient(line));

  const steps = stepLines
    .map(cleanStepLine)
    .filter(Boolean)
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => !isImageCaptionNoise(line))
    .map((instruction, index) => ({
      order: index,
      instruction,
    }));

  const fallbackSteps = lines
    .filter((line) => looksLikeStep(line))
    .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, ""))
    .filter(Boolean)
    .filter((line) => !isRecipeMetadataLine(line))
    .filter((line) => !isImageCaptionNoise(line))
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
