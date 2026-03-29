/**
 * Edge-compatible JWT verification — no Node.js APIs.
 * Used only in middleware.ts (Edge Runtime).
 * Full auth (bcrypt, Prisma, crypto) lives in lib/auth.ts (Node.js runtime).
 */

import { jwtVerify } from "jose";

export interface JWTPayload {
  sub: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function verifyAccessTokenEdge(token: string): Promise<JWTPayload> {
  const secret = getSecret(process.env.JWT_ACCESS_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JWTPayload;
}

export const ACCESS_COOKIE = "ab_ovo_access";
export const REFRESH_COOKIE = "ab_ovo_refresh";
