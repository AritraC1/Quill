import { z } from "zod";
import { BadRequestError } from "../errors";
import { SETTINGS_GENRES } from "@quill/shared";

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

// PUT /user/settings — the complete page state. Unknown keys (including any
// sneaky "userId") are stripped; the user id always comes from the token.
export const settingsNotificationsSchema = z.object({
  appPosts: z.boolean(),
  appFollowers: z.boolean(),
  appScheduled: z.boolean(),
  appReplies: z.boolean(),
  emailDigest: z.boolean(),
  emailFollowers: z.boolean(),
  emailNews: z.boolean(),
});

export const userSettingsSchema = z.object({
  genres: z.array(z.string().trim().min(1).max(40)).max(20),
  defaultTab: z.enum(["for-you", "following"]),
  textSize: z.number().int().min(15).max(24),
  theme: z.enum(["light", "sepia", "dark"]),
  notifications: settingsNotificationsSchema,
});

export const createBlogSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500_000).optional(),
  description: z.string().max(500).optional(),
  genres: z.array(z.enum(SETTINGS_GENRES)).max(5).optional(),
  // images: z.array(z.string().max(10_000)).max(20).optional(),
});

export const updateBlogSchema = createBlogSchema;

export const publishBlogSchema = z.object({
  publishAt: z.string().datetime().optional(),
});

export const createCommentSchema = z.object({
  // A comment body: non-empty after trimming, capped ~ tweet-sized threads
  body: z.string().trim().min(1).max(5_000),
  parentCommentId: z.string().uuid().optional(),
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const commentReactionSchema = z.object({
  reactionType: z.enum(["like", "heart"]),
});

export const readingProgressSchema = z.object({
  sessionId: z.string().uuid(),
  activeSeconds: z.number().int().min(0).max(86_400),
  maxScrollPercent: z.number().int().min(0).max(100),
});

// -------------- CLUBS -------------- //

const clubRuleSchema = z
  .string()
  .trim()
  .min(1)
  .max(200); // one UI line per rule

const createClubSchemaBase = z.object({
  name: z.string().trim().min(2).max(60), // matches the DB CHECK 2–60
  description: z.string().trim().min(1).max(1000),
  privacy: z.enum(["open", "invite"]),
  rules: z.array(clubRuleSchema).max(20).optional(),
  inviteHandles: z.array(z.string().trim().min(1).max(30)).max(50).optional(),
});

export const createClubSchema = createClubSchemaBase;

// PATCH /clubs/:id — admin partial update ("Save rules" sends only rules)
export const updateClubSchema = createClubSchemaBase
  .extend({
    name: createClubSchemaBase.shape.name.optional(),
    description: createClubSchemaBase.shape.description.optional(),
  })
  .partial()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.privacy !== undefined ||
      data.rules !== undefined,
    { message: "Nothing to update" },
  );

export const clubApplicationSchema = z.object({
  note: z.string().trim().min(1).max(500), // matches the DB CHECK 1–500
});

export const clubApplicationDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

export const clubInvitationSchema = z.object({
  handles: z.array(z.string().trim().min(1).max(30)).min(1).max(50),
});

export const clubRoleSchema = z.object({
  role: z.enum(["admin", "moderator", "member"]),
});

export const createClubSubmissionSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500_000).optional(),
  description: z.string().max(500).optional(),
  genres: z.array(z.enum(SETTINGS_GENRES)).max(5).optional(),
});

export const clubReviewSchema = z.object({
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const clubMessageSchema = z.object({
  body: z.string().trim().min(1).max(5_000), // matches the DB CHECK 1–5000
});

export const clubDirectConversationSchema = z.object({
  handle: z.string().trim().min(1).max(30),
});

export const clubCollaboratorSchema = z.object({
  handle: z.string().trim().min(1).max(30),
});

// PUT /clubs/:id/drafts/:blogId — collaborative save; version drives the
// optimistic-concurrency check (stale versions answer 409)
export const clubCollaborativeSaveSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(500_000).optional(),
  description: z.string().max(500).optional(),
  version: z.number().int().min(1),
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
