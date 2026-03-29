import { NextRequest } from "next/server";
import {
  revokeAllUserTokens,
  REFRESH_COOKIE,
  ACCESS_COOKIE,
  verifyRefreshToken,
} from "@/lib/auth";
import { ok } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await revokeAllUserTokens(payload.sub);
    } catch {
      // Token invalid — still clear cookies
    }
  }

  const response = ok({ message: "Logged out" });
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}
