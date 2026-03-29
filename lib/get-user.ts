import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAccessToken,
  ACCESS_COOKIE,
  type JWTPayload,
} from "./auth";

/**
 * Extract and verify the current user from request cookies.
 * Returns null if no valid access token is present.
 */
export async function getCurrentUser(
  req?: NextRequest
): Promise<JWTPayload | null> {
  try {
    let token: string | undefined;

    if (req) {
      token = req.cookies.get(ACCESS_COOKIE)?.value;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(ACCESS_COOKIE)?.value;
    }

    if (!token) return null;
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/**
 * Like getCurrentUser but throws if unauthenticated.
 */
export async function requireUser(req?: NextRequest): Promise<JWTPayload> {
  const user = await getCurrentUser(req);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
