import type { Request, Response } from "express";
import { ZodError } from "zod";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { SendMessageSchema, ReceiverIdSchema } from "../schemas/message.schema.js";

type AuthRequest = Request & {
  user?: any;
};

export const getUserForSideBar = async (req: AuthRequest, res: Response) => {
  try {
    const loggedInUserId = req.user?._id;
    const fillerUser = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    const usersWithUnreadCount = await Promise.all(
      fillerUser.map(async (user) => {
        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          isRead: false,
        });

        return {
          ...user.toObject(),
          unreadCount,
        };
      })
    );

    res.status(200).json(usersWithUnreadCount);
  } catch (error) {
    console.log("Error in getUserSideBar controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user?._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    await Message.updateMany(
      {
        senderId: userToChatId,
        receiverId: myId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const validatedBody = SendMessageSchema.parse(req.body);
    const validatedParams = ReceiverIdSchema.parse(req.params);
    const { text, image } = validatedBody;
    const { id: receiverId } = validatedParams;
    const senderId = req.user?._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(String(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }
    console.log("Error in sendMessage controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
