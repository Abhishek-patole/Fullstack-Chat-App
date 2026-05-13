import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import User from "../models/user.model.js";

type AuthRequest = Request & {
  user?: unknown;
};

type JwtPayload = {
  userId: string;
};

export const protectRoute = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ message: "UnAuthorized- No Token Provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    if (!decoded) {
      return res.status(400).json({ message: "UnAuthorized- Token Invalid" });
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
