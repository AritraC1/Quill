// Club service — business rules for the "My Clubs" feature. Repositories do
// the persisting (this file never writes SQL); the notification joins are
// best-effort fan-outs that never fail the club operation itself.
import type {
  BlogResponseDTO,
  ClubActivityType,
  ClubApplicationDecisionDTO,
  ClubApplicationDTO,
  ClubApplicationListDTO,
  ClubCollaborativeSaveDTO,
  ClubCollaborativeSaveResultDTO,
  ClubCollaboratorDTO,
  ClubCollaboratorListDTO,
  ClubConversationDTO,
  ClubConversationListDTO,
  ClubDTO,
  ClubDashboardDTO,
  ClubInvitationDTO,
  ClubInvitationListDTO,
  ClubInvitationResponseDTO,
  ClubInvitationResultDTO,
  ClubLandingDTO,
  ClubListDTO,
  ClubMemberDTO,
  ClubMemberListDTO,
  ClubMessageDTO,
  ClubMessageListDTO,
  ClubReviewDTO,
  ClubReviewListDTO,
  ClubSubmissionDTO,
  ClubSubmissionListDTO,
  ClubUserDTO,
  CreateClubDTO,
  CreateClubApplicationDTO,
  CreateClubCollaboratorDTO,
  CreateClubInvitationDTO,
  CreateClubMessageDTO,
  CreateClubReviewDTO,
  CreateClubSubmissionDTO,
  UpdateClubDTO,
} from "@quill/shared";
import ClubRepository from "./club.repository";
import type {
  ClubApplicationWithUserModel,
  ClubConversationModel,
  ClubConversationWithParticipantsModel,
  ClubInvitationWithContextModel,
  ClubMemberWithUserModel,
  ClubModel,
  ClubReviewModel,
  ClubReviewWithReviewerModel,
  ClubRole,
  ClubWithMembershipModel,
  ClubActivityWithActorModel,
} from "./club.model";
import BlogRepository from "../blog/blog.repository";
import type { BlogWithAuthorModel } from "../blog/blog.model";
import { toBlogResponse } from "../blog/blog.service";
import UserRepository from "../user/user.repository";
import NotificationService from "../notification/notification.service";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";
import { logger } from "../../core/logger/logger";

// Pagination guard rails (identical to the blog feed)
const MAX_LIMIT = 50;

// Round-trip view of the participants json_agg (club.repository builds it with
// json_build_object — the extra *_name/handle/avatar keys are joined profile
// fields beyond ClubConversationParticipantModel)
interface ParticipantJson {
  user_id: string;
  user_name: string | null;
  user_handle: string | null;
  user_avatar: string | null;
}

function toUserDTO(
  user:
    | {
        id: string;
        name?: string | null;
        handle?: string | null;
        avatar?: string | null;
      }
    | {
        user_id: string;
        user_name?: string | null;
        user_handle?: string | null;
        user_avatar?: string | null;
      },
): ClubUserDTO {
  const isUserProfile = "id" in user;
  return {
    id: isUserProfile ? user.id : user.user_id,
    name: (isUserProfile ? user.name : user.user_name) ?? "",
    handle: (isUserProfile ? user.handle : user.user_handle) ?? null,
    avatar: (isUserProfile ? user.avatar : user.user_avatar) ?? null,
  };
}

