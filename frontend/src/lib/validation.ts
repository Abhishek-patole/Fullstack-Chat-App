import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const SignUpFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required").trim(),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const MessageFormSchema = z.object({
  text: z.string().optional().default(""),
  imagePreview: z.string().optional().nullable(),
}).refine(
  (data) => data.text.trim() || data.imagePreview,
  { message: "Either text or image is required" }
);

export type LoginFormInput = z.infer<typeof LoginFormSchema>;
export type SignUpFormInput = z.infer<typeof SignUpFormSchema>;
export type MessageFormInput = z.infer<typeof MessageFormSchema>;
