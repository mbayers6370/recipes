import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { householdPlanItemSchema } from "@/lib/validators";
import { getHouseholdMembership } from "@/lib/households";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";
import { startOfWeek } from "@/lib/date-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return ok(null);

    const weekParam = req.nextUrl.searchParams.get("week");
    const weekStart = startOfWeek(weekParam ? new Date(weekParam) : new Date());

    const plan = await prisma.householdPlan.findUnique({
      where: {
        householdId_weekStart: {
          householdId: membership.householdId,
          weekStart,
        },
      },
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
            createdByUser: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return ok(plan);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[kitchen plan GET]", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return err("Join or create a shared kitchen first.", 400);

    const body = await req.json();
    const weekParam = body.week;
    const weekStart = startOfWeek(weekParam ? new Date(weekParam) : new Date());
    const itemData = householdPlanItemSchema.parse(body);
    const trimmedNote = itemData.note?.trim();

    if (!itemData.recipeId && !trimmedNote) {
      return err("Please choose a recipe or note for this meal.", 422);
    }

    const plan = await prisma.householdPlan.upsert({
      where: {
        householdId_weekStart: {
          householdId: membership.householdId,
          weekStart,
        },
      },
      update: {},
      create: {
        householdId: membership.householdId,
        weekStart,
      },
    });

    const item = await prisma.householdPlanItem.create({
      data: {
        householdPlanId: plan.id,
        recipeId: itemData.recipeId,
        dayOfWeek: itemData.dayOfWeek,
        mealType: itemData.mealType,
        note: trimmedNote || null,
        servings: itemData.servings,
        createdByUserId: user.sub,
      },
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
        createdByUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return created(item);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    console.error("[kitchen plan POST]", error);
    return serverError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return err("Kitchen not found.", 404);

    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!itemId) return err("Missing kitchen plan item id", 400);

    const item = await prisma.householdPlanItem.findUnique({
      where: { id: itemId },
      include: {
        householdPlan: {
          select: { householdId: true },
        },
      },
    });

    if (!item || item.householdPlan.householdId !== membership.householdId) {
      return err("Kitchen plan item not found", 404);
    }

    await prisma.householdPlanItem.delete({ where: { id: itemId } });
    return ok({ id: itemId });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[kitchen plan DELETE]", error);
    return serverError();
  }
}
