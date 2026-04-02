import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { groceryItemSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { formatAmountValue, parseAmountValue, scaleAmountText } from "@/lib/measurements";
import { ZodError } from "zod";
import { getAccessibleRecipe } from "@/lib/households";
import { normalizeGroceryName } from "@/lib/grocery-normalization";
import { countRecipeOverlap, normalizeGroceryUnit } from "@/lib/grocery-matching";
import { isMeaningfulIngredientName } from "@/lib/ingredient-normalization";

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

async function purgeInvalidGroceryItems(userId: string) {
  const invalidItems = await prisma.groceryItem.findMany({
    where: {
      groceryList: { userId },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const invalidIds = invalidItems
    .filter((item) => !isMeaningfulIngredientName(item.name))
    .map((item) => item.id);

  if (!invalidIds.length) return;

  await prisma.groceryItem.deleteMany({
    where: {
      id: { in: invalidIds },
    },
  });
}

function normalizeIngredientName(name?: string | null) {
  return normalizeGroceryName(name);
}

function canMergeIngredientAmounts(
  existing: { name?: string | null; unit?: string | null; amount?: string | null; isChecked?: boolean | null },
  incoming: { name?: string | null; unit?: string | null; amount?: string | null }
) {
  if (existing.isChecked) return false;

  const existingName = normalizeIngredientName(existing.name);
  const incomingName = normalizeIngredientName(incoming.name);
  if (!existingName || existingName !== incomingName) return false;

  const existingUnit = normalizeGroceryUnit(existing.unit);
  const incomingUnit = normalizeGroceryUnit(incoming.unit);
  if (existingUnit !== incomingUnit) return false;

  const existingAmount = parseAmountValue(existing.amount);
  const incomingAmount = parseAmountValue(incoming.amount);

  return existingAmount !== null && incomingAmount !== null;
}

async function addOrMergeGroceryItem(params: {
  listId: string;
  item: {
    name: string;
    amount?: string | null;
    unit?: string | null;
    category?: string | null;
    notes?: string | null;
  };
  sortOrder?: number;
}) {
  const { listId, item, sortOrder = 0 } = params;
  const normalizedName = normalizeIngredientName(item.name);
  const normalizedUnit = normalizeGroceryUnit(item.unit);

  if (!isMeaningfulIngredientName(normalizedName)) {
    return null;
  }

  const existingItems = await prisma.groceryItem.findMany({
    where: {
      groceryListId: listId,
      isChecked: false,
    },
    orderBy: { createdAt: "asc" },
  });

  const existingMatch = existingItems.find((existing) => {
    if (normalizeIngredientName(existing.name) !== normalizedName) return false;
    if (normalizeGroceryUnit(existing.unit) !== normalizedUnit) return false;
    return canMergeIngredientAmounts(existing, item);
  });

  if (existingMatch) {
    const nextAmount =
      (parseAmountValue(existingMatch.amount) || 0) + (parseAmountValue(item.amount) || 0);

    return prisma.groceryItem.update({
      where: { id: existingMatch.id },
      data: {
        amount: formatAmountValue(nextAmount),
      },
    });
  }

  return prisma.groceryItem.create({
    data: {
      groceryListId: listId,
      name: normalizeGroceryName(item.name),
      amount: item.amount || undefined,
      unit: item.unit || undefined,
      category: item.category || undefined,
      notes: item.notes || undefined,
      sortOrder,
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    await purgeExpiredCheckedItems(user.sub);
    await purgeInvalidGroceryItems(user.sub);

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
    await purgeInvalidGroceryItems(user.sub);
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

      const existingItems = await prisma.groceryItem.findMany({
        where: {
          groceryListId: list.id,
          isChecked: false,
        },
        select: {
          name: true,
          unit: true,
          isChecked: true,
        },
      });

      const scaledIngredients = ingredients.map((ing) => ({
        name: ing.name,
        amount: scaleAmountText(ing.amount, scale) ?? ing.amount,
        unit: ing.unit,
      }));

      const overlap = countRecipeOverlap({
        recipeIngredients: scaledIngredients,
        listItems: existingItems,
      });

      if (overlap.shouldWarn && !body.confirmDuplicateAdd) {
        return err(
          `Most of this recipe already looks like it's on your active grocery list.`,
          409,
          {
            overlapCount: overlap.overlapCount,
            ingredientCount: overlap.ingredientCount,
            listId: list.id,
            listName: list.name,
          }
        );
      }

      const addResults = await Promise.all(
        scaledIngredients.map((ing, i) =>
          addOrMergeGroceryItem({
            listId: list!.id,
            item: {
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
            },
            sortOrder: i,
          })
        )
      );

      const addedCount = addResults.filter(Boolean).length;
      const skippedIngredients = scaledIngredients
        .filter((_, index) => !addResults[index])
        .map((ingredient) => ingredient.name);

      return ok({
        addedCount,
        skippedCount: skippedIngredients.length,
        skippedIngredients,
        listId: list.id,
      });
    }

    // Add single item
    const listId = body.listId;
    if (!listId) return err("listId required", 400);

    const ownsList = await prisma.groceryList.findFirst({
      where: { id: listId, userId: user.sub },
    });
    if (!ownsList) return err("List not found", 404);

    const itemData = groceryItemSchema.parse(body);
      const item = await addOrMergeGroceryItem({
      listId,
      item: itemData,
    });
    if (!item) return err("That item doesn't look complete enough to add to grocery.", 422);
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
