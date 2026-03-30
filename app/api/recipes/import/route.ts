import { NextRequest } from "next/server";
import { requireUser } from "@/lib/get-user";
import { parseRecipeFromText, parseRecipeFromUrl, RecipeImportError } from "@/lib/recipe-parser";
import { importTextSchema, importUrlSchema } from "@/lib/validators";
import { ok, err, unauthorized, serverError } from "@/lib/api-response";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const body = await req.json();
    const parsed = body.mode === "text"
      ? (() => {
          const input = importTextSchema.parse(body);
          return parseRecipeFromText(input.text, input.title);
        })()
      : await parseRecipeFromUrl(importUrlSchema.parse(body).url);
    return ok(parsed);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Import input is invalid", 422, error.flatten().fieldErrors);
    if (error instanceof RecipeImportError) {
      return err(error.message, error.status);
    }
    console.error("[import]", error);
    return serverError("Recipe import failed. Please try a different link or use text/image import.");
  }
}
