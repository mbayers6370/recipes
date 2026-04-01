import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { recipeSchema } from "@/lib/validators";
import { ok, err, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { ZodError } from "zod";
import { nanoid } from "nanoid";
import { getAccessibleRecipe, getUserHouseholdId } from "@/lib/households";
import { normalizeRecipeIngredients } from "@/lib/ingredient-normalization";
import { isLikelyDirectImageUrl, resolveRecipeImageUrl } from "@/lib/recipe-image-url";

async function getOwnedRecipe(id: string, userId: string) {
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) return { recipe: null, error: notFound() };
  if (recipe.userId !== userId) return { recipe: null, error: forbidden() };
  return { recipe, error: null };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const recipe = await getAccessibleRecipe(id, user.sub);
    if (!recipe) return notFound("Recipe not found");
    return ok(recipe);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const { recipe, error } = await getOwnedRecipe(id, user.sub);
    if (error) return error;

    const body = await req.json();
    const data = recipeSchema.partial().parse(body);
    const hasTitleUpdate = Object.prototype.hasOwnProperty.call(body, "title");
    const hasDescriptionUpdate = Object.prototype.hasOwnProperty.call(body, "description");
    const hasImageUrlUpdate = Object.prototype.hasOwnProperty.call(body, "imageUrl");
    const hasSourceUrlUpdate = Object.prototype.hasOwnProperty.call(body, "sourceUrl");
    const hasPrepTimeUpdate = Object.prototype.hasOwnProperty.call(body, "prepTime");
    const hasCookTimeUpdate = Object.prototype.hasOwnProperty.call(body, "cookTime");
    const hasTotalTimeUpdate = Object.prototype.hasOwnProperty.call(body, "totalTime");
    const hasServingsUpdate = Object.prototype.hasOwnProperty.call(body, "servings");
    const hasDifficultyUpdate = Object.prototype.hasOwnProperty.call(body, "difficulty");
    const hasCuisineUpdate = Object.prototype.hasOwnProperty.call(body, "cuisine");
    const hasTagsUpdate = Object.prototype.hasOwnProperty.call(body, "tags");
    const hasIngredientsUpdate = Object.prototype.hasOwnProperty.call(body, "ingredients");
    const hasStepsUpdate = Object.prototype.hasOwnProperty.call(body, "steps");
    const hasNutritionUpdate = Object.prototype.hasOwnProperty.call(body, "nutrition");
    const hasNotesUpdate = Object.prototype.hasOwnProperty.call(body, "notes");
    const hasFavoriteUpdate = Object.prototype.hasOwnProperty.call(body, "isFavorite");
    const hasPublicUpdate = Object.prototype.hasOwnProperty.call(body, "isPublic");
    const hasHouseholdUpdate = Object.prototype.hasOwnProperty.call(body, "householdId");

    const steps = hasStepsUpdate && data.steps
      ? data.steps.map((step, index) => ({
          id: step.id || nanoid(),
          ...step,
          order: index,
        }))
      : undefined;

    const ingredients = hasIngredientsUpdate && data.ingredients
      ? normalizeRecipeIngredients(data.ingredients).map((ingredient) => ({
          id: ingredient.id || nanoid(),
          ...ingredient,
        }))
      : undefined;

    const updateData: Record<string, unknown> = {};

    if (hasImageUrlUpdate && data.imageUrl) {
      try {
        const resolvedImageUrl = isLikelyDirectImageUrl(data.imageUrl)
          ? data.imageUrl
          : await resolveRecipeImageUrl(data.imageUrl);

        if (resolvedImageUrl) {
          updateData.imageUrl = resolvedImageUrl;
        }
      } catch (imageError) {
        console.error("[recipes PUT image]", imageError);
      }
    }

    if (hasTitleUpdate) updateData.title = data.title;
    if (hasDescriptionUpdate) updateData.description = data.description;
    if (hasImageUrlUpdate && !data.imageUrl) updateData.imageUrl = null;
    if (hasSourceUrlUpdate) updateData.sourceUrl = data.sourceUrl;
    if (hasPrepTimeUpdate) updateData.prepTime = data.prepTime;
    if (hasCookTimeUpdate) updateData.cookTime = data.cookTime;
    if (hasServingsUpdate) updateData.servings = data.servings;
    if (hasDifficultyUpdate) updateData.difficulty = data.difficulty;
    if (hasCuisineUpdate) updateData.cuisine = data.cuisine;
    if (hasTagsUpdate) updateData.tags = data.tags;
    if (hasNutritionUpdate) updateData.nutrition = data.nutrition;
    if (hasNotesUpdate) updateData.notes = data.notes;
    if (hasFavoriteUpdate) updateData.isFavorite = data.isFavorite;
    if (hasPublicUpdate) updateData.isPublic = data.isPublic;
    if (hasStepsUpdate) updateData.steps = steps;
    if (hasIngredientsUpdate) updateData.ingredients = ingredients;
    if (hasHouseholdUpdate) {
      if (data.householdId) {
        const householdId = await getUserHouseholdId(user.sub);
        if (!householdId || householdId !== data.householdId) {
          return err("You can only share to your own kitchen.", 403);
        }
        updateData.householdId = householdId;
      } else {
        updateData.householdId = null;
      }
    }

    if (hasTotalTimeUpdate) {
      updateData.totalTime = data.totalTime;
    } else if (hasPrepTimeUpdate || hasCookTimeUpdate) {
      const computedTotalTime =
        (data.prepTime ?? recipe!.prepTime ?? 0) +
        (data.cookTime ?? recipe!.cookTime ?? 0);
      updateData.totalTime = computedTotalTime || undefined;
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data: updateData,
    });

    return ok(updated);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const { error } = await getOwnedRecipe(id, user.sub);
    if (error) return error;

    await prisma.recipe.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}
