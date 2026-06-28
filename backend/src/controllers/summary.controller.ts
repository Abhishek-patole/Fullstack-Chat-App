import type { Request, Response } from "express";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

type AuthRequest = Request & {
  user?: any;
};

export const summarizeChat = async (req: AuthRequest, res: Response) => {
  try {
    const { id: chatUserId } = req.params;
    const myId = req.user?._id;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ summary: "Gemini API key is not configured." });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: chatUserId },
        { senderId: chatUserId, receiverId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50); // Get last 50 messages, ordered newest to oldest

    // Reverse them to be oldest to newest for context
    messages.reverse();

    if (messages.length === 0) {
      return res.status(200).json({
        summary: "No conversation history to summarize yet. Send a few messages to get started!",
      });
    }

    // Fetch user details for clean names in the prompt
    const [me, chatUser] = await Promise.all([
      User.findById(myId).select("fullName"),
      User.findById(chatUserId).select("fullName"),
    ]);

    const myName = me?.fullName || "User 1";
    const chatUserName = chatUser?.fullName || "User 2";

    // Format chat log
    const formattedChatLog = messages
      .map((msg) => {
        const sender = String(msg.senderId) === String(myId) ? myName : chatUserName;
        const text = msg.text || (msg.image ? "[Sent an image]" : "");
        return `${sender}: ${text}`;
      })
      .join("\n");

    const prompt = `You are a helpful chat assistant. Summarize the following conversation in a professional and concise manner.
Please structure your response strictly using these three sections:

**💬 Brief Overview**
(1-2 sentence high-level summary of the conversation context)

**📌 Key Discussion Points**
(Bullet points of the main topics discussed)

**✅ Action Items & Decisions**
(Bullet points of any agreements or tasks, if any)

Here is the conversation log:
${formattedChatLog}
`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ summary: text });
  } catch (error) {
    console.log("Error in summarizeChat controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
