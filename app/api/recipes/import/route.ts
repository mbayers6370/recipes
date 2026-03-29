import { NextRequest } from "next/server";
import { requireUser } from "@/lib/get-user";
import { parseRecipeFromText, parseRecipeFromUrl } from "@/lib/recipe-parser";
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
    if ((error as Error).message?.includes("Failed to fetch")) {
      return err("Could not reach that URL. Please check it and try again.", 422);
    }
    console.error("[import]", error);
    return serverError("Failed to parse recipe from URL");
  }
}
