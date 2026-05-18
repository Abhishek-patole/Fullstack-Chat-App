import express from "express";
import http from "http";
import { Server, type Socket } from "socket.io";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

const userSocketMap: Record<string, string> = {};

export function getReceiverSocketId(userId: string): string | undefined {
  return userSocketMap[userId];
}

io.on("connection", (socket: Socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (typeof userId === "string") {
    userSocketMap[userId] = socket.id;
  }

  // When a user reconnects, mark pending "sent" messages as delivered
  // and notify online senders so their single tick becomes double tick.
  if (typeof userId === "string") {
    void (async () => {
      try {
        const pendingMessages = await Message.find({
          receiverId: userId,
          status: "sent",
        }).select("_id senderId receiverId");

        if (pendingMessages.length === 0) return;

        const deliveredAt = new Date();
        const pendingIds = pendingMessages.map((m) => m._id);

        await Message.updateMany(
          { _id: { $in: pendingIds } },
          {
            $set: {
              status: "delivered",
              deliveredAt,
            },
          }
        );

        pendingMessages.forEach((message) => {
          const senderSocketId = getReceiverSocketId(String(message.senderId));
          if (senderSocketId) {
            io.to(senderSocketId).emit("messageStatusUpdated", {
              messageId: message._id,
              status: "delivered",
              deliveredAt,
              receiverId: message.receiverId,
            });
          }
        });
      } catch (error) {
        console.log("Error in pending delivery sync : ", error);
      }
    })();
  }

  socket.on("messageSeen", async ({ messageId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message || message.status === "seen") return;

      message.status = "seen";
      message.isRead = true;
      message.readAt = new Date();
      await message.save();

      const senderSocketId = getReceiverSocketId(String(message.senderId));
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageStatusUpdated", {
          messageId: message._id,
          status: "seen",
          readAt: message.readAt,
          receiverId: message.receiverId,
        });
      }
    } catch (error) {
      console.log("Error in messageSeen socket handler : ", error);
    }
  });

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (typeof userId === "string") {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
