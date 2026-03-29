import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { ok, unauthorized, notFound, serverError } from "@/lib/api-response";

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

type Params = { params: Promise<{ listId: string; itemId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser(req);
    await purgeExpiredCheckedItems(user.sub);
    const { listId, itemId } = await params;

    // Verify ownership
    const list = await prisma.groceryList.findFirst({ where: { id: listId, userId: user.sub } });
    if (!list) return notFound();

    const body = await req.json();
    const item = await prisma.groceryItem.update({
      where: { id: itemId, groceryListId: listId },
      data: {
        isChecked: body.isChecked,
        checkedAt: body.isChecked ? new Date() : null,
      },
    });
    return ok(item);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser(req);
    await purgeExpiredCheckedItems(user.sub);
    const { listId, itemId } = await params;

    const list = await prisma.groceryList.findFirst({ where: { id: listId, userId: user.sub } });
    if (!list) return notFound();

    await prisma.groceryItem.delete({ where: { id: itemId } });
    return ok({ deleted: true });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}
