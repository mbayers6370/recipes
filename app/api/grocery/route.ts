import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { groceryItemSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { scaleAmountText } from "@/lib/measurements";
import { ZodError } from "zod";
import { getAccessibleRecipe } from "@/lib/households";

const CHECKED_ITEM_TTL_HOURS = 4;

async function purgeExpiredCheckedItems(userId: string) {
  const cutoff = new Date(Date.now() - CHECKED_ITEM_TTL_HOURS * 60 * 60 * 1000);

  await prisma.groceryItem.deleteMany({
    where: {
      isChecked: true,
      checkedAt: { lte: cutoff },
      groceryList: { userId },
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await purgeExpiredCheckedItems(user.sub);

    const lists = await prisma.groceryList.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: [
            { isChecked: "asc" },
            { checkedAt: "asc" },
            { sortOrder: "asc" },
            { category: "asc" },
          ],
        },
        _count: { select: { items: true } },
      },
    });

    return ok(lists);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await purgeExpiredCheckedItems(user.sub);
    const body = await req.json();

    if (body.action === "create_list") {
      const list = await prisma.groceryList.create({
        data: { userId: user.sub, name: body.name || "Grocery List" },
        include: { items: true },
      });
      return created(list);
    }

    if (body.action === "add_from_recipe" && body.recipeId) {
      const recipe = await getAccessibleRecipe(body.recipeId, user.sub);
      if (!recipe) return err("Recipe not found", 404);

      let list = await prisma.groceryList.findFirst({
        where: { userId: user.sub, isActive: true },
        orderBy: { createdAt: "desc" },
      });

      if (!list) {
        list = await prisma.groceryList.create({
          data: { userId: user.sub, name: "This Week" },
        });
      }

      const scale = body.servingScale ?? 1;
      const ingredients = recipe.ingredients as Array<{
        name: string;
        amount?: string;
        unit?: string;
      }>;

      await prisma.groceryItem.createMany({
        data: ingredients.map((ing, i) => ({
          groceryListId: list!.id,
          name: ing.name,
          amount: scaleAmountText(ing.amount, scale) ?? ing.amount,
          unit: ing.unit,
          sortOrder: i,
        })),
      });

      return ok({ addedCount: ingredients.length, listId: list.id });
    }

    // Add single item
    const listId = body.listId;
    if (!listId) return err("listId required", 400);

    const ownsList = await prisma.groceryList.findFirst({
      where: { id: listId, userId: user.sub },
    });
    if (!ownsList) return err("List not found", 404);

    const itemData = groceryItemSchema.parse(body);
    const item = await prisma.groceryItem.create({
      data: { groceryListId: listId, ...itemData },
    });
    return created(item);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    console.error("[grocery POST]", error);
    return serverError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const listId = req.nextUrl.searchParams.get("listId");

    if (!listId) return err("listId required", 400);

    const list = await prisma.groceryList.findFirst({
      where: { id: listId, userId: user.sub },
    });

    if (!list) return err("List not found", 404);

    await prisma.groceryList.delete({
      where: { id: listId },
    });

    return ok({ deleted: true, id: listId });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[grocery DELETE]", error);
    return serverError();
  }
}
