import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { unauthorized, serverError } from "@/lib/api-response";
import { exportRecipesAsJson } from "@/lib/recipe-export";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const recipes = await prisma.recipe.findMany({
      where: { userId: user.sub },
      orderBy: { updatedAt: "desc" },
    });

    return new Response(exportRecipesAsJson(recipes), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ab-ovo-recipes.json"',
      },
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[recipes export]", error);
    return serverError();
  }
}