function toClubDTO(row: ClubWithMembershipModel): ClubDTO {
  const canModerate = row.role === "admin" || row.role === "moderator";
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    privacy: row.privacy as ClubDTO["privacy"],
    rules: row.rules ?? [],
    role: (row.role as ClubDTO["role"]) ?? null,
    memberCount: Number(row.member_count),
    // The review queue count is only meaningful to admins/moderators — the
    // cards of plain members and Discover never show a queue
    pendingReviews: canModerate ? Number(row.pending_reviews) : 0,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toMemberDTO(row: ClubMemberWithUserModel): ClubMemberDTO {
  return {
    ...toUserDTO(row),
    role: row.role as ClubMemberDTO["role"],
    joinedAt: new Date(row.joined_at).toISOString(),
  };
}

function toApplicationDTO(
  row: ClubApplicationWithUserModel,
): ClubApplicationDTO {
  return {
    id: row.id,
    clubId: row.club_id,
    user: toUserDTO(row),
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toInvitationDTO(
  row: ClubInvitationWithContextModel,
): ClubInvitationDTO {
  return {
    id: row.id,
    club: {
      id: row.club_id,
      name: row.club_name,
      privacy: row.club_privacy as ClubInvitationDTO["club"]["privacy"],
    },
    inviter: {
      id: row.inviter_id,
      name: row.inviter_name,
      handle: row.inviter_handle ?? null,
      avatar: row.inviter_avatar ?? null,
    },
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toSubmissionDTO(blog: BlogWithAuthorModel): ClubSubmissionDTO {
  return {
    id: blog.id,
    title: blog.title,
    description: blog.description ?? blog.blog_description ?? "",
    author: {
      id: blog.user_id,
      name: blog.author_name ?? "",
      handle: blog.author_handle ?? null,
      avatar: blog.author_avatar ?? null,
    },
    words: Number(blog.word_count ?? 0),
    submittedAt: new Date(blog.created_at).toISOString(),
  };
}

function toReviewDTO(
  row: ClubReviewModel & Partial<ClubReviewWithReviewerModel>,
): ClubReviewDTO {
  return {
    id: row.id,
    blogId: row.blog_id,
    clubId: row.club_id,
    decision: row.decision as ClubReviewDTO["decision"],
    note: row.note ?? null,
    reviewer: row.reviewer_id
      ? {
          id: row.reviewer_id,
          name: row.reviewer_name ?? "",
          handle: row.reviewer_handle ?? null,
          avatar: row.reviewer_avatar ?? null,
        }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toMessageDTO(row: {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: Date;
  sender_name?: string | null;
  sender_handle?: string | null;
  sender_avatar?: string | null;
}): ClubMessageDTO {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: {
      id: row.sender_id,
      name: row.sender_name ?? "",
      handle: row.sender_handle ?? null,
      avatar: row.sender_avatar ?? null,
    },
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toConversationDTO(
  row: ClubConversationWithParticipantsModel,
): ClubConversationDTO {
  const participants = (row.participants as unknown as ParticipantJson[]) ?? [];
  return {
    id: row.id,
    clubId: row.club_id,
    isGroup: row.is_group,
    updatedAt: new Date(row.updated_at).toISOString(),
    participants: participants.map((p) => ({
      id: p.user_id,
      name: p.user_name ?? "",
      handle: p.user_handle ?? null,
      avatar: p.user_avatar ?? null,
    })),
  };
}

function toActivityDTO(
  row: ClubActivityWithActorModel,
): ClubDashboardDTO["recentActivity"][number] {
  return {
    id: row.id,
    type: row.type as ClubDashboardDTO["recentActivity"][number]["type"] &
      ClubActivityType,
    detail: row.detail,
    actor: row.actor_id
      ? {
          id: row.actor_id,
          name: row.actor_name ?? "",
          handle: row.actor_handle ?? null,
          avatar: row.actor_avatar ?? null,
        }
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

class ClubService {
  private clubRepo: ClubRepository;
  private blogRepo: BlogRepository;
  private userRepo: UserRepository;
  private notificationService: NotificationService;

  constructor() {
    this.clubRepo = new ClubRepository();
    this.blogRepo = new BlogRepository();
    this.userRepo = new UserRepository();
    this.notificationService = new NotificationService();
  }

  // ---------- guards ----------

  private parsePageLimit(query: { page?: number; limit?: number }): {
    page: number;
    limit: number;
  } {
    const page = Math.max(Math.floor(Number(query.page) || 1), 1);
    const limit = Math.min(
      Math.max(Math.floor(Number(query.limit) || 10), 1),
      MAX_LIMIT,
    );
    return { page, limit };
  }

  // The club must exist; viewers outside of invite-only clubs are told the
  // same thing discovery tells them — nothing (404 keeps the club invisible)
  private async requireVisibleClub(
    clubId: string,
    viewerId: string,
  ): Promise<ClubWithMembershipModel> {
    const club = await this.clubRepo.findByIdWithMembership(clubId, viewerId);
    if (!club) {
      throw new NotFoundError("Club not found");
    }
    if (club.privacy === "invite" && !club.role) {
      throw new NotFoundError("Club not found");
    }
    return club;
  }

  private async requireMembership(
    clubId: string,
    userId: string,
  ): Promise<ClubRole> {
    const membership = await this.clubRepo.getMembership(clubId, userId);
    if (!membership) {
      throw new ForbiddenError("Only club members can do that");
    }
    return membership.role as ClubRole;
  }

  private async requireCanModerate(
    clubId: string,
    userId: string,
  ): Promise<ClubRole> {
    const role = await this.requireMembership(clubId, userId);
    if (role !== "admin" && role !== "moderator") {
      throw new ForbiddenError("Only admins and moderators can do that");
    }
    return role;
  }

  private async requireAdmin(clubId: string, userId: string): Promise<void> {
    const role = await this.requireMembership(clubId, userId);
    if (role !== "admin") {
      throw new ForbiddenError("Only club admins can do that");
    }
  }

  // Display name for the prebuilt activity sentences
  private async userName(userId: string): Promise<string> {
    const user = await this.userRepo.findById(userId);
    return user?.name ?? "Someone";
  }

  // Best-effort activity logging — metrics are nice-to-have, the action
  // itself (membership change, review decision) has already succeeded
  private async logActivity(
    clubId: string,
    actorId: string | null,
    type: ClubActivityType,
    detail: string,
  ): Promise<void> {
    try {
      await this.clubRepo.logActivity({ clubId, actorId, type, detail });
    } catch (error) {
      logger.warn({ error, clubId, type }, "Could not log club activity");
    }
  }

  // ---------- clubs ----------

  // Creating a club makes the creator its admin AND opens the club's group
  // conversation they belong to — membership, conversation and participant row
  // land in one transaction (see club repository).
  async createClub(userId: string, data: CreateClubDTO): Promise<ClubDTO> {
    const club = await this.clubRepo.create({
      name: data.name,
      description: data.description,
      privacy: data.privacy,
      rules: data.rules ?? [],
      createdBy: userId,
    });

    const founder = await this.userName(userId);
    await this.clubRepo.createFounderMembership({
      clubId: club.id,
      userId,
      activity: {
        actorId: userId,
        type: "member_joined",
        detail: `${founder} founded the club`,
      },
    });

    // Invitations collected in the create modal — only real members-to-be get
    // them (unknown handles are skipped, never fatal to the club creation)
    if (data.inviteHandles?.length) {
      await this.inviteByHandle(club.id, userId, {
        handles: data.inviteHandles,
      });
    }

    const withMembership = await this.clubRepo.findByIdWithMembership(
      club.id,
      userId,
    );
    return toClubDTO(
      withMembership ?? {
        ...club,
        role: "admin",
        member_count: 1,
        pending_reviews: 0,
      },
    );
  }

  // "Save rules" / profile edits — admins only
  async updateClub(
    clubId: string,
    userId: string,
    data: UpdateClubDTO,
  ): Promise<ClubDTO> {
    const existing = await this.clubRepo.findById(clubId);
    if (!existing) {
      throw new NotFoundError("Club not found");
    }
    await this.requireAdmin(clubId, userId);

    const updated = await this.clubRepo.update(clubId, data);
    if (!updated) {
      throw new NotFoundError("Club not found");
    }
    const withMembership = await this.clubRepo.findByIdWithMembership(
      clubId,
      userId,
    );
    return toClubDTO(
      withMembership ?? {
        ...updated,
        role: "admin",
        member_count: 0,
        pending_reviews: 0,
      },
    );
  }

  // A member's view of one club (members see everything; others only "open")
  async getClub(clubId: string, viewerId: string): Promise<ClubDTO> {
    const club = await this.requireVisibleClub(clubId, viewerId);
    return toClubDTO(club);
  }

  // "Your clubs" tab
  async listMyClubs(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubListDTO> {
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.clubRepo.listUserClubs(userId, page, limit);
    return {
      items: result.items.map(toClubDTO),
      total: result.total,
    };
  }

  // "Discover" tab — only open clubs, never the viewer's own
  async listDiscoverClubs(
    userId: string,
    query: { page?: number; limit?: number; search?: string },
  ): Promise<ClubListDTO> {
    const { page, limit } = this.parsePageLimit(query);
    const search = query.search?.trim();
    const result = await this.clubRepo.listDiscoverClubs(
      userId,
      page,
      limit,
      search || undefined,
    );
    return {
      items: result.items.map(toClubDTO),
      total: result.total,
    };
  }

  // ---------- membership ----------

  async listMembers(
    clubId: string,
    viewerId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubMemberListDTO> {
    await this.requireVisibleClub(clubId, viewerId);
    await this.requireMembership(clubId, viewerId);
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.clubRepo.listMembers(clubId, page, limit);
    return {
      items: result.items.map(toMemberDTO),
      total: result.total,
    };
  }

  // Promote / demote — admins only, and another admin's role is untouchable
  // (removing the last admin by accident is impossible in this flow)
  async updateMemberRole(
    clubId: string,
    adminId: string,
    targetUserId: string,
    role: ClubRole,
  ): Promise<ClubMemberDTO> {
    await this.requireAdmin(clubId, adminId);

    const target = await this.clubRepo.getMembership(clubId, targetUserId);
    if (!target) {
      throw new NotFoundError("Member not found");
    }
    if ((target.role as ClubRole) === "admin") {
      throw new ForbiddenError("Another admin's role can't be changed here");
    }

    const updated = await this.clubRepo.updateMemberRole(
      clubId,
      targetUserId,
      role,
    );
    if (!updated) {
      throw new NotFoundError("Member not found");
    }

    const actorName = await this.userName(adminId);
    const targetName = await this.userName(targetUserId);
    await this.logActivity(
      clubId,
      adminId,
      "role_changed",
      `${actorName} made ${targetName} a ${role}`,
    );

    // Repositories are list-level joins; a single member is the same shape.
    const members = await this.clubRepo.listMembers(clubId, 1, MAX_LIMIT);
    const member = members.items.find((m) => m.user_id === targetUserId);
    return member
      ? toMemberDTO(member)
      : {
          ...toUserDTO(target),
          role,
          joinedAt: new Date(updated.joined_at).toISOString(),
        };
  }

  // Remove a member — admins cannot remove admins (same rule as roles)
  async removeMember(
    clubId: string,
    adminId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireAdmin(clubId, adminId);

    const target = await this.clubRepo.getMembership(clubId, targetUserId);
    if (!target) {
      throw new NotFoundError("Member not found");
    }
    if ((target.role as ClubRole) === "admin") {
      throw new ForbiddenError("Another admin can't be removed here");
    }

    await this.clubRepo.removeMember(clubId, targetUserId);
  }

  // ---------- applications ----------

  // Apply to an open club. The note is mandatory (the UI requires it too).
  async applyToClub(
    clubId: string,
    userId: string,
    data: CreateClubApplicationDTO,
  ): Promise<ClubApplicationDTO> {
    const club = await this.clubRepo.findById(clubId);
    if (!club) {
      throw new NotFoundError("Club not found");
    }
    // Invite-only clubs are invite-only — applications never reach them
    if (club.privacy !== "open") {
      throw new ForbiddenError("This club is invite-only");
    }
    if (await this.clubRepo.getMembership(clubId, userId)) {
      throw new ConflictError("You are already a member of this club");
    }
    if (await this.clubRepo.getPendingApplication(clubId, userId)) {
      throw new ConflictError("You already have a pending application");
    }

    const application = await this.clubRepo.createApplication({
      clubId,
      userId,
      note: data.note,
    });

    const applicant = await this.userName(userId);
    await this.logActivity(
      clubId,
      userId,
      "application",
      `${applicant} applied to join the club`,
    );

    const user = await this.userRepo.findById(userId);
    return {
      id: application.id,
      clubId,
      user: toUserDTO({
        id: userId,
        name: user?.name ?? "",
        handle: user?.handle ?? null,
        avatar: user?.avatar ?? null,
      }),
      note: application.note,
      createdAt: new Date(application.created_at).toISOString(),
    };
  }

  async listApplications(
    clubId: string,
    viewerId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubApplicationListDTO> {
    await this.requireVisibleClub(clubId, viewerId);
    await this.requireCanModerate(clubId, viewerId);
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.clubRepo.listPendingApplications(
      clubId,
      page,
      limit,
    );
    return {
      items: result.items.map(toApplicationDTO),
      total: result.total,
    };
  }

  // Approve / reject a join request. Approval makes the applicant a member
  // and adds them to the group conversation in the same transaction.
  async decideApplication(
    clubId: string,
    applicationId: string,
    decidedBy: string,
    data: ClubApplicationDecisionDTO,
  ): Promise<ClubApplicationDTO> {
    await this.requireCanModerate(clubId, decidedBy);

    const application = await this.clubRepo.getApplication(applicationId);
    if (!application || application.club_id !== clubId) {
      throw new NotFoundError("Application not found");
    }
    if (application.status !== "pending") {
      throw new ConflictError("This application was already handled");
    }

    const applicantName = await this.userName(application.user_id);

    if (data.decision === "approved") {
      const approved = await this.clubRepo.approveApplication({
        applicationId,
        clubId,
        userId: application.user_id,
        decidedBy,
        activity: {
          actorId: application.user_id,
          type: "member_joined",
          detail: `${applicantName} joined the club`,
        },
      });
      if (!approved) {
        throw new ConflictError("This application was already handled");
      }
    } else {
      const rejected = await this.clubRepo.decideApplication(
        applicationId,
        decidedBy,
        "rejected",
      );
      if (!rejected) {
        throw new ConflictError("This application was already handled");
      }
      await this.logActivity(
        clubId,
        decidedBy,
        "application",
        `An application from ${applicantName} was rejected`,
      );
    }

    return toApplicationDTO({
      ...application,
      user_name: applicantName,
      user_handle: null,
      user_avatar: null,
      status: data.decision,
      decided_at: new Date(),
      decided_by: decidedBy,
    });
  }

  // ---------- invitations ----------

  async listInvitations(
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubInvitationListDTO> {
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.clubRepo.listPendingInvitations(
      userId,
      page,
      limit,
    );
    return {
      items: result.items.map(toInvitationDTO),
      total: result.total,
    };
  }

  // Invite users by handle — admins/moderators only. Members and already
  // invited people are skipped silently (the response reports the count).
  async inviteByHandle(
    clubId: string,
    inviterId: string,
    data: CreateClubInvitationDTO,
  ): Promise<ClubInvitationResultDTO> {
    await this.requireCanModerate(clubId, inviterId);

    let invited = 0;
    for (const rawHandle of data.handles) {
      const handle = rawHandle.trim().toLowerCase().replace(/^@/, "");
      if (!handle) continue;

      const invitee = await this.userRepo.findByHandle(handle);
      if (!invitee) {
        logger.info({ clubId, handle }, "Club invite skipped (unknown handle)");
        continue;
      }
      if (await this.clubRepo.getMembership(clubId, invitee.id)) {
        continue; // already a member
      }
      if (await this.clubRepo.getPendingInvitation(clubId, invitee.id)) {
        continue; // already invited
      }

      try {
        await this.clubRepo.createInvitation({
          clubId,
          inviterId,
          inviteeId: invitee.id,
        });
        await this.notificationService.notifyClubInvitation(
          invitee.id,
          inviterId,
          clubId,
        );
        invited += 1;
      } catch (error) {
        // A raced duplicate of the partial unique index — treat as already invited
        if ((error as { code?: string }).code === "23505") continue;
        throw error;
      }
    }

    return { invited };
  }

  // Accepting adds the membership, the group-conversation participant row and
  // the activity entry in one transaction (see club repository).
  async respondToInvitation(
    invitationId: string,
    inviteeId: string,
    response: "accepted" | "declined",
  ): Promise<ClubInvitationResponseDTO> {
    if (response === "accepted") {
      const name = await this.userName(inviteeId);
      const invitation = await this.clubRepo.acceptInvitation({
        invitationId,
        inviteeId,
        activity: {
          actorId: inviteeId,
          type: "member_joined",
          detail: `${name} joined the club`,
        },
      });
      if (!invitation) {
        throw new BadRequestError("This invitation is no longer pending");
      }
      return {
        id: invitation.id,
        clubId: invitation.club_id,
        status: "accepted",
      };
    }

    const declined = await this.clubRepo.respondInvitation(
      invitationId,
      inviteeId,
      "declined",
    );
    if (!declined) {
      throw new BadRequestError("This invitation is no longer pending");
    }
    return { id: declined.id, clubId: declined.club_id, status: "declined" };
  }

  // ---------- blog review workflow ----------

  // Submit a draft into the club's review queue. Any member can submit; the
  // draft is attributed to the club from birth (club_id + pending review).
  async createSubmission(
    clubId: string,
    userId: string,
    data: CreateClubSubmissionDTO,
  ): Promise<BlogResponseDTO> {
    await this.requireMembership(clubId, userId);

    const title = (data.title ?? "").trim();
    const submitted = await this.blogRepo.createBlogInClub(userId, clubId, {
      title,
      content: data.content,
      description: data.description,
    });

    const author = await this.userName(userId);
    await this.logActivity(
      clubId,
      userId,
      "submission",
      title
        ? `${author} submitted "${title}" for review`
        : `${author} submitted a draft for review`,
    );

    return toBlogResponse(submitted);
  }

  // The review queue — admins/moderators only
  async listSubmissions(
    clubId: string,
    viewerId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubSubmissionListDTO> {
    await this.requireVisibleClub(clubId, viewerId);
    await this.requireCanModerate(clubId, viewerId);
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.blogRepo.listClubReviewQueue(clubId, page, limit);
    return {
      items: result.items.map(toSubmissionDTO),
      total: result.total,
    };
  }

  // Re-submit a handled draft (changes requested / rejected) for another round
  async resubmitSubmission(
    clubId: string,
    blogId: string,
    userId: string,
  ): Promise<{ blogId: string; clubReviewStatus: "pending" }> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Submission not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("Only the author can re-submit this draft");
    }
    if (
      blog.club_review_status !== "changes_requested" &&
      blog.club_review_status !== "rejected"
    ) {
      throw new ConflictError("This draft is not waiting to be re-submitted");
    }

    await this.blogRepo.setClubReviewStatus(blogId, "pending");

    const author = await this.userName(userId);
    await this.logActivity(
      clubId,
      userId,
      "submission",
      blog.title
        ? `${author} re-submitted "${blog.title}" for review`
        : `${author} re-submitted a draft for review`,
    );

    return { blogId, clubReviewStatus: "pending" };
  }

  // One review decision. Approvals publish the post publicly in the same
  // statement that clears the review state (atomic in the repository);
  // changes/rejected park the state so the author can answer and re-submit.
  async reviewSubmission(
    clubId: string,
    blogId: string,
    reviewerId: string,
    data: CreateClubReviewDTO,
  ): Promise<ClubReviewDTO> {
    await this.requireCanModerate(clubId, reviewerId);

    if (data.decision !== "approved" && !data.note?.trim()) {
      throw new BadRequestError(
        "A note is required to request changes or reject",
      );
    }

    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Submission not found");
    }
    if (blog.club_review_status !== "pending") {
      throw new ConflictError("This blog is not waiting for review");
    }

    const note = data.note?.trim() || null;

    if (data.decision === "approved") {
      // Publish + clear the review state atomically; NULL means "approved"
      const published = await this.blogRepo.approveClubBlog(blogId);
      if (!published) {
        throw new ConflictError("This blog is not waiting for review");
      }

      const review = await this.clubRepo.createReview({
        blogId,
        clubId,
        reviewerId,
        decision: "approved",
        note,
      });

      const reviewerName = await this.userName(reviewerId);
      await this.logActivity(
        clubId,
        reviewerId,
        "review_decision",
        `${reviewerName} approved "${published.title}"`,
      );
      await this.logActivity(
        clubId,
        reviewerId,
        "post_published",
        `"${published.title}" was published to the club`,
      );

      // The author always learns the outcome; the publish fan-out follows the
      // ordinary blog worker path (followed writers' feeds)
      await this.notificationService.notifyClubReview(
        blog.user_id,
        reviewerId,
        review.id,
        blogId,
        clubId,
      );
      await this.notificationService.fanOutNewPost(
        published.id,
        published.user_id,
      );

      // Attribution is preserved: blogs.club_id stays set and user_id remains
      // the real author — approved posts read as club posts, internally theirs
      return toReviewDTO({ ...review });
    }

    const review = await this.clubRepo.createReview({
      blogId,
      clubId,
      reviewerId,
      decision: data.decision,
      note,
    });
    await this.blogRepo.setClubReviewStatus(blogId, data.decision);

    const reviewerName = await this.userName(reviewerId);
    await this.logActivity(
      clubId,
      reviewerId,
      "review_decision",
      data.decision === "changes_requested"
        ? `${reviewerName} requested changes on "${blog.title}"`
        : `${reviewerName} rejected "${blog.title}"`,
    );

    await this.notificationService.notifyClubReview(
      blog.user_id,
      reviewerId,
      review.id,
      blogId,
      clubId,
    );

    return toReviewDTO({ ...review });
  }

  // Review history for one submission — preserved forever
  async listReviews(
    clubId: string,
    blogId: string,
    viewerId: string,
  ): Promise<ClubReviewListDTO> {
    await this.requireVisibleClub(clubId, viewerId);
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Submission not found");
    }
    if (!(await this.clubRepo.getMembership(clubId, viewerId))) {
      throw new ForbiddenError("Only club members can see review history");
    }
    const reviews = await this.clubRepo.getReviewsForBlog(blogId);
    return { items: reviews.map(toReviewDTO), total: reviews.length };
  }

  // ---------- chat ----------

  // Both members are club members; one 1:1 conversation per pair per club
  async getOrCreateDirectConversation(
    clubId: string,
    userId: string,
    handle: string,
  ): Promise<ClubConversationDTO> {
    await this.requireMembership(clubId, userId);

    const target = await this.userRepo.findByHandle(
      handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("No writer with that handle");
    }
    if (target.id === userId) {
      throw new BadRequestError(
        "Start a conversation with a fellow member, not yourself",
      );
    }
    if (!(await this.clubRepo.getMembership(clubId, target.id))) {
      throw new BadRequestError("That writer is not a member of this club");
    }

    const conversation = await this.clubRepo.createOrGetDirectConversation(
      clubId,
      userId < target.id ? userId : target.id,
      userId < target.id ? target.id : userId,
    );
    return this.toConversationProject(clubId, conversation, userId);
  }

  // Coverage of all conversation types; reads may lazily add the member to the
  // club group chat (new joiners are added at join time, legacy rows heal here)
  private async requireConversationAccess(
    clubId: string,
    conversationId: string,
    userId: string,
    opts: { joinGroupIfMember?: boolean } = {},
  ): Promise<ClubConversationModel> {
    await this.requireMembership(clubId, userId);

    const conversation = await this.clubRepo.findConversationById(
      clubId,
      conversationId,
    );
    if (!conversation) {
      throw new NotFoundError("Conversation not found");
    }

    if (
      !(await this.clubRepo.isConversationParticipant(conversationId, userId))
    ) {
      if (conversation.is_group && (opts.joinGroupIfMember ?? false)) {
        await this.clubRepo.addConversationParticipant(conversationId, userId);
      } else {
        throw new ForbiddenError(
          "You are not a participant in this conversation",
        );
      }
    }
    return conversation;
  }

  private async toConversationProject(
    clubId: string,
    conversation: ClubConversationModel,
    userId: string,
  ): Promise<ClubConversationDTO> {
    await this.requireConversationAccess(clubId, conversation.id, userId, {
      joinGroupIfMember: true,
    });
    const participants = await this.clubRepo.getConversationParticipants(
      conversation.id,
    );
    return {
      id: conversation.id,
      clubId: conversation.club_id,
      isGroup: conversation.is_group,
      updatedAt: new Date(conversation.updated_at).toISOString(),
      participants: participants.map(toUserDTO),
    };
  }

  async listConversations(
    clubId: string,
    userId: string,
  ): Promise<ClubConversationListDTO> {
    await this.requireMembership(clubId, userId);
    const rows = await this.clubRepo.listUserConversationsInClub(
      clubId,
      userId,
    );
    return { items: rows.map(toConversationDTO) };
  }

  async getConversation(
    clubId: string,
    conversationId: string,
    userId: string,
  ): Promise<ClubConversationDTO> {
    const conversation = await this.requireConversationAccess(
      clubId,
      conversationId,
      userId,
      { joinGroupIfMember: true },
    );
    const participants =
      await this.clubRepo.getConversationParticipants(conversationId);
    return {
      id: conversation.id,
      clubId: conversation.club_id,
      isGroup: conversation.is_group,
      updatedAt: new Date(conversation.updated_at).toISOString(),
      participants: participants.map(toUserDTO),
    };
  }

  // Messages are oldest-first in the client; the page reads DESC for SQL
  async listMessages(
    clubId: string,
    conversationId: string,
    userId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubMessageListDTO> {
    await this.requireConversationAccess(clubId, conversationId, userId);
    const { page, limit } = this.parsePageLimit(query);
    const result = await this.clubRepo.getMessages(conversationId, page, limit);
    return {
      items: result.items.map(toMessageDTO),
      total: result.total,
    };
  }

  async sendMessage(
    clubId: string,
    conversationId: string,
    senderId: string,
    data: CreateClubMessageDTO,
  ): Promise<ClubMessageDTO> {
    // Group chat: membership plus the participant row (kept in sync).
    await this.requireConversationAccess(clubId, conversationId, senderId, {
      joinGroupIfMember: true,
    });

    const message = await this.clubRepo.sendMessage({
      conversationId,
      senderId,
      body: data.body,
    });
    const sender = await this.userRepo.findById(senderId);
    return toMessageDTO({
      ...message,
      sender_name: sender?.name ?? "",
      sender_handle: sender?.handle ?? null,
      sender_avatar: sender?.avatar ?? null,
    });
  }

  // ---------- landing page & dashboard ----------

  // The club's public blog page. Open clubs: any authenticated reader;
  // invite-only clubs: members only (privacy lives on the club itself).
  async getLandingPage(
    clubId: string,
    viewerId: string,
    query: { page?: number; limit?: number },
  ): Promise<ClubLandingDTO> {
    const { page, limit } = this.parsePageLimit(query);
    const club = await this.clubRepo.findByIdWithMembership(clubId, viewerId);
    if (!club) {
      throw new NotFoundError("Club not found");
    }
    if (club.privacy === "invite" && !club.role) {
      throw new NotFoundError("Club not found");
    }
    await this.requireVisibleClub(clubId, viewerId);
    const posts = await this.blogRepo.listClubPublishedBlogs(
      clubId,
      viewerId,
      page,
      limit,
    );
    return {
      club: toClubDTO(club),
      posts: posts.items.map((b) =>
        toBlogResponse({
          ...b,
          // Landing readers' bookmark state is viewer-dependent
          bookmarked: (b as unknown as { bookmarked?: boolean }).bookmarked,
        }),
      ),
      total: posts.total,
    };
  }

  async getDashboard(
    clubId: string,
    userId: string,
  ): Promise<ClubDashboardDTO> {
    await this.requireAdmin(clubId, userId);
    const metrics = await this.clubRepo.getDashboardMetrics(clubId);
    return {
      totalMembers: Number(metrics.total_members),
      publishedPosts: Number(metrics.published_posts),
      pendingReviews: Number(metrics.pending_reviews),
      recentActivity: metrics.recent_activity.map(toActivityDTO),
    };
  }

  // ---------- collaborative writing ----------

  // A draft owned by the club: the author plus chosen collaborators edit it
  async listCollaborators(
    clubId: string,
    blogId: string,
    viewerId: string,
  ): Promise<ClubCollaboratorListDTO> {
    await this.requireVisibleClub(clubId, viewerId);
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Draft not found");
    }
    const isAuthor = blog.user_id === viewerId;
    if (!isAuthor && !(await this.clubRepo.isCollaborator(blogId, viewerId))) {
      throw new ForbiddenError(
        "Only the author and collaborators can see collaborators",
      );
    }
    const collaborators = await this.clubRepo.listCollaborators(blogId);
    const items: ClubCollaboratorDTO[] = [];
    for (const collaborator of collaborators) {
      const user = await this.userRepo.findById(collaborator.user_id);
      if (!user) continue;
      items.push({
        ...toUserDTO(user),
        addedAt: new Date(collaborator.added_at).toISOString(),
      });
    }
    return { items, total: items.length };
  }

  // The author chooses co-authors, and they must be club members
  async addCollaborator(
    clubId: string,
    blogId: string,
    userId: string,
    data: CreateClubCollaboratorDTO,
  ): Promise<ClubCollaboratorDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Draft not found");
    }
    if (blog.user_id !== userId) {
      throw new ForbiddenError("Only the author can add collaborators");
    }
    if (blog.status !== "draft") {
      throw new BadRequestError(
        "Collaborators are only managed while the draft is unpublished",
      );
    }

    const target = await this.userRepo.findByHandle(
      data.handle.trim().toLowerCase(),
    );
    if (!target) {
      throw new NotFoundError("No writer with that handle");
    }
    if (!(await this.clubRepo.getMembership(clubId, target.id))) {
      throw new BadRequestError("Collaborators must be club members");
    }

    await this.clubRepo.addCollaborator(blogId, target.id);
    const added = await this.clubRepo.listCollaborators(blogId);
    const collaborator = added.find((c) => c.user_id === target.id);
    return {
      ...toUserDTO(target),
      addedAt: collaborator
        ? new Date(collaborator.added_at).toISOString()
        : new Date().toISOString(),
    };
  }

  async removeCollaborator(
    clubId: string,
    blogId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Draft not found");
    }
    if (blog.user_id !== requesterId) {
      throw new ForbiddenError("Only the author can remove collaborators");
    }
    await this.clubRepo.removeCollaborator(blogId, targetUserId);
  }

  // Collaborative draft save with optimistic concurrency: the editor sends
  // the version it started from; stale versions get HTTP 409 so nothing is
  // silently lost. Author and collaborators only — writing is club-scoped.
  async saveCollaborativeDraft(
    clubId: string,
    blogId: string,
    editorId: string,
    data: ClubCollaborativeSaveDTO,
  ): Promise<ClubCollaborativeSaveResultDTO> {
    const blog = await this.blogRepo.findBlogById(blogId);
    if (!blog || blog.club_id !== clubId) {
      throw new NotFoundError("Draft not found");
    }
    const isAuthor = blog.user_id === editorId;
    if (!isAuthor && !(await this.clubRepo.isCollaborator(blogId, editorId))) {
      throw new ForbiddenError(
        "Only the author and collaborators can edit this draft",
      );
    }
    if (blog.status !== "draft") {
      throw new BadRequestError("Only drafts can be edited collaboratively");
    }

    const currentVersion = Number(blog.version ?? 1);
    if (currentVersion !== data.version) {
      throw new ConflictError(
        "The draft changed since you started editing — reload the current version",
      );
    }

    const updated = await this.blogRepo.updateBlogVersioned(
      blogId,
      {
        title: data.title,
        content: data.content,
        description: data.description,
      },
      data.version,
    );
    if (!updated) {
      throw new ConflictError(
        "The draft changed since you started editing — reload the current version",
      );
    }

    return {
      blog: toBlogResponse(updated),
      version: Number(updated.version ?? data.version + 1),
    };
  }
}

export default ClubService;
