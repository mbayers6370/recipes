import { normalizeGroceryName } from "./grocery-normalization";

export const GROCERY_SECTION_ORDER = [
  "produce",
  "dairy-eggs",
  "meat-seafood",
  "bakery",
  "cans-jarred",
  "frozen",
  "spices",
  "pantry",
  "other",
] as const;

export type GrocerySectionId = (typeof GROCERY_SECTION_ORDER)[number];

export const GROCERY_SECTION_LABELS: Record<GrocerySectionId, string> = {
  produce: "Produce",
  "dairy-eggs": "Dairy & Eggs",
  "meat-seafood": "Meat & Seafood",
  bakery: "Bakery",
  "cans-jarred": "Cans & Jarred",
  frozen: "Frozen",
  spices: "Spices",
  pantry: "Pantry",
  other: "Other",
};

const EXPLICIT_KEYWORDS: Record<GrocerySectionId, string[]> = {
  produce: [
    "apple", "arugula", "asparagus", "avocado", "banana", "basil", "bean sprouts", "beet",
    "bell pepper", "berries", "blackberries", "blueberries", "bok choy", "broccoli", "cabbage",
    "carrot", "cauliflower", "celery", "chives", "cilantro", "corn", "cucumber", "dill",
    "eggplant", "garlic", "ginger", "grape", "green beans", "green onion", "herbs", "jalapeno",
    "jalapeno pepper", "kale", "leek", "lemon", "lettuce", "lime", "mango", "microgreens",
    "mint", "mushroom", "onion", "orange", "parsley", "peach", "pear", "pepper", "pineapple",
    "plum", "potato", "radish", "radishes", "raspberries", "romaine", "salad greens",
    "sage", "scallion", "shallot", "spinach", "spring mix", "squash", "strawberries",
    "sweet potato", "thyme", "tomato", "tomatoes", "zucchini", "clementine", "mandarin",
    "grapefruit", "kiwi", "pomegranate", "watermelon", "cantaloupe", "honeydew", "papaya",
    "lime zest", "lemon zest", "brussels sprouts", "snap peas", "snow peas", "peas",
    "green cabbage", "red cabbage", "napa cabbage", "fennel", "turnip", "parsnip", "yam",
    "rutabaga", "collard greens", "swiss chard", "coriander leaves", "serrano", "poblano",
    "habanero", "chili pepper", "chile pepper", "cauliflower rice", "slaw mix",
  ],
  "dairy-eggs": [
    "asiago", "blue cheese", "brie", "burrata", "butter", "buttermilk", "cheddar", "cheese",
    "colby", "cottage cheese", "cream", "cream cheese", "creme fraiche", "egg", "eggs",
    "feta", "fontina", "goat cheese", "gouda", "gruyere", "gruyère", "half and half",
    "havarti", "heavy cream", "mascarpone", "milk", "mozzarella", "parmesan", "pecorino",
    "provolone", "ricotta", "sour cream", "swiss", "yogurt", "yoghurt", "whipping cream",
    "evaporated milk", "condensed milk", "monterey jack", "pepper jack", "jack cheese",
    "string cheese", "halloumi", "paneer", "kefir",
  ],
  "meat-seafood": [
    "anchovy", "bacon", "beef", "brisket", "chicken", "cod", "crab", "duck", "fish",
    "ground beef", "ground chicken", "ground pork", "ground turkey", "ham", "lamb", "lobster",
    "pancetta", "pork", "prosciutto", "salami", "salmon", "sausage", "shrimp", "steak",
    "tilapia", "trout", "tuna", "turkey", "pepperoni", "chorizo", "meatballs", "rotisserie chicken",
    "deli turkey", "deli ham", "deli chicken", "ground lamb", "scallops", "mussels", "clams",
    "halibut", "mahi mahi", "catfish",
  ],
  bakery: [
    "bagel", "baguette", "bread", "brioche", "bun", "croissant", "english muffin", "flatbread",
    "hamburger bun", "hot dog bun", "muffin", "naan", "pita", "roll", "sourdough", "tortilla",
    "wrap", "pizza dough", "pie crust", "puff pastry", "cinnamon rolls", "ciabatta", "focaccia",
  ],
  "cans-jarred": [
    "artichoke hearts", "beans", "black beans", "broth", "butter beans", "capers", "chickpeas", "coconut milk",
    "canned corn", "crushed tomatoes", "jarred sauce", "marinara", "olives", "pasta sauce",
    "pickles", "pumpkin puree", "roasted red peppers", "salsa", "stock", "sun-dried tomatoes",
    "enchilada sauce", "chipotle in adobo", "curry paste", "tomato puree",
    "tomato paste", "tomato sauce", "tuna can", "green chiles", "diced tomatoes", "white beans",
    "kidney beans", "pinto beans", "corned beef", "spam", "jarred jalapenos", "pizza sauce",
    "apple sauce", "applesauce",
  ],
  frozen: [
    "frozen", "frozen berries", "frozen corn", "frozen peas", "ice cream", "frozen spinach",
    "frozen broccoli", "frozen cauliflower", "hash browns", "waffles", "frozen pizza",
    "tater tots", "edamame",
  ],
  spices: [
    "allspice", "baking powder", "baking soda", "bay leaf", "bay leaves", "black pepper",
    "cajun seasoning", "cayenne", "chili powder", "cinnamon", "cloves", "cumin", "curry powder",
    "garlic powder", "italian seasoning", "nutmeg", "onion powder", "oregano", "paprika",
    "peppercorn", "red pepper flakes", "rosemary", "salt", "sea salt", "seasoning", "smoked paprika",
    "turmeric", "vanilla", "vanilla extract", "garam masala", "coriander", "cardamom",
    "mustard seeds", "fenugreek", "asafoetida", "five spice", "szechuan peppercorns",
    "adobo seasoning", "old bay", "lemon pepper", "creole seasoning", "pumpkin pie spice",
    "cajun spice", "dry mustard", "mustard powder", "celery salt",
  ],
  pantry: [
    "almond", "almond butter", "ap flour", "barley", "brown sugar", "breadcrumbs", "cashew",
    "chocolate", "chocolate chips", "cocoa", "coconut flakes", "cornmeal", "cornstarch", "farro",
    "flour", "granola", "honey", "jam", "jelly", "ketchup", "lentils", "maple syrup", "mayonnaise",
    "mustard", "nut butter", "nuts", "oats", "oil", "olive oil", "pasta", "peanut butter", "pecan",
    "pesto", "quinoa", "rice", "rice vinegar", "rolled oats", "seed", "sesame oil", "soy sauce",
    "spaghetti", "sugar", "tahini", "vinegar", "walnut", "yeast", "tamari", "coconut aminos",
    "fish sauce", "oyster sauce", "hoisin", "gochujang", "gochugaru", "sambal", "sambal oelek",
    "sriracha", "mirin", "miso", "sesame paste", "rice noodles", "udon", "ramen noodles",
    "curry leaves", "basmati rice", "jasmine rice", "masa harina", "corn tortillas",
    "tortilla chips", "refried beans", "taco seasoning", "white rice", "brown rice", "orzo",
    "macaroni", "fusilli", "penne", "egg noodles", "panko", "cracker", "crackers", "marshmallows",
    "dried fruit", "raisins", "dates", "molasses", "agave", "shortening", "cooking spray",
    "broth concentrate", "bouillon", "peanut", "sunflower seeds",
  ],
  other: [],
};

