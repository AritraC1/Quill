import { z } from "zod";
import { BadRequestError } from "../errors";

// The repo installed zod but never used it for request bodies — payloads were
// hand-checked inconsistently (or not at all). These schemas are the core
// write endpoints' contracts; `parseBody` throws the standard 400 shape.

export const signUpSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().email(),
});

export const requestOtpSchema = z.object({
  email: z.string().trim().email(),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(4),
});

export const onboardSchema = z.object({
  avatar: z.string().max(10_000_000).optional(), // URL path or legacy data-URL
  bio: z.string().max(500).optional(),
  favGenre: z.array(z.string().max(40)).min(1).max(5),
});

export const editProfileSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  avatar: z.string().max(10_000_000).optional(),
  bio: z.string().max(500).optional(),
  favGenre: z.array(z.string().max(40)).min(1).max(5),
  handle: z.string().trim().max(30).optional(),
  website: z.string().max(100).optional(),
});

export const createBlogSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500_000).optional(),
  description: z.string().max(500).optional(),
  images: z.array(z.string().max(2048)).max(20).optional(),
});

export const updateBlogSchema = createBlogSchema;

export const publishBlogSchema = z.object({
  publishAt: z.string().datetime().optional(),
});

type Schema = z.ZodType;

/** Validate `payload` against `schema` or throw the standard 400 */
export function parseBody<T extends Schema>(
  schema: T,
  payload: unknown,
): z.infer<T> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new BadRequestError(
      first
        ? `${first.path.join(".") || "body"}: ${first.message}`
        : "Invalid request body",
    );
  }
  return result.data;
}
