import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, notFound, serverError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const recipe = await prisma.recipe.findFirst({
      where: {
        id,
        isPublic: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        sourceUrl: true,
        prepTime: true,
        cookTime: true,
        totalTime: true,
        servings: true,
        difficulty: true,
        cuisine: true,
        tags: true,
        ingredients: true,
        steps: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    if (!recipe) {
      return notFound("Recipe not found");
    }

    return ok(recipe);
  } catch (error) {
    console.error("[shared recipe GET]", error);
    return serverError();
  }
}