const SECTION_PATTERNS: Record<GrocerySectionId, RegExp[]> = {
  produce: [
    /\b(radish|radishes|lettuce|romaine|spinach|kale|greens?|herbs?|cilantro|parsley|basil|mint|sage|thyme|dill)\b/i,
    /\b(onion|shallot|scallion|green onion|leek|garlic|ginger)\b/i,
    /\b(apple|banana|orange|lemon|lime|berry|berries|strawberr(?:y|ies)|blueberr(?:y|ies)|raspberr(?:y|ies)|grape|pear|peach|plum|mango|pineapple|clementine|mandarin|grapefruit|kiwi|papaya|melon|watermelon|cantaloupe|honeydew|pomegranate)\b/i,
    /\b(tomato|tomatoes|cucumber|pepper|jalape(?:n|ñ)o|serrano|poblano|habanero|carrot|celery|broccoli|cauliflower|cabbage|brussels sprouts|zucchini|squash|potato|sweet potato|yam|avocado|mushroom|corn|fennel|turnip|parsnip|radicchio|bok choy|snap peas|snow peas)\b/i,
  ],
  "dairy-eggs": [
    /\b(egg|eggs|milk|cream|half and half|buttermilk|yogurt|yoghurt|sour cream|creme fraiche|butter|kefir|evaporated milk|condensed milk)\b/i,
    /\b(cheese|cheddar|mozzarella|parmesan|pecorino|ricotta|feta|fontina|gouda|havarti|swiss|asiago|brie|burrata|gruyere|gruyère|goat cheese|blue cheese|cream cheese|mascarpone|provolone|jack cheese|monterey jack|pepper jack|halloumi|paneer)\b/i,
  ],
  "meat-seafood": [
    /\b(beef|steak|brisket|pork|ham|bacon|prosciutto|pancetta|sausage|salami|pepperoni|chorizo|lamb|duck|turkey|chicken|meatballs?)\b/i,
    /\b(salmon|shrimp|fish|cod|tuna|trout|tilapia|halibut|catfish|mahi mahi|crab|lobster|scallops?|mussels?|clams?|anchov(?:y|ies))\b/i,
  ],
  bakery: [
    /\b(bread|rolls?|bun|brioche|bagel|muffin|naan|pita|tortilla|wrap|baguette|croissant|flatbread|ciabatta|focaccia|pizza dough|pie crust|puff pastry)\b/i,
  ],
  "cans-jarred": [
    /\b(canned|can of|jarred|jar of)\b/i,
    /\b(beans|chickpeas|broth|stock|tomato paste|tomato sauce|crushed tomatoes|diced tomatoes|marinara|pasta sauce|pizza sauce|olives|pickles|capers|salsa|coconut milk|enchilada sauce|chipotle in adobo|curry paste|green chiles|roasted red peppers|applesauce)\b/i,
  ],
  frozen: [
    /\bfrozen\b/i,
    /\b(ice cream|hash browns|tater tots|frozen pizza|waffles|edamame)\b/i,
  ],
  spices: [
    /\b(salt|pepper|paprika|smoked paprika|cinnamon|cumin|coriander|nutmeg|oregano|rosemary|thyme|turmeric|bay leaves?|red pepper flakes|chili powder|curry powder|garlic powder|onion powder|vanilla(?: extract)?|garam masala|cardamom|fenugreek|asafoetida|five spice|szechuan peppercorns?|old bay|lemon pepper|creole seasoning|adobo seasoning|mustard powder|dry mustard|celery salt|pumpkin pie spice)\b/i,
    /\b(baking powder|baking soda|yeast|seasoning)\b/i,
  ],
  pantry: [
    /\b(flour|cornstarch|cornmeal|oats|rice|quinoa|farro|barley|pasta|spaghetti|orzo|macaroni|fusilli|penne|egg noodles|lentils)\b/i,
    /\b(sugar|brown sugar|powdered sugar|maple syrup|honey|molasses|agave|oil|olive oil|cooking spray|vinegar|soy sauce|sesame oil|mustard|mayonnaise|ketchup|jam|jelly|pesto|tahini|peanut butter|almond butter|tamari|coconut aminos|fish sauce|oyster sauce|hoisin|gochujang|gochugaru|sambal|sambal oelek|sriracha|mirin|miso|masa harina|bouillon|broth concentrate)\b/i,
    /\b(nuts?|almonds?|walnuts?|pecans?|cashews?|seeds?|sesame)\b/i,
    /\b(chocolate|cocoa|granola|breadcrumbs|panko|crackers?|marshmallows|dried fruit|raisins|dates|rice noodles|udon|ramen noodles|basmati rice|jasmine rice|corn tortillas|tortilla chips|refried beans|taco seasoning)\b/i,
  ],
  other: [],
};

