import type { Request, Response, NextFunction } from "express";
import NotificationService from "./notification.service";

class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  // One page of my notifications — GET /notifications?page&limit
  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const page = Number(req.query.page) || undefined;
      const limit = Number(req.query.limit) || undefined;
      const result = await this.notificationService.list(
        userId,
        page,
        limit,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Unread notifications — GET /notifications/unread-count
  unreadCount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.notificationService.unreadCount(
        req.user?.userId,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Mark one notification read — PATCH /notifications/:id/read
  markRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      await this.notificationService.markRead(
        userId,
        String(req.params.id),
      );

      res.status(200).json({
        success: true,
        data: { id: req.params.id, read: true },
      });
    } catch (error) {
      next(error);
    }
  };

  // Mark everything read — PATCH /notifications/read-all
  markAllRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.notificationService.markAllRead(
        req.user?.userId,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  // Clear my whole notification list — DELETE /notifications
  clearAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.notificationService.clearAll(
        req.user?.userId,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default NotificationController;
