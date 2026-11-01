import express from "express";
import { requireAuth } from "../auth/auth.middleware";
import ClubController from "./club.controller";

const router = express.Router();
const clubController = new ClubController();

// Everything below is member-scoped or viewer-scoped, so every club route
// requires the access token (the same posture as /blogs and /notifications)
router.use(requireAuth);

// List / discover — fixed paths first so ":id" never swallows them
router.post("/", clubController.createClub);
router.get("/mine", clubController.listMine);
router.get("/discover", clubController.listDiscover);
router.get("/invitations", clubController.listInvitations);
router.post("/invitations/:invitationId/accept", clubController.acceptInvitation);
router.post("/invitations/:invitationId/decline", clubController.declineInvitation);

// Landing page & dashboard
router.get("/:id/landing", clubController.getLandingPage);
router.get("/:id/dashboard", clubController.getDashboard);

// Club detail / update
router.get("/:id", clubController.getClub);
router.patch("/:id", clubController.updateClub);

// Membership
router.get("/:id/members", clubController.listMembers);
router.patch("/:id/members/:userId", clubController.updateMemberRole);
router.delete("/:id/members/:userId", clubController.removeMember);

// Join applications (open clubs)
router.get("/:id/applications", clubController.listApplications);
router.post("/:id/applications", clubController.applyToClub);
router.post(
  "/:id/applications/:applicationId/decision",
  clubController.decideApplication,
);

// Invitations (invite-only clubs use these; open clubs can invite too)
router.post("/:id/invitations", clubController.inviteByHandle);

// Review workflow: submissions in, decisions recorded, drafts out
router.get("/:id/submissions", clubController.listSubmissions);
router.post("/:id/submissions", clubController.createSubmission);
router.post("/:id/submissions/:blogId/review", clubController.reviewSubmission);
router.get("/:id/submissions/:blogId/reviews", clubController.listReviews);
router.post("/:id/submissions/:blogId/resubmit", clubController.resubmitSubmission);

// Chat: the club group conversation + member 1:1 conversations.
// Delivered as ordinary request/response endpoints; the client polls them —
// no websocket transport exists in this stack yet.
router.get("/:id/conversations", clubController.listConversations);
router.post("/:id/conversations/direct", clubController.createDirectConversation);
router.get(
  "/:id/conversations/:conversationId",
  clubController.getConversation,
);
router.get(
  "/:id/conversations/:conversationId/messages",
  clubController.listMessages,
);
router.post(
  "/:id/conversations/:conversationId/messages",
  clubController.sendMessage,
);

// Collaborative writing: club drafts edited by the author + collaborators
// with optimistic concurrency (version) — not a live simultaneous editor
router.get("/:id/drafts/:blogId/collaborators", clubController.listCollaborators);
router.post("/:id/drafts/:blogId/collaborators", clubController.addCollaborator);
router.delete(
  "/:id/drafts/:blogId/collaborators/:userId",
  clubController.removeCollaborator,
);
router.put("/:id/drafts/:blogId", clubController.saveCollaborativeDraft);

export default router;
