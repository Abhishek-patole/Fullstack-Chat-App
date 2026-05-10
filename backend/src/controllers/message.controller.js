import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

export const getUserForSideBar = async (req,res) => {
    try {
        const loggedInUserId = req.user._id;
        const fillerUser = await User.find({ _id: { $ne: loggedInUserId}}).select("-password");
        
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
                }
            })
        )

        res.status(200).json(usersWithUnreadCount);
    } catch (error) {
        console.log("Error in getUserSideBar controller : ", error);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId} = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
              { senderId: myId, receiverId: userToChatId },
              { senderId: userToChatId, receiverId: myId },
            ],
          });

          // clear the unread messages
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
                }
            }
          )

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages controller : ", error);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const sendMessage = async (req,res) => {
    try {
        const {text, image} = req.body;
        const {id : receiverId} = req.params;
        const senderId = req.user._id

        let imageUrl;
        if(image){
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
        })

        await newMessage.save();

        const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
        
        res.status(201).json(newMessage)
    } catch (error) {
        console.log("Error in sendMessage controller : ", error);
        res.status(500).json({message: "Internal Server Error"});
    }
}