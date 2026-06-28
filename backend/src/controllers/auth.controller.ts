import type { Request, Response } from "express";
import { ZodError } from "zod";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import {
  clearAuthCookies,
  generateAuthTokens,
  generateToken,
  hashToken,
  normalizeProfilePic,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
} from "../lib/utils.js";
import User from "../models/user.model.js";
import { SignupSchema, LoginSchema, GoogleAuthSchema } from "../schemas/auth.schema.js";
import RefreshSession from "../models/refreshSession.model.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

type AuthRequest = Request & {
  user?: any;
};

type AuthProvider = "local" | "google";

type JwtRefreshPayload = {
  userId: string;
  sessionId: string;
};

type GoogleTokenPayload = {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createAuthResponse = async (userId: string, res: Response): Promise<void> => {
  const { accessToken, refreshToken, refreshTokenId } = generateAuthTokens(userId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await RefreshSession.create({
    userId,
    tokenId: refreshTokenId,
    tokenHash,
    expiresAt,
  });

  setAuthCookies(res, accessToken, refreshToken);
};

const resolveGoogleUser = async (payload: GoogleTokenPayload) => {
  if (!payload.sub || !payload.email || !payload.name) {
    throw new Error("Invalid Google token payload");
  }

  const existingByEmail = await User.findOne({ email: payload.email });

  if (existingByEmail) {
    const updatedUser = await User.findByIdAndUpdate(
      existingByEmail._id,
      {
        $set: {
          fullName: existingByEmail.fullName || payload.name,
          profilePic: existingByEmail.profilePic || payload.picture || "",
          authProvider: existingByEmail.authProvider || "google",
          providerId: existingByEmail.providerId || payload.sub,
          emailVerified: true,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error("Failed to update Google-linked account");
    }

    return updatedUser;
  }

  const newUser = await User.create({
    email: payload.email,
    fullName: payload.name,
    profilePic: payload.picture || "",
    authProvider: "google" satisfies AuthProvider,
    providerId: payload.sub,
    emailVerified: payload.email_verified ?? true,
  });

  return newUser;
};

export const signup = async (req: Request, res: Response) => {
  try {
    const validatedData = SignupSchema.parse(req.body);
    const { fullName, email, password } = validatedData;

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      authProvider: "local" satisfies AuthProvider,
      emailVerified: true,
    });

    if (newUser) {
      await newUser.save();
      await createAuthResponse(String(newUser._id), res);

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: normalizeProfilePic(newUser.toObject()).profilePic,
      });
    } else {
      return res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }
    console.log("Error in signup controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const validatedData = LoginSchema.parse(req.body);
    const { email, password } = validatedData;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.authProvider === "google" && !user.password) {
      return res.status(400).json({ message: "Use Google login for this account" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    await createAuthResponse(String(user._id), res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: normalizeProfilePic(user.toObject()).profilePic,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }
    console.log("Error in login controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = async (_req: Request, res: Response) => {
  try {
    const refreshToken = _req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET as string) as JwtRefreshPayload;
        await RefreshSession.findOneAndUpdate(
          { tokenId: decoded.sessionId, userId: decoded.userId },
          { $set: { revokedAt: new Date() } }
        );
      } catch {
        // Best-effort revocation. Cookie clearing below still invalidates the browser session.
      }
    }

    clearAuthCookies(res);
    res.status(200).json({ message: "Logout Successfully" });
  } catch (error) {
    console.log("Error in logout controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const refreshAuth = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No refresh token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtRefreshPayload;
    const tokenHash = hashToken(token);

    const session = await RefreshSession.findOne({
      tokenId: decoded.sessionId,
      userId: decoded.userId,
      tokenHash,
      revokedAt: null,
    });

    if (!session) {
      return res.status(401).json({ message: "Unauthorized - Refresh session invalid" });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { accessToken, refreshToken, refreshTokenId } = generateAuthTokens(String(user._id));
    const nextTokenHash = hashToken(refreshToken);

    await RefreshSession.findOneAndUpdate(
      { _id: session._id },
      {
        $set: {
          tokenId: refreshTokenId,
          tokenHash: nextTokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }
    );

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: normalizeProfilePic(user.toObject()).profilePic,
    });
  } catch (error) {
    console.log("Error in refreshAuth controller : ", error);
    clearAuthCookies(res);
    return res.status(401).json({ message: "Unauthorized - Unable to refresh session" });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const validatedData = GoogleAuthSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken: validatedData.credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as GoogleTokenPayload | undefined;

    if (!payload || payload.email_verified !== true) {
      return res.status(401).json({ message: "Unauthorized - Google account not verified" });
    }

    const user = await resolveGoogleUser(payload);

    await createAuthResponse(String(user._id), res);

    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: normalizeProfilePic(user.toObject()).profilePic,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }

    console.log("Error in googleAuth controller : ", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user?._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is needed" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);
    const updateedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(updateedUser ? normalizeProfilePic(updateedUser.toObject()) : updateedUser);
  } catch (error) {
    console.log("Error in updateProfile controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req: AuthRequest, res: Response) => {
  try {
    res.status(200).json(req.user ? normalizeProfilePic(req.user.toObject ? req.user.toObject() : req.user) : req.user);
  } catch (error) {
    console.log("Error in checkAuth controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
