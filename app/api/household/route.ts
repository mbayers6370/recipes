import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/get-user";
import { err, ok, serverError, unauthorized } from "@/lib/api-response";
import { getHouseholdMembership, HOUSEHOLD_MEMBER_LIMIT } from "@/lib/households";

function serializeHousehold(
  membership: Awaited<ReturnType<typeof getHouseholdMembership>>
) {
  if (!membership) return null;

  const members = membership.household.members.map((member) => ({
    id: member.user.id,
    email: member.user.email,
    username: member.user.username,
    displayName: member.user.displayName,
    avatarUrl: member.user.avatarUrl,
    createdAt: member.user.createdAt,
    role: member.role,
    joinedAt: member.createdAt,
  }));

  return {
    id: membership.household.id,
    name: membership.household.name,
    role: membership.role,
    memberLimit: HOUSEHOLD_MEMBER_LIMIT,
    memberCount: members.length,
    remainingSlots: Math.max(0, HOUSEHOLD_MEMBER_LIMIT - members.length),
    members,
    createdAt: membership.household.createdAt,
    updatedAt: membership.household.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const membership = await getHouseholdMembership(user.sub);
    return ok(serializeHousehold(membership));
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[household GET]", error);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();

    if (body.action === "create") {
      const existingMembership = await prisma.householdMember.findUnique({
        where: { userId: user.sub },
      });

      if (existingMembership) {
        return err("You already have a shared kitchen.", 409);
      }

      const owner = await prisma.user.findUnique({
        where: { id: user.sub },
        select: { displayName: true, username: true },
      });

      await prisma.household.create({
        data: {
          name: body.name?.trim() || `${owner?.displayName || owner?.username || "My"} Kitchen`,
          ownerId: user.sub,
          members: {
            create: {
              userId: user.sub,
              role: "owner",
            },
          },
        },
      });

      const membership = await getHouseholdMembership(user.sub);
      return ok(serializeHousehold(membership), 201);
    }

    if (body.action === "add_member") {
      const membership = await getHouseholdMembership(user.sub);
      if (!membership) return err("Create a shared kitchen first.", 400);
      if (membership.role !== "owner") return err("Only the kitchen owner can add members.", 403);
      if (membership.household.members.length >= HOUSEHOLD_MEMBER_LIMIT) {
        return err(`Shared kitchens are limited to ${HOUSEHOLD_MEMBER_LIMIT} people.`, 400);
      }

      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return err("Email is required.", 400);

      const targetUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, displayName: true, username: true },
      });

      if (!targetUser) {
        return err("That email does not have an abovo account yet.", 404);
      }
      if (targetUser.id === user.sub) {
        return err("You are already in this shared kitchen.", 400);
      }

      const targetMembership = await prisma.householdMember.findUnique({
        where: { userId: targetUser.id },
      });

      if (targetMembership) {
        return err("That person is already part of another shared kitchen.", 409);
      }

      await prisma.householdMember.create({
        data: {
          householdId: membership.householdId,
          userId: targetUser.id,
          role: "member",
        },
      });

      const updatedMembership = await getHouseholdMembership(user.sub);
      return ok(serializeHousehold(updatedMembership));
    }

    if (body.action === "remove_member") {
      const membership = await getHouseholdMembership(user.sub);
      if (!membership) return err("Shared kitchen not found.", 404);
      if (membership.role !== "owner") return err("Only the kitchen owner can remove members.", 403);

      const memberUserId = String(body.userId || "");
      if (!memberUserId) return err("Member is required.", 400);
      if (memberUserId === user.sub) {
        return err("Use leave instead of removing yourself.", 400);
      }

      await prisma.householdMember.deleteMany({
        where: {
          householdId: membership.householdId,
          userId: memberUserId,
        },
      });

      const updatedMembership = await getHouseholdMembership(user.sub);
      return ok(serializeHousehold(updatedMembership));
    }

    if (body.action === "leave") {
      const membership = await getHouseholdMembership(user.sub);
      if (!membership) return err("You are not part of a shared kitchen.", 404);

      if (membership.role === "owner") {
        const otherMembers = membership.household.members.filter((member) => member.userId !== user.sub);
        if (otherMembers.length > 0) {
          return err("The kitchen owner cannot leave while other members are still connected.", 400);
        }

        await prisma.household.delete({
          where: { id: membership.householdId },
        });
      } else {
        await prisma.householdMember.delete({
          where: { userId: user.sub },
        });
      }

      return ok(null);
    }

    return err("Unsupported action.", 400);
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") return unauthorized();
    console.error("[household POST]", error);
    return serverError();
  }
}
