import type { Request, Response } from "express";
import { ZodError } from "zod";
import cloudinary from "../lib/cloudinary.js";
import { isWithinEditWindow } from "../lib/messageLifecycle.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import {
  EditMessageSchema,
  SendMessageSchema,
  ReceiverIdSchema,
} from "../schemas/message.schema.js";

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

    const unreadMessages = await Message.find({
      senderId: userToChatId,
      receiverId: myId,
      isRead: false,
    }).select("_id");

    const unreadMessageIds = unreadMessages.map((message) => message._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
            status: "seen",
          },
        }
      );
    }

    if (unreadMessages.length > 0) {
      const senderSocketId = getReceiverSocketId(String(userToChatId));
      if (senderSocketId) {
        unreadMessages.forEach((m) => {
          io.to(senderSocketId).emit("messageStatusUpdated", {
            messageId: m._id,
            status: "seen",
            readAt: new Date(),
            receiverId: myId,
          });
        });
      }
    }

    res.status(200).json(messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
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

    let responseMessage = newMessage;

    const receiverSocketId = getReceiverSocketId(String(receiverId));
    if (receiverSocketId) {
      // mark delivered since recipient is online and will receive the socket event
      const deliveredAt = new Date();
      const updatedMessage = await Message.findByIdAndUpdate(
        newMessage._id,
        { status: "delivered", deliveredAt },
        { new: true }
      );

      if (updatedMessage) {
        responseMessage = updatedMessage;
      }

      io.to(receiverSocketId).emit("newMessage", updatedMessage || newMessage);

      // notify the sender (if connected) that message was delivered
      const senderSocketId = getReceiverSocketId(String(senderId));
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageStatusUpdated", {
          messageId: updatedMessage?._id || newMessage._id,
          status: "delivered",
          deliveredAt,
          receiverId,
        });
      }
    }

    res.status(201).json(responseMessage);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }
    console.log("Error in sendMessage controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const editMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const { text } = EditMessageSchema.parse(req.body);
    const currentUserId = String(req.user?._id);

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (String(message.senderId) !== currentUserId) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }

    if (message.isDeleted) {
      return res.status(400).json({ message: "Deleted messages cannot be edited" });
    }

    if (!isWithinEditWindow(message.createdAt)) {
      return res.status(400).json({ message: "Message edit window has expired" });
    }

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const receiverSocketId = getReceiverSocketId(String(message.receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageUpdated", message);
    }

    const senderSocketId = getReceiverSocketId(currentUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageUpdated", message);
    }

    res.status(200).json(message);
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldError = error.issues[0];
      return res.status(400).json({ message: fieldError.message });
    }
    console.log("Error in editMessage controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id: messageId } = req.params;
    const currentUserId = String(req.user?._id);

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (String(message.senderId) !== currentUserId) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    if (message.isDeleted) {
      return res.status(200).json(message);
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = message.senderId;
    message.text = "";
    message.image = undefined;
    await message.save();

    const receiverSocketId = getReceiverSocketId(String(message.receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", {
        messageId: message._id,
        deletedAt: message.deletedAt,
        deletedBy: message.deletedBy,
      });
    }

    const senderSocketId = getReceiverSocketId(currentUserId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageDeleted", {
        messageId: message._id,
        deletedAt: message.deletedAt,
        deletedBy: message.deletedBy,
      });
    }

    res.status(200).json(message);
  } catch (error) {
    console.log("Error in deleteMessage controller : ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