function normalizeName(value?: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ");
}

function singularizeToken(token: string) {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function expandSearchTerms(value: string) {
  const normalized = normalizeName(value);
  const tokens = normalized.split(" ").filter(Boolean);
  const singularTokens = tokens.map(singularizeToken);

  return Array.from(
    new Set([
      normalized,
      ...tokens,
      ...singularTokens,
      singularTokens.join(" "),
    ].filter(Boolean))
  );
}

const SECTION_OVERRIDE_RULES: Array<{ sectionId: GrocerySectionId; patterns: RegExp[] }> = [
  {
    sectionId: "produce",
    patterns: [
      /\bfresh (basil|cilantro|dill|mint|oregano|parsley|rosemary|sage|thyme)\b/i,
      /\b(bunch|sprig|sprigs|bunches) of (basil|cilantro|dill|mint|oregano|parsley|rosemary|sage|thyme)\b/i,
      /\bfresh jalape(?:n|ñ)o(?:s)?\b/i,
    ],
  },
  {
    sectionId: "cans-jarred",
    patterns: [
      /\b(canned|jarred)\b/i,
      /\bcan of\b/i,
      /\bjar of\b/i,
      /\b(tinned|tin of)\b/i,
    ],
  },
  {
    sectionId: "frozen",
    patterns: [
      /\bfrozen\b/i,
    ],
  },
  {
    sectionId: "spices",
    patterns: [
      /\bblack pepper\b/i,
      /\bground pepper\b/i,
      /\bground black pepper\b/i,
      /\bpeppercorns?\b/i,
      /\bseasoning\b/i,
      /\bspice\b/i,
      /\bchili powder\b/i,
      /\bgarlic powder\b/i,
      /\bonion powder\b/i,
      /\bpaprika\b/i,
      /\bcumin\b/i,
      /\bcoriander\b/i,
      /\bcinnamon\b/i,
      /\bturmeric\b/i,
      /\bgaram masala\b/i,
      /\beverything bagel seasoning\b/i,
      /\b(dried|ground|whole)\s+(basil|dill|mint|oregano|parsley|rosemary|sage|thyme)\b/i,
      /\b(?:dried|ground|whole)\s+pepper\b/i,
      /\bvanilla extract\b/i,
      /\b(taco|fajita)\s+seasoning\b/i,
      /\b(old bay|lemon pepper|creole seasoning|adobo seasoning|pumpkin pie spice)\b/i,
    ],
  },
  {
    sectionId: "pantry",
    patterns: [
      /\bbouillon\b/i,
      /\bbroth concentrate\b/i,
      /\bcoconut amino(?:s)?\b/i,
      /\btamari\b/i,
    ],
  },
];

const CATEGORY_FALLBACK_TERMS: Record<GrocerySectionId, string[]> = {
  produce: [],
  "dairy-eggs": [],
  "meat-seafood": [],
  bakery: [],
  "cans-jarred": [],
  frozen: [],
  spices: [],
  pantry: ["mexican", "asian", "indian"],
  other: [],
};

export function getGrocerySection(name?: string | null, existingCategory?: string | null): GrocerySectionId {
  const categoryTerms = expandSearchTerms(existingCategory || "");
  const canonicalName = normalizeGroceryName(name);
  const nameTerms = expandSearchTerms(canonicalName);
  const haystack = [...categoryTerms, ...nameTerms];
  const fullName = normalizeName(canonicalName);

  for (const rule of SECTION_OVERRIDE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(fullName))) {
      return rule.sectionId;
    }
  }

  for (const sectionId of GROCERY_SECTION_ORDER) {
    const keywords = EXPLICIT_KEYWORDS[sectionId];
    if (
      keywords.some((keyword) => {
        const normalizedKeyword = normalizeName(keyword);
        if (haystack.includes(normalizedKeyword)) return true;

        if (!normalizedKeyword.includes(" ")) return false;

        const phrasePattern = new RegExp(
          `(^|[^\\p{L}\\p{N}])${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`,
          "iu"
        );

        return phrasePattern.test(fullName);
      })
    ) {
      return sectionId;
    }
  }

  for (const sectionId of GROCERY_SECTION_ORDER) {
    if (SECTION_PATTERNS[sectionId].some((pattern) => pattern.test(fullName))) {
      return sectionId;
    }
  }

  for (const sectionId of GROCERY_SECTION_ORDER) {
    if (CATEGORY_FALLBACK_TERMS[sectionId].some((term) => categoryTerms.includes(term))) {
      return sectionId;
    }
  }

  return "other";
}
