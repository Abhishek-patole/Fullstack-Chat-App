import express from "express";
import {
  deleteMessage,
  editMessage,
  getMessages,
  getUserForSideBar,
  sendMessage,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/users", protectRoute, getUserForSideBar);
router.post("/send/:id", protectRoute, sendMessage);
router.patch("/:id", protectRoute, editMessage);
router.delete("/:id", protectRoute, deleteMessage);
router.get("/:id", protectRoute, getMessages);

export default router;
