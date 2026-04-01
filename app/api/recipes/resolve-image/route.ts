import { NextRequest } from "next/server";
import { requireUser } from "@/lib/get-user";
import { importUrlSchema } from "@/lib/validators";
import { ok, err, unauthorized, serverError } from "@/lib/api-response";
import { resolveRecipeImageUrl } from "@/lib/recipe-image-url";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const body = await req.json();
    const { url } = importUrlSchema.parse(body);
    const imageUrl = await resolveRecipeImageUrl(url);

    if (!imageUrl) {
      return err("We couldn't find an image on that page.", 404);
    }

    return ok({ imageUrl });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Invalid URL", 422, error.flatten().fieldErrors);
    return serverError("We couldn't resolve an image from that URL.");
  }
}
