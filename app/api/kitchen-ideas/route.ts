import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { getHouseholdMembership } from "@/lib/households";
import { householdIdeaSchema, householdIdeaVoteSchema } from "@/lib/validators";
import { ok, created, err, unauthorized, serverError } from "@/lib/api-response";

const ideaInclude = {
  recipe: {
    select: {
      id: true,
      title: true,
      imageUrl: true,
      totalTime: true,
      servings: true,
      cuisine: true,
      tags: true,
    },
  },
  proposedByUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  votes: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" as const },
  },
} as const;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return ok([]);

    const ideas = await prisma.householdIdea.findMany({
      where: {
        householdId: membership.householdId,
      },
      include: ideaInclude,
      orderBy: { updatedAt: "desc" },
    });

    return ok(ideas);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[kitchen ideas GET]", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return err("Join or create a shared kitchen first.", 400);

    const body = await req.json();
    const data = householdIdeaSchema.parse(body);

    const recipe = await prisma.recipe.findFirst({
      where: {
        id: data.recipeId,
        householdId: membership.householdId,
      },
      select: { id: true },
    });

    if (!recipe) {
      return err("Only recipes already shared with the kitchen can be suggested.", 403);
    }

    const idea = await prisma.householdIdea.upsert({
      where: {
        householdId_recipeId: {
          householdId: membership.householdId,
          recipeId: data.recipeId,
        },
      },
      update: {},
      create: {
        householdId: membership.householdId,
        recipeId: data.recipeId,
        proposedByUserId: user.sub,
      },
      include: ideaInclude,
    });

    return created(idea);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    console.error("[kitchen ideas POST]", error);
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return err("Kitchen not found.", 404);

    const body = await req.json();
    const data = householdIdeaVoteSchema.parse(body);

    const idea = await prisma.householdIdea.findFirst({
      where: {
        id: data.ideaId,
        householdId: membership.householdId,
      },
      select: { id: true },
    });

    if (!idea) {
      return err("Meal idea not found.", 404);
    }

    await prisma.householdIdeaVote.upsert({
      where: {
        householdIdeaId_userId: {
          householdIdeaId: data.ideaId,
          userId: user.sub,
        },
      },
      update: { vote: data.vote },
      create: {
        householdIdeaId: data.ideaId,
        userId: user.sub,
        vote: data.vote,
      },
    });

    const updatedIdea = await prisma.householdIdea.findUnique({
      where: { id: data.ideaId },
      include: ideaInclude,
    });

    return ok(updatedIdea);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    if (error instanceof ZodError) return err("Validation failed", 422, error.flatten().fieldErrors);
    console.error("[kitchen ideas PATCH]", error);
    return serverError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    if (!membership) return err("Kitchen not found.", 404);

    const ideaId = req.nextUrl.searchParams.get("ideaId");
    if (!ideaId) return err("Missing meal idea id", 400);

    const idea = await prisma.householdIdea.findFirst({
      where: {
        id: ideaId,
        householdId: membership.householdId,
      },
      select: {
        id: true,
        proposedByUserId: true,
      },
    });

    if (!idea) return err("Meal idea not found.", 404);
    if (idea.proposedByUserId !== user.sub && membership.role !== "owner") {
      return err("Only the suggester or kitchen owner can remove this idea.", 403);
    }

    await prisma.householdIdea.delete({ where: { id: ideaId } });
    return ok({ id: ideaId });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[kitchen ideas DELETE]", error);
    return serverError();
  }
}
