import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";

import { BadRequestError } from "../../core/errors";

// Avatars were previously stored as base64 data-URLs inside `users.avatar`,
// which bloats every join (feed, blog, profile) and ran into the JSON body
// limit. Images now live on disk and the DB column keeps only a small URL.

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const ALLOWED = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // mirrors the client-side 5 MB check

// Streams requested files (multipart/form-data) straight to disk with a
// random, extension-guessable name — the client never names the file
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED.get(file.mimetype) ?? "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

export const avatarUpload = multer({
  storage,
  limits: {
    fileSize: MAX_AVATAR_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new BadRequestError("Only JPG, PNG or WebP images are allowed"));
    } else {
      cb(null, true);
    }
  },
}).single("avatar");
