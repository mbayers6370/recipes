import "server-only";

import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/db";

export const HOUSEHOLD_MEMBER_LIMIT = 5;

export async function getHouseholdMembership(userId: string) {
  try {
    return await prisma.householdMember.findUnique({
      where: { userId },
      include: {
        household: {
          include: {
            members: {
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function getUserHouseholdId(userId: string) {
  try {
    const membership = await prisma.householdMember.findUnique({
      where: { userId },
      select: { householdId: true },
    });

    return membership?.householdId ?? null;
  } catch {
    return null;
  }
}

export function buildRecipeAccessWhere(
  userId: string,
  householdId: string | null
): Prisma.RecipeWhereInput {
  if (!householdId) {
    return { userId };
  }

  return {
    OR: [{ userId }, { householdId }],
  };
}

export async function getAccessibleRecipe(id: string, userId: string) {
  const householdId = await getUserHouseholdId(userId);

  return prisma.recipe.findFirst({
    where: {
      id,
      ...buildRecipeAccessWhere(userId, householdId),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });
}
