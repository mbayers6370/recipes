import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { recipeSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { ZodError } from "zod";
import { nanoid } from "nanoid";
import { getRecipeType } from "@/lib/recipe-taxonomy";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = req.nextUrl;

    const search = searchParams.get("q") || "";
    const tag = searchParams.get("tag");
    const type = searchParams.get("type");
    const sort = searchParams.get("sort") || "updated_desc";
    const favorites = searchParams.get("favorites") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;
    const typeTag = type ? `type:${type}` : null;

    const where = {
      userId: user.sub,
      ...(favorites ? { isFavorite: true } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { cuisine: { contains: search, mode: "insensitive" as const } },
              { tags: { has: search } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(typeTag ? { tags: { has: typeTag } } : {}),
    };

    const select = {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      prepTime: true,
      cookTime: true,
      totalTime: true,
      servings: true,
      difficulty: true,
      cuisine: true,
      tags: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    const dbSortMap: Record<string, { [key: string]: "asc" | "desc" }> = {
      updated_desc: { updatedAt: "desc" },
      created_desc: { createdAt: "desc" },
      title_asc: { title: "asc" },
      cook_time_asc: { totalTime: "asc" },
    };

    const [recipes, total] = await Promise.all([
      sort === "type_asc"
        ? prisma.recipe.findMany({
            where,
            orderBy: [{ title: "asc" }],
            select,
          }).then((rows) =>
            rows
              .sort((a, b) => {
                const aType = getRecipeType(a.tags) || "zzzz";
                const bType = getRecipeType(b.tags) || "zzzz";
                if (aType !== bType) return aType.localeCompare(bType);
                return a.title.localeCompare(b.title);
              })
              .slice(skip, skip + limit)
          )
        : prisma.recipe.findMany({
            where,
            orderBy: dbSortMap[sort] || dbSortMap.updated_desc,
            skip,
            take: limit,
            select,
          }),
      prisma.recipe.count({ where }),
    ]);

    return ok({ recipes, total, page, limit, pages: Math.ceil(total / limit), sort, type });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[recipes GET]", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const data = recipeSchema.parse(body);

    // Ensure steps have stable IDs
    const steps = (data.steps || []).map((s, i) => ({
      id: nanoid(),
      ...s,
      order: i,
    }));
    const ingredients = (data.ingredients || []).map((ing) => ({
      id: nanoid(),
      ...ing,
    }));

    const totalTime =
      data.totalTime ??
      ((data.prepTime ?? 0) + (data.cookTime ?? 0) || undefined);

    const recipe = await prisma.recipe.create({
      data: {
        userId: user.sub,
        ...data,
        steps,
        ingredients,
        totalTime,
      },
    });

    return created(recipe);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    console.error("[recipes POST]", error);
    return serverError();
  }
}
