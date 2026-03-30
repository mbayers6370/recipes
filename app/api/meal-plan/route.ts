import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { mealPlanItemSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { ZodError } from "zod";
import { startOfWeek } from "@/lib/date-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const weekParam = req.nextUrl.searchParams.get("week");
    const weekStart = startOfWeek(weekParam ? new Date(weekParam) : new Date());

    const plan = await prisma.mealPlan.findUnique({
      where: { userId_weekStart: { userId: user.sub, weekStart } },
      include: {
        items: {
          include: {
            recipe: {
              select: {
                id: true,
                title: true,
                imageUrl: true,
                totalTime: true,
                servings: true,
              },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
        },
      },
    });

    return ok(plan);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const weekParam = body.week;
    const weekStart = startOfWeek(weekParam ? new Date(weekParam) : new Date());

    const itemData = mealPlanItemSchema.parse(body);
    const trimmedNote = itemData.note?.trim();

    if (!itemData.recipeId && !trimmedNote) {
      return err("Please choose a recipe or note for this meal.", 422);
    }

    const plan = await prisma.mealPlan.upsert({
      where: { userId_weekStart: { userId: user.sub, weekStart } },
      update: {},
      create: { userId: user.sub, weekStart },
    });

    const item = await prisma.mealPlanItem.create({
      data: {
        mealPlanId: plan.id,
        ...itemData,
        note: trimmedNote || null,
      },
      include: {
        recipe: {
          select: { id: true, title: true, imageUrl: true, totalTime: true },
        },
      },
    });

    return created(item);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    return serverError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const itemId = req.nextUrl.searchParams.get("itemId");

    if (!itemId) return err("Missing meal plan item id", 400);

    const item = await prisma.mealPlanItem.findUnique({
      where: { id: itemId },
      include: {
        mealPlan: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!item || item.mealPlan.userId !== user.sub) return err("Meal plan item not found", 404);

    await prisma.mealPlanItem.delete({
      where: { id: itemId },
    });

    return ok({ id: itemId });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}
