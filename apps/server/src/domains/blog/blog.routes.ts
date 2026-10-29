import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import BlogController from "./blog.controller";

const router = express.Router();
const blogController = new BlogController();

// Write
router.post("/", requireAuth, blogController.createBlog);

// Read
router.get("/", requireAuth, blogController.listFeed);
router.get("/count", requireAuth, blogController.getBlogCount);
router.get("/drafts", requireAuth, blogController.listDrafts);
router.get("/published", requireAuth, blogController.listPublished);
router.get("/bookmarks", requireAuth, blogController.listBookmarks);
router.get("/:id", requireAuth, blogController.getBlog);

// Update / Delete
router.patch("/:id", requireAuth, blogController.updateBlog);
router.delete("/:id", requireAuth, blogController.deleteBlog);

// Workflow
router.post("/:id/publish", requireAuth, blogController.publishBlog);
router.delete("/:id/schedule", requireAuth, blogController.cancelSchedule);
router.post("/:id/bookmark", requireAuth, blogController.addBookmark);
router.delete("/:id/bookmark", requireAuth, blogController.removeBookmark);

export default router;
