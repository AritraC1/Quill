import type { Request, Response, NextFunction } from "express";
import type { ClubRole } from "@quill/shared";
import ClubService from "./club.service";
import {
  parseBody,
  createClubSchema,
  updateClubSchema,
  clubApplicationSchema,
  clubApplicationDecisionSchema,
  clubInvitationSchema,
  clubRoleSchema,
  createClubSubmissionSchema,
  clubReviewSchema,
  clubMessageSchema,
  clubDirectConversationSchema,
  clubCollaboratorSchema,
  clubCollaborativeSaveSchema,
} from "../../core/validation/validation";

class ClubController {
  private clubService: ClubService;

  constructor() {
    this.clubService = new ClubService();
  }

  // Create a club (founder becomes admin, group conversation opens)
  // — POST /clubs
  createClub = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(createClubSchema, req.body);
      const result = await this.clubService.createClub(userId, data);

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // The signed-in user's clubs — GET /clubs/mine
  listMine = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listMyClubs(userId, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Discover open clubs — GET /clubs/discover?search
  listDiscover = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listDiscoverClubs(userId, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // The viewer's pending club invitations — GET /clubs/invitations
  listInvitations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listInvitations(userId, {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Accept an invitation — POST /clubs/invitations/:invitationId/accept
  acceptInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.respondToInvitation(
        String(req.params.invitationId),
        userId,
        "accepted",
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Decline an invitation — POST /clubs/invitations/:invitationId/decline
  declineInvitation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.respondToInvitation(
        String(req.params.invitationId),
        userId,
        "declined",
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // One club's detail — GET /clubs/:id
  getClub = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.getClub(
        String(req.params.id),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Update a club (rules / profile) — PATCH /clubs/:id ( admins only )
  updateClub = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(updateClubSchema, req.body);
      const result = await this.clubService.updateClub(
        String(req.params.id),
        userId,
        data,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Members list — GET /clubs/:id/members
  listMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listMembers(
        String(req.params.id),
        userId,
        {
          page: Number(req.query.page) || undefined,
          limit: Number(req.query.limit) || undefined,
        },
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Change a member's role — PATCH /clubs/:id/members/:userId (admin only)
  updateMemberRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubRoleSchema, req.body);
      const result = await this.clubService.updateMemberRole(
        String(req.params.id),
        userId,
        String(req.params.userId),
        data.role as ClubRole,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Remove a member — DELETE /clubs/:id/members/:userId (admin only)
  removeMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      await this.clubService.removeMember(
        String(req.params.id),
        userId,
        String(req.params.userId),
      );

      res.status(200).json({ success: true, data: { id: req.params.userId } });
    } catch (error) {
      next(error);
    }
  };

  // Pending join applications — GET /clubs/:id/applications (admin/moderator)
  listApplications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listApplications(
        String(req.params.id),
        userId,
        {
          page: Number(req.query.page) || undefined,
          limit: Number(req.query.limit) || undefined,
        },
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Apply to join — POST /clubs/:id/applications
  applyToClub = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubApplicationSchema, req.body);
      const result = await this.clubService.applyToClub(
        String(req.params.id),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Approve / reject — POST /clubs/:id/applications/:applicationId/decision
  decideApplication = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubApplicationDecisionSchema, req.body);
      const result = await this.clubService.decideApplication(
        String(req.params.id),
        String(req.params.applicationId),
        userId,
        data,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Invite users by handle — POST /clubs/:id/invitations
  inviteByHandle = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubInvitationSchema, req.body);
      const result = await this.clubService.inviteByHandle(
        String(req.params.id),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Review queue — GET /clubs/:id/submissions (admin/moderator)
  listSubmissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listSubmissions(
        String(req.params.id),
        userId,
        {
          page: Number(req.query.page) || undefined,
          limit: Number(req.query.limit) || undefined,
        },
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Submit a draft for review — POST /clubs/:id/submissions
  createSubmission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(createClubSubmissionSchema, req.body);
      const result = await this.clubService.createSubmission(
        String(req.params.id),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Re-submit after changes requested / rejection — POST /clubs/:id/submissions/:blogId
  resubmitSubmission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.resubmitSubmission(
        String(req.params.id),
        String(req.params.blogId),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Review decision — POST /clubs/:id/submissions/:blogId/review
  reviewSubmission = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubReviewSchema, req.body);
      const result = await this.clubService.reviewSubmission(
        String(req.params.id),
        String(req.params.blogId),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Review history — GET /clubs/:id/submissions/:blogId/reviews
  listReviews = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listReviews(
        String(req.params.id),
        String(req.params.blogId),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // The viewer's conversations in the club — GET /clubs/:id/conversations
  listConversations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listConversations(
        String(req.params.id),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Start a 1:1 with a member — POST /clubs/:id/conversations/direct
  createDirectConversation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubDirectConversationSchema, req.body);
      const result = await this.clubService.getOrCreateDirectConversation(
        String(req.params.id),
        userId,
        data.handle,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // One conversation (participants) — GET /clubs/:id/conversations/:conversationId
  getConversation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.getConversation(
        String(req.params.id),
        String(req.params.conversationId),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Messages of a conversation — GET /clubs/:id/conversations/:conversationId/messages
  listMessages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listMessages(
        String(req.params.id),
        String(req.params.conversationId),
        userId,
        {
          page: Number(req.query.page) || undefined,
          limit: Number(req.query.limit) || undefined,
        },
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Send a message — POST /clubs/:id/conversations/:conversationId/messages
  sendMessage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubMessageSchema, req.body);
      const result = await this.clubService.sendMessage(
        String(req.params.id),
        String(req.params.conversationId),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Club landing page (published posts) — GET /clubs/:id/landing
  getLandingPage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.getLandingPage(
        String(req.params.id),
        userId,
        {
          page: Number(req.query.page) || undefined,
          limit: Number(req.query.limit) || undefined,
        },
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Admin dashboard — GET /clubs/:id/dashboard (admins only)
  getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.getDashboard(
        String(req.params.id),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Collaborators of a draft — GET /clubs/:id/drafts/:blogId/collaborators
  listCollaborators = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const result = await this.clubService.listCollaborators(
        String(req.params.id),
        String(req.params.blogId),
        userId,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Add a collaborator — POST /clubs/:id/drafts/:blogId/collaborators
  addCollaborator = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubCollaboratorSchema, req.body);
      const result = await this.clubService.addCollaborator(
        String(req.params.id),
        String(req.params.blogId),
        userId,
        data,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // Remove a collaborator — DELETE /clubs/:id/drafts/:blogId/collaborators/:userId
  removeCollaborator = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      await this.clubService.removeCollaborator(
        String(req.params.id),
        String(req.params.blogId),
        userId,
        String(req.params.userId),
      );

      res.status(200).json({ success: true, data: { id: req.params.userId } });
    } catch (error) {
      next(error);
    }
  };

  // Collaborative draft save (optimistic concurrency on version)
  // — PUT /clubs/:id/drafts/:blogId
  saveCollaborativeDraft = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const data = parseBody(clubCollaborativeSaveSchema, req.body);
      const result = await this.clubService.saveCollaborativeDraft(
        String(req.params.id),
        String(req.params.blogId),
        userId,
        data,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}

export default ClubController;
