import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import User from "../models/user.model.js";
import {
  ACCESS_TOKEN_COOKIE,
  LEGACY_JWT_COOKIE,
} from "../lib/utils.js";

type AuthRequest = Request & {
  user?: unknown;
};

type JwtPayload = {
  userId: string;
};

const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
  } catch {
    return null;
  }
};

export const protectRoute = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = req.cookies[ACCESS_TOKEN_COOKIE] || req.cookies[LEGACY_JWT_COOKIE];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token provided" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized - Token invalid or expired" });
    }

    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log("Error in protection middleware : ", error.message);
    } else {
      console.log("Error in protection middleware : ", error);
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};
