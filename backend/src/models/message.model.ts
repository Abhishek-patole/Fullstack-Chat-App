import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
      // lifecycle status: 'sent' | 'delivered' | 'seen'
      status: {
        type: String,
        enum: ["sent", "delivered", "seen"],
        default: "sent",
      },

      // when the message was delivered to the recipient's device
      deliveredAt: {
        type: Date,
        default: null,
      },
      isRead: {
        type: Boolean,
        default: false,
      },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
