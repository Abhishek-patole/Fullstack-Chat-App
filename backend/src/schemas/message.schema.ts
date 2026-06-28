import { z } from "zod";

export const SendMessageSchema = z.object({
  text: z.string().optional().default(""),
  image: z.string().optional().nullable(),
}).refine(
  (data) => data.text.trim() || data.image,
  { message: "Either text or image is required" }
);

export const ReceiverIdSchema = z.object({
  id: z.string().min(1, "Receiver ID is required"),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type ReceiverIdInput = z.infer<typeof ReceiverIdSchema>;
