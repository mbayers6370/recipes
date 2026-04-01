import { NextRequest } from "next/server";
import { requireUser } from "@/lib/get-user";
import { parseRecipeFromText, parseRecipeFromUrl, RecipeImportError } from "@/lib/recipe-parser";
import { importTextSchema, importUrlSchema } from "@/lib/validators";
import { ok, err, unauthorized, serverError } from "@/lib/api-response";
import { ZodError } from "zod";
import { normalizeRecipeIngredients } from "@/lib/ingredient-normalization";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const PAGE_MARKER_PATTERN = /^--\s*\d+\s+of\s+\d+\s*--$/i;
const INGREDIENT_LINE_START =
  /^((\d+([./]\d+)?|\d+\s+\d\/\d|[¼½¾⅓⅔⅛⅜⅝⅞])\s+)?(cup|cups|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|ml|l|liters?|pint|pints|clove|cloves|slice|slices|piece|pieces|pinch|dash|handful|can|cans|package|packages|bunch|head|sprig|sprigs)\b/i;
const STEP_PARAGRAPH_START =
  /^(if\b|mix\b|stir\b|whisk\b|bake\b|cook\b|add\b|combine\b|heat\b|preheat\b|place\b|pour\b|serve\b|season\b|chop\b|slice\b|saute\b|sauté\b|boil\b|simmer\b|roast\b|refrigerate\b|freeze\b|blend\b|shake\b|marinate\b|toast\b|broil\b|roughly\b)/i;

function normalizeDocumentLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => !PAGE_MARKER_PATTERN.test(line));
}

function joinWrappedIngredients(lines: string[]) {
  const merged: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    if (merged.length === 0 || INGREDIENT_LINE_START.test(line)) {
      merged.push(line);
      continue;
    }

    merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`.trim();
  }

  return merged;
}

function joinWrappedSteps(lines: string[]) {
  const merged: string[] = [];

  for (const line of lines) {
    if (!line) continue;

    const previous = merged[merged.length - 1];
    const shouldStartNewStep =
      !previous ||
      (/[.!?)]$/.test(previous) && STEP_PARAGRAPH_START.test(line));

    if (shouldStartNewStep) {
      merged.push(line);
      continue;
    }

    merged[merged.length - 1] = `${previous} ${line}`.trim();
  }

  return merged;
}

function preprocessExtractedDocumentText(text: string) {
  const lines = normalizeDocumentLines(text);
  const ingredientsHeader = lines.findIndex((line) => /^ingredients:?$/i.test(line));
  const stepsHeader = lines.findIndex((line) => /^(steps|instructions|directions|method):?$/i.test(line));
  const sourceLine = lines.find((line) => /^source:\s+/i.test(line));
  const sourceUrl = sourceLine?.match(/https?:\/\/\S+/i)?.[0] || "";

  if (ingredientsHeader < 0 || stepsHeader < 0 || stepsHeader <= ingredientsHeader) {
    return { cleanedText: lines.filter(Boolean).join("\n"), sourceUrl };
  }

  const introLines = lines.slice(0, ingredientsHeader).filter(Boolean);
  const ingredientLines = joinWrappedIngredients(
    lines.slice(ingredientsHeader + 1, stepsHeader).filter(Boolean)
  );
  const stepLines = joinWrappedSteps(
    lines
      .slice(stepsHeader + 1)
      .filter(Boolean)
      .filter((line) => !/^source:\s+/i.test(line))
  );

  const sections = [
    ...introLines,
    "INGREDIENTS",
    ...ingredientLines,
    "STEPS",
    ...stepLines,
  ];

  if (sourceUrl) {
    sections.push(`Source: ${sourceUrl}`);
  }

  return {
    cleanedText: sections.join("\n"),
    sourceUrl,
  };
}

async function extractRecipeTextFromDocument(file: File) {
  if (file.size === 0) {
    throw new RecipeImportError("That document is empty.");
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new RecipeImportError("Please upload a document smaller than 10 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (
    extension === "docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  throw new RecipeImportError("Please upload a PDF or DOCX file.");
}

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const contentType = req.headers.get("content-type") || "";

    const parsed = contentType.includes("multipart/form-data")
      ? await (async () => {
          const formData = await req.formData();
          const file = formData.get("file");
          const title = formData.get("title");

          if (!(file instanceof File)) {
            throw new RecipeImportError("Please attach a PDF or DOCX file.");
          }

          const extractedText = await extractRecipeTextFromDocument(file);

          if (!extractedText) {
            throw new RecipeImportError("We couldn't read any recipe text from that document.");
          }

          const { cleanedText, sourceUrl } = preprocessExtractedDocumentText(extractedText);
          const parsed = parseRecipeFromText(
            cleanedText,
            typeof title === "string" ? title : undefined
          );

          return {
            ...parsed,
            sourceUrl: parsed.sourceUrl || sourceUrl,
          };
        })()
      : await (async () => {
          const body = await req.json();

          return body.mode === "text"
            ? (() => {
                const input = importTextSchema.parse(body);
                return parseRecipeFromText(input.text, input.title);
              })()
            : await parseRecipeFromUrl(importUrlSchema.parse(body).url);
        })();

    return ok({
      ...parsed,
      ingredients: normalizeRecipeIngredients(parsed.ingredients),
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Import input is invalid", 422, error.flatten().fieldErrors);
    if (error instanceof RecipeImportError) {
      return err(error.message, error.status);
    }
    console.error("[import]", error);
    return serverError("Recipe import failed. Please try a different link or use text import.");
  }
}
