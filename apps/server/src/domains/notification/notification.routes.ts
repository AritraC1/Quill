import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import NotificationController from "./notification.controller";

const router = express.Router();
const notificationController = new NotificationController();

// All notification routes belong to the signed-in user
router.use(requireAuth);

router.get("/", notificationController.list);
router.get("/unread-count", notificationController.unreadCount);
router.patch("/read-all", notificationController.markAllRead);

// fixed paths come before the :id catch-all
router.patch("/:id/read", notificationController.markRead);
router.delete("/", notificationController.clearAll);

export default router;
