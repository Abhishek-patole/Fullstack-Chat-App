import { z } from "zod";

export const SignupSchema = z.object({
  fullName: z.string().min(1, "Full name is required").trim(),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const GoogleAuthSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
