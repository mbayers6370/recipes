import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { recipeSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { ZodError } from "zod";
import { nanoid } from "nanoid";
import { getRecipeType } from "@/lib/recipe-taxonomy";
import { buildRecipeAccessWhere, getUserHouseholdId } from "@/lib/households";
import { Prisma } from "@/app/generated/prisma/client";
import { normalizeRecipeIngredients } from "@/lib/ingredient-normalization";
import { isLikelyDirectImageUrl, resolveRecipeImageUrl } from "@/lib/recipe-image-url";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { searchParams } = req.nextUrl;

    const search = searchParams.get("q") || "";
    const tag = searchParams.get("tag");
    const type = searchParams.get("type");
    const sort = searchParams.get("sort") || "updated_desc";
    const favorites = searchParams.get("favorites") === "true";
    const ownedOnly = searchParams.get("ownedOnly") === "true";
    const sharedOnly = searchParams.get("sharedOnly") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;
    const typeTag = type ? `type:${type}` : null;
    const householdId = await getUserHouseholdId(user.sub);

    const filters: Prisma.RecipeWhereInput = {
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { cuisine: { contains: search, mode: "insensitive" } },
              { tags: { has: search } },
            ],
          }
        : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(typeTag ? { tags: { has: typeTag } } : {}),
    };

    const where: Prisma.RecipeWhereInput = favorites
      ? {
          AND: [
            filters,
            { userId: user.sub, isFavorite: true },
          ],
        }
      : sharedOnly
        ? {
            AND: [
              filters,
              householdId ? { householdId } : { id: "__no_household__" },
            ],
          }
      : ownedOnly
        ? {
            AND: [
              filters,
              { userId: user.sub },
            ],
          }
      : {
          AND: [
            filters,
            buildRecipeAccessWhere(user.sub, householdId),
          ],
        };

    const select = {
      id: true,
      userId: true,
      householdId: true,
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
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    } as const;
    type RecipeListRow = {
      id: string;
      userId: string;
      householdId: string | null;
      title: string;
      description: string | null;
      imageUrl: string | null;
      prepTime: number | null;
      cookTime: number | null;
      totalTime: number | null;
      servings: number | null;
      difficulty: string | null;
      cuisine: string | null;
      tags: string[];
      isFavorite: boolean;
      createdAt: Date;
      updatedAt: Date;
      user: {
        id: string;
        username: string;
        displayName: string | null;
      };
    };

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
          }).then((rows: RecipeListRow[]) =>
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
    const ingredients = normalizeRecipeIngredients(data.ingredients).map((ing) => ({
      id: nanoid(),
      ...ing,
    }));
    const imageSource = data.imageUrl || data.sourceUrl;
    let imageUrl: string | null = null;

    if (imageSource) {
      try {
        imageUrl = (isLikelyDirectImageUrl(imageSource)
          ? imageSource
          : await resolveRecipeImageUrl(imageSource)) ?? null;
      } catch (imageError) {
        console.error("[recipes POST image]", imageError);
      }
    }

    const totalTime =
      data.totalTime ??
      ((data.prepTime ?? 0) + (data.cookTime ?? 0) || undefined);
    const householdId = data.householdId
      ? await getUserHouseholdId(user.sub)
      : null;

    const recipe = await prisma.recipe.create({
      data: {
        userId: user.sub,
        ...data,
        imageUrl,
        householdId,
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
