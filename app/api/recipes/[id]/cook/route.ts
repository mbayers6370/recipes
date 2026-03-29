import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { ok, unauthorized, serverError } from "@/lib/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id: recipeId } = await params;

    const session = await prisma.cookingSession.findFirst({
      where: { userId: user.sub, recipeId, isCompleted: false },
      include: { recipe: true },
    });

    return ok(session);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    return serverError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id: recipeId } = await params;
    const body = await req.json().catch(() => ({}));
    const { currentStep = 0, servingScale = 1.0, isCompleted = false } = body;

    const existingSession = await prisma.cookingSession.findFirst({
      where: { userId: user.sub, recipeId, isCompleted: false },
      select: { id: true },
    });

    const session = existingSession
      ? await prisma.cookingSession.update({
          where: { id: existingSession.id },
          data: { currentStep, servingScale, isCompleted },
        })
      : await prisma.cookingSession.create({
          data: { userId: user.sub, recipeId, currentStep, servingScale, isCompleted },
        });

    return ok(session);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[cook POST]", error);
    return serverError();
  }
}
