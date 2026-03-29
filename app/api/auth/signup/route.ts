import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  getCookieConfig,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import { ok, err, serverError } from "@/lib/api-response";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = signupSchema.parse(body);

    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: data.email }, { username: data.username }],
      },
    });

    if (existing) {
      const field = existing.email === data.email ? "email" : "username";
      return err(`That ${field} is already taken`, 409);
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash,
        displayName: data.displayName || data.username,
      },
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

    const payload = { sub: user.id, email: user.email, username: user.username };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await saveRefreshToken(user.id, refreshToken);

    const response = ok({ user }, 201);
    const cookieConfig = getCookieConfig(req);
    response.cookies.set(ACCESS_COOKIE, accessToken, {
      ...cookieConfig,
      maxAge: 15 * 60,
    });
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      ...cookieConfig,
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return err("Validation failed", 422, error.flatten().fieldErrors);
    }
    console.error("[signup]", error);
    return serverError();
  }
}
