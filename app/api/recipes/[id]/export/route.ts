import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { forbidden, notFound, serverError, unauthorized } from "@/lib/api-response";
import { exportRecipeAsMarkdown, recipeExportFilename } from "@/lib/recipe-export";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const recipe = await prisma.recipe.findUnique({ where: { id } });

    if (!recipe) return notFound("Recipe not found");
    if (recipe.userId !== user.sub) return forbidden();

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
