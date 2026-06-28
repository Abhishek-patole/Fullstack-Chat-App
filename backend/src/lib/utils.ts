import jwt from "jsonwebtoken";
import type { Response } from "express";
import crypto from "crypto";

type CookieOptions = {
  maxAge: number;
  httpOnly: boolean;
  sameSite: "strict" | "lax" | "none";
  secure: boolean;
};

type TokenPayload = {
  userId: string;
  sessionId?: string;
};

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";
export const LEGACY_JWT_COOKIE = "jwt";

export type AuthTokenPair = {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
};

export type RefreshSession = {
  _id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type AvatarUser = {
  fullName?: string | null;
  profilePic?: string | null;
};

export const getFallbackAvatarUrl = (fullName: string): string => {
  const trimmedName = fullName.trim();
  const encodedName = encodeURIComponent(trimmedName || "User");

  return `https://ui-avatars.com/api/?name=${encodedName}&background=0D8ABC&color=fff&size=128`;
};

export const normalizeProfilePic = <T extends AvatarUser>(user: T): T & { profilePic: string } => ({
  ...user,
  profilePic: user.profilePic || getFallbackAvatarUrl(user.fullName || "User"),
});

export const getAuthCookieOptions = (maxAge: number): CookieOptions => ({
  maxAge,
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV !== "development",
});

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateAccessToken = (userId: string): string =>
  jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: "15m",
  });

export const generateRefreshToken = (userId: string, sessionId: string): string =>
  jwt.sign({ userId, sessionId }, process.env.JWT_SECRET as string, {
    expiresIn: "7d",
  });

export const generateAuthTokens = (userId: string): AuthTokenPair => {
  const refreshTokenId = crypto.randomUUID();
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId, refreshTokenId),
    refreshTokenId,
  };
};

export const generateToken = (userId: string, res: Response): string => {
  const token = generateAccessToken(userId);

  res.cookie(LEGACY_JWT_COOKIE, token, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

  return token;
};

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getAuthCookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));
};

export const clearAuthCookies = (res: Response): void => {
  const expiredOptions = getAuthCookieOptions(0);
  res.cookie(ACCESS_TOKEN_COOKIE, "", expiredOptions);
  res.cookie(REFRESH_TOKEN_COOKIE, "", expiredOptions);
  res.cookie(LEGACY_JWT_COOKIE, "", expiredOptions);
};
