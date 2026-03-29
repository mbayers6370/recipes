import "server-only";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./db";

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "30d";
const BCRYPT_ROUNDS = 12;

import type { JWTPayload } from "./auth-edge";
export type { JWTPayload };

// ── Password ──────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Access token (short-lived, 15 min) ───────────────────────────────────────

export function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as JWTPayload;
}

// ── Refresh token (long-lived, 30 days) ──────────────────────────────────────

export function signRefreshToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyRefreshToken(token: string): JWTPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function saveRefreshToken(
  userId: string,
  token: string
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

export async function rotateRefreshToken(
  oldToken: string,
  userId: string
): Promise<string> {
  const oldHash = hashToken(oldToken);

  // Revoke old token
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: oldHash },
  });

  if (!existing || existing.revokedAt || existing.userId !== userId) {
    // Possible token reuse — revoke ALL tokens for this user
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    throw new Error("Invalid refresh token");
  }

  if (existing.expiresAt < new Date()) {
    throw new Error("Refresh token expired");
  }

  await prisma.refreshToken.update({
    where: { tokenHash: oldHash },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const newToken = signRefreshToken({
    sub: user.id,
    email: user.email,
    username: user.username,
  });
  await saveRefreshToken(userId, newToken);
  return newToken;
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_CONFIG = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export function getCookieConfig(req?: NextRequest) {
  const protocol = req?.headers.get("x-forwarded-proto") ?? req?.nextUrl.protocol.replace(":", "");

  return {
    ...COOKIE_CONFIG,
    secure: protocol ? protocol === "https" : process.env.NODE_ENV === "production",
  };
}

export { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-edge";

// ── Request auth extraction ───────────────────────────────────────────────────

export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
