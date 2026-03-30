import { NextRequest } from "next/server";
import { requireUser } from "@/lib/get-user";
import { notFound, serverError, unauthorized } from "@/lib/api-response";
import { exportRecipeAsMarkdown, recipeExportFilename } from "@/lib/recipe-export";
import { getAccessibleRecipe } from "@/lib/households";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const recipe = await getAccessibleRecipe(id, user.sub);

    if (!recipe) return notFound("Recipe not found");

    return new Response(exportRecipeAsMarkdown(recipe), {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${recipeExportFilename(recipe.title, "md")}"`,
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[recipe export]", error);
    return serverError();
  }
}
