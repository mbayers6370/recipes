import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/db";
import { created, err, forbidden, serverError } from "@/lib/api-response";
import { recipeSchema } from "@/lib/validators";
import { setImportedRecipeTag } from "@/lib/recipe-taxonomy";

const ingestSchema = z.object({
  userIdentifier: z.string().min(1, "User identifier is required"),
  recipe: recipeSchema,
});

export async function POST(req: NextRequest) {
  try {
    const expectedToken = process.env.RECIPE_INGEST_TOKEN;
    if (!expectedToken) {
      return serverError("Recipe ingest is not configured");
    }

    const providedToken = req.headers.get("x-ingest-token");
    if (providedToken !== expectedToken) {
      return forbidden("Invalid ingest token");
    }

    const body = await req.json();
    const { userIdentifier, recipe: input } = ingestSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userIdentifier },
          { username: userIdentifier },
        ],
      },
      select: { id: true },
    });

    if (!user) {
      return err("User not found", 404);
    }

    const steps = (input.steps || []).map((step, index) => ({
      id: nanoid(),
      ...step,
      order: index,
    }));
    const ingredients = (input.ingredients || []).map((ingredient) => ({
      id: nanoid(),
      ...ingredient,
    }));

    const totalTime =
      input.totalTime ??
      ((input.prepTime ?? 0) + (input.cookTime ?? 0) || undefined);

    const recipe = await prisma.recipe.create({
      data: {
        ...input,
        userId: user.id,
        tags: setImportedRecipeTag(input.tags),
        steps,
        ingredients,
        totalTime,
      },
    });

    return created(recipe);
  } catch (error) {
    if (error instanceof ZodError) {
      return err("Validation failed", 422, error.flatten().fieldErrors);
    }
    console.error("[recipes ingest]", error);
    return serverError();
  }
}
