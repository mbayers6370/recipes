import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  saveRefreshToken,
  getCookieConfig,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { ok, err, serverError } from "@/lib/api-response";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = loginSchema.parse(body);

    const isEmail = identifier.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { username: identifier },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
        passwordHash: true,
        _count: { select: { recipes: true } },
      },
    });

    // Constant-time: always run bcrypt even if user not found (prevent timing attacks)
    const DUMMY_HASH =
      "$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn";
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

    if (!user || !valid) {
      return err("Invalid credentials", 401);
    }

    const payload = { sub: user.id, email: user.email, username: user.username };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    await saveRefreshToken(user.id, refreshToken);

    const response = ok({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        createdAt: user.createdAt,
        _count: user._count,
      },
    });
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
    console.error("[login]", error);
    return serverError();
  }
}
