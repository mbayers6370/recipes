import { NextRequest } from "next/server";
import {
  verifyRefreshToken,
  signAccessToken,
  rotateRefreshToken,
  getCookieConfig,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return unauthorized();

  try {
    const payload = verifyRefreshToken(refreshToken);
    const newRefreshToken = await rotateRefreshToken(refreshToken, payload.sub);
    const newAccessToken = signAccessToken({
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
    });

    const response = ok({ ok: true });
    const cookieConfig = getCookieConfig(req);
    response.cookies.set(ACCESS_COOKIE, newAccessToken, {
      ...cookieConfig,
      maxAge: 15 * 60,
    });
    response.cookies.set(REFRESH_COOKIE, newRefreshToken, {
      ...cookieConfig,
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch {
    const response = unauthorized("Session expired, please log in again");
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
}
