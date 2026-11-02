import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";

import { BadRequestError } from "../../core/errors";
import { UPLOAD_DIR } from "../user/avatar-upload";

// Chat Hall attachments ride the same disk layout as avatars: files land in
// UPLOAD_DIR with an unguessable name and the DB keeps only /uploads/<name>.
// The composition root already serves that directory statically (src/index.ts).

const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // mirrors the client-side 5 MB check

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) ?? "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

// Shared with the send endpoint: a JSON body passes through untouched (multer
// only parses true multipart requests), so one route handler serves both
// text-only and image messages.
export const chatImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new BadRequestError("Only JPG, PNG, GIF or WebP images are allowed"));
    } else {
      cb(null, true);
    }
  },
}).single("image");
