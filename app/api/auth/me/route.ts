import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/get-user";
import { ok, unauthorized, notFound, serverError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const jwtUser = await getCurrentUser(req);
    if (!jwtUser) return unauthorized();

    const user = await prisma.user.findUnique({
      where: { id: jwtUser.sub },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        _count: { select: { recipes: true } },
      },
    });

    if (!user) return notFound("User not found");
    return ok(user);
  } catch (error) {
    console.error("[me]", error);
    return serverError();
  }
}
