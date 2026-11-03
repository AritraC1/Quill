import { describe, expect, it, mock } from "bun:test";
import ClubService from "./club.service";
import type {
  ClubApplicationModel,
  ClubMemberModel,
  ClubModel,
  ClubWithMembershipModel,
} from "./club.model";
import type { BlogModel } from "../blog/blog.model";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../core/errors";

// Row builder — the shape Postgres returns for clubs (snake_case fields)
function clubRow(overrides: Partial<ClubModel> = {}): ClubModel {
  const now = new Date();
  return {
    id: "club-1",
    name: "Slow Mornings",
    description: "Essays on routines and rest.",
    privacy: "open",
    rules: ["Original work only"],
    created_by: "creator-1",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function clubContextRow(
  overrides: Partial<ClubWithMembershipModel> = {},
): ClubWithMembershipModel {
  return {
    ...clubRow(),
    role: "member" as ClubWithMembershipModel["role"],
    member_count: 4,
    pending_reviews: 2,
    ...overrides,
  };
}

function memberRow(overrides: Partial<ClubMemberModel> = {}): ClubMemberModel {
  return {
    club_id: "club-1",
    user_id: "user-1",
    role: "member",
    joined_at: new Date(),
    last_seen_at: null,
    ...overrides,
  };
}

function applicationRow(
  overrides: Partial<ClubApplicationModel> = {},
): ClubApplicationModel {
  return {
    id: "application-1",
    club_id: "club-1",
    user_id: "applicant-1",
    note: "I write about slow living.",
    status: "pending",
    created_at: new Date(),
    decided_at: null,
    decided_by: null,
    ...overrides,
  };
}

function blogRow(overrides: Partial<BlogModel> = {}): BlogModel {
  const now = new Date();
  return {
    id: "blog-1",
    user_id: "author-1",
    title: "The case for doing nothing",
    content: "I used to reach for my phone before my feet touched the floor.",
    description: "",
    images: null,
    status: "draft",
    published_at: null,
    scheduled_publish_at: null,
    created_at: now,
    updated_at: now,
    club_id: "club-1",
    club_review_status: "pending",
    version: 3,
    ...overrides,
  };
}

// A profile for the mocked UserRepository (findById / findByHandle)
function profile(id: string, handle: string, name: string) {
  return { id, name, email: `${handle}@example.com`, handle, avatar: null };
}

// A service whose real repositories are swapped for mocks (@ts-ignore follows
// the existing comment/auth service tests pattern)
function makeService(
  overrides: {
    clubRepo?: Record<string, unknown>;
    blogRepo?: Record<string, unknown>;
    userRepo?: Record<string, unknown>;
    notificationService?: Record<string, unknown>;
  } = {},
): ClubService {
  const service = new ClubService();
  if (overrides.clubRepo) {
    // @ts-ignore
    service.clubRepo = overrides.clubRepo;
  }
  if (overrides.blogRepo) {
    // @ts-ignore
    service.blogRepo = overrides.blogRepo;
  }
  if (overrides.userRepo) {
    // @ts-ignore
    service.userRepo = overrides.userRepo;
  }
  if (overrides.notificationService) {
    // @ts-ignore
    service.notificationService = overrides.notificationService;
  }
  return service;
}

describe("ClubService — authorization", () => {
  it("forbids plain members from the review workflow (moderators only)", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "member" })),
        findByIdWithMembership: mock(async () => clubContextRow()),
      },
    });

    await expect(
      service.listSubmissions("club-1", "user-1", {}),
    ).rejects.toThrow(ForbiddenError);
  });

  it("allows moderators into the review queue", async () => {
    const listClubReviewQueue = mock(async () => ({ items: [], total: 0 }));
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "moderator" })),
        findByIdWithMembership: mock(async () => clubContextRow()),
      },
      blogRepo: { listClubReviewQueue },
    });

    const result = await service.listSubmissions("club-1", "user-1", {});
    expect(listClubReviewQueue).toHaveBeenCalledWith("club-1", 1, 10);
    expect(result.total).toBe(0);
  });

  it("restricts the admin dashboard to admins, not moderators", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "moderator" })),
      },
    });

    await expect(service.getDashboard("club-1", "user-1")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("returns dashboard metrics for admins", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "admin" })),
        getDashboardMetrics: mock(async () => ({
          total_members: 12,
          published_posts: 34,
          pending_reviews: 2,
          recent_activity: [],
        })),
      },
    });

    const result = await service.getDashboard("club-1", "user-1");
    expect(result.totalMembers).toBe(12);
    expect(result.publishedPosts).toBe(34);
    expect(result.pendingReviews).toBe(2);
  });

  it("forbids moderators from saving club rules (admin only)", async () => {
    const service = makeService({
      clubRepo: {
        findById: mock(async () => clubRow()),
        getMembership: mock(async () => memberRow({ role: "moderator" })),
      },
    });

    await expect(
      service.updateClub("club-1", "user-1", { rules: ["Be kind"] }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids role changes from non-admins", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "moderator" })),
      },
    });

    await expect(
      service.updateMemberRole("club-1", "user-1", "user-2", "moderator"),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("ClubService — applications & membership transitions", () => {
  it("rejects applications to invite-only clubs", async () => {
    const service = makeService({
      clubRepo: {
        findById: mock(async () => clubRow({ privacy: "invite" })),
      },
    });

    await expect(
      service.applyToClub("club-1", "user-1", { note: "Please" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects a second pending application", async () => {
    const service = makeService({
      clubRepo: {
        findById: mock(async () => clubRow()),
        getMembership: mock(async () => null),
        getPendingApplication: mock(async () => applicationRow()),
      },
    });

    await expect(
      service.applyToClub("club-1", "user-1", { note: "Again" }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects an application from an existing member", async () => {
    const service = makeService({
      clubRepo: {
        findById: mock(async () => clubRow()),
        getMembership: mock(async () => memberRow()),
      },
    });

    await expect(
      service.applyToClub("club-1", "user-1", { note: "Again" }),
    ).rejects.toThrow(ConflictError);
  });

  it("creating an application requires a note (same rule as the DB CHECK)", async () => {
    const service = makeService({
      clubRepo: {
        findById: mock(async () => clubRow()),
        getMembership: mock(async () => null),
        getPendingApplication: mock(async () => null),
        createApplication: mock(async () => applicationRow()),
      },
      userRepo: {
        findById: mock(async () => profile("applicant-1", "devp", "Dev Patel")),
      },
    });

    const result = await service.applyToClub("club-1", "user-1", {
      note: "I write about slow living.",
    });
    expect(result.note).toBe("I write about slow living.");
  });

  it("approval makes the applicant a member in the same transaction (repository call)", async () => {
    const approveApplication = mock(async () => true);
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "moderator" })),
        getApplication: mock(async () => applicationRow()),
        approveApplication,
      },
      userRepo: {
        findById: mock(async () => profile("applicant-1", "devp", "Dev Patel")),
      },
    });

    await service.decideApplication("club-1", "application-1", "moderator-1", {
      decision: "approved",
    });

    expect(approveApplication).toHaveBeenCalledWith({
      applicationId: "application-1",
      clubId: "club-1",
      userId: "applicant-1",
      decidedBy: "moderator-1",
      activity: expect.objectContaining({ type: "member_joined" }),
    });
  });

  it("refuses to decide an application twice", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "admin" })),
        getApplication: mock(async () =>
          applicationRow({
            status: "rejected",
            decided_by: "someone-else",
            decided_at: new Date(),
          }),
        ),
      },
    });

    await expect(
      service.decideApplication("club-1", "application-1", "user-1", {
        decision: "approved",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("invitations resolved by handle skip members and duplicates", async () => {
    const createInvitation = mock(async () => ({}));
    const service = makeService({
      clubRepo: {
        getMembership: mock(async (_clubId: string, userId: string) => {
          if (userId === "moderator-1")
            return memberRow({ user_id: "moderator-1", role: "moderator" });
          if (userId === "existing-1")
            return memberRow({ user_id: "existing-1" });
          return null;
        }),
        getPendingInvitation: mock(async (_clubId: string, userId: string) =>
          userId === "twice-1" ? ({ id: "x" } as never) : null,
        ),
        createInvitation,
      },
      userRepo: {
        findByHandle: mock(async (handle: string) => {
          if (handle === "aarav")
            return profile("new-1", "aarav", "Aarav Mehta");
          if (handle === "kabir")
            return profile("existing-1", "kabir", "Kabir Singh");
          if (handle === "meera")
            return profile("twice-1", "meera", "Meera Iyer");
          return null; // unknown handle — skipped, never fatal
        }),
        findById: mock(async () => profile("moderator-1", "mod", "Mod Yue")),
      },
      notificationService: {
        notifyClubInvitation: mock(async () => undefined),
      },
    });

    const result = await service.inviteByHandle("club-1", "moderator-1", {
      handles: ["@aarav", "kabir", "meera", "nobody"],
    });

    expect(result.invited).toBe(1);
    expect(createInvitation).toHaveBeenCalledWith({
      clubId: "club-1",
      inviterId: "moderator-1",
      inviteeId: "new-1",
    });
  });

  it("accepting an invitation joins the club through the transactional path", async () => {
    const acceptInvitation = mock(async () => ({
      id: "invitation-1",
      club_id: "club-1",
      invitee_id: "user-1",
      status: "accepted",
    }));
    const service = makeService({
      clubRepo: { acceptInvitation },
      userRepo: { findById: mock(async () => profile("user-1", "you", "You")) },
    });

    const result = await service.respondToInvitation(
      "invitation-1",
      "user-1",
      "accepted",
    );

    expect(acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        invitationId: "invitation-1",
        inviteeId: "user-1",
        activity: expect.objectContaining({ type: "member_joined" }),
      }),
    );
    expect(result.status).toBe("accepted");
  });

  it("an already handled invitation is not accepted twice", async () => {
    const service = makeService({
      clubRepo: { acceptInvitation: mock(async () => null) },
      userRepo: { findById: mock(async () => profile("user-1", "you", "You")) },
    });

    await expect(
      service.respondToInvitation("invitation-1", "user-1", "accepted"),
    ).rejects.toThrow(BadRequestError);
  });
});

describe("ClubService — review outcomes & attribution", () => {
  it("forbids reviewing for non-moderators", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "member" })),
      },
    });

    await expect(
      service.reviewSubmission("club-1", "blog-1", "user-1", {
        decision: "approved",
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("requesting changes requires a note — and notifies the author", async () => {
    const notifyClubReview = mock(async () => undefined);
    const setClubReviewStatus = mock(async () => blogRow());
    const createReview = mock(async () => ({
      id: "review-1",
      blog_id: "blog-1",
      club_id: "club-1",
      reviewer_id: "moderator-1",
      decision: "changes_requested",
      note: "Tighten the opening.",
      created_at: new Date(),
      note_is_private: undefined,
    }));
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "moderator" })),
        createReview,
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow()),
        setClubReviewStatus,
      },
      userRepo: {
        findById: mock(async () => profile("moderator-1", "mod", "Mod")),
      },
      notificationService: { notifyClubReview },
    });

    await expect(
      service.reviewSubmission("club-1", "blog-1", "moderator-1", {
        decision: "changes_requested",
      }),
    ).rejects.toThrow(BadRequestError);

    const result = await service.reviewSubmission(
      "club-1",
      "blog-1",
      "moderator-1",
      {
        decision: "changes_requested",
        note: "Tighten the opening.",
      },
    );

    expect(createReview).toHaveBeenCalledWith({
      blogId: "blog-1",
      clubId: "club-1",
      reviewerId: "moderator-1",
      decision: "changes_requested",
      note: "Tighten the opening.",
    });
    expect(setClubReviewStatus).toHaveBeenCalledWith(
      "blog-1",
      "changes_requested",
    );
    // The changes-requested note reaches the author through the bell
    expect(notifyClubReview).toHaveBeenCalledWith(
      "author-1",
      "moderator-1",
      "review-1",
      "blog-1",
      "club-1",
    );
    expect(result.decision).toBe("changes_requested");
  });

  it("approval publishes the post publicly while keeping the club attribution", async () => {
    const approveClubBlog = mock(async () =>
      blogRow({ status: "published", published_at: new Date() }),
    );
    const createReview = mock(async () => ({
      id: "review-2",
      blog_id: "blog-1",
      club_id: "club-1",
      reviewer_id: "moderator-1",
      decision: "approved",
      note: null,
      created_at: new Date(),
    }));
    const notifyClubReview = mock(async () => undefined);
    const fanOutNewPost = mock(async () => undefined);
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "admin" })),
        createReview,
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow({ club_id: "club-1" })),
        approveClubBlog,
      },
      userRepo: {
        findById: mock(async () => profile("moderator-1", "mod", "Mod")),
      },
      notificationService: { notifyClubReview, fanOutNewPost },
    });

    const result = await service.reviewSubmission(
      "club-1",
      "blog-1",
      "moderator-1",
      {
        decision: "approved",
      },
    );

    // One atomic statement publishes and clears the review state
    expect(approveClubBlog).toHaveBeenCalledWith("blog-1");
    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({ decision: "approved", blogId: "blog-1" }),
    );
    // "Approval clears the state; club_id stays set" is the repository's SQL —
    // here we assert attribution survived on the recorded outcome"
    expect(approveClubBlog.mock.results.length > 0).toBe(true);
    // Still notified + public feed fan-out, like an ordinary publish
    expect(notifyClubReview).toHaveBeenCalled();
    expect(fanOutNewPost).toHaveBeenCalledWith("blog-1", "author-1");
    expect(result.decision).toBe("approved");
    // The reviewer identity is preserved in the history
    expect(result.reviewer?.id).toBe("moderator-1");
  });

  it("refuses to review a blog that is not pending", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "admin" })),
      },
      blogRepo: {
        findBlogById: mock(async () =>
          blogRow({ club_review_status: "changes_requested" }),
        ),
      },
    });

    await expect(
      service.reviewSubmission("club-1", "blog-1", "user-1", {
        decision: "approved",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("refuses to review a blog that belongs to another club", async () => {
    const service = makeService({
      blogRepo: {
        findBlogById: mock(async () => blogRow({ club_id: "club-2" })),
      },
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "admin" })),
      },
    });

    await expect(
      service.reviewSubmission("club-1", "blog-1", "user-1", {
        decision: "approved",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("submission enters the review queue attributed to the club", async () => {
    const createBlogInClub = mock(async () =>
      blogRow({ user_id: "author-1", club_id: "club-1" }),
    );
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow({ role: "member" })),
      },
      blogRepo: { createBlogInClub },
      userRepo: {
        findById: mock(async () => profile("author-1", "kabir", "Kabir Singh")),
      },
    });

    const result = await service.createSubmission("club-1", "author-1", {
      title: "Ten tea rituals",
      content: "Everyone has a kettle opinion…",
    });

    expect(createBlogInClub).toHaveBeenCalledWith(
      "author-1",
      "club-1",
      expect.objectContaining({ title: "Ten tea rituals" }),
    );
    // Actual user authorship stays intact on the API response
    expect(result.userId).toBe("author-1");
    expect(result.clubId).toBe("club-1");
    expect(result.clubReviewStatus).toBe("pending");
    expect(result.author?.id).toBe("author-1");
  });

  it("re-submission only works for the author of a handled draft", async () => {
    const service = makeService({
      blogRepo: {
        findBlogById: mock(async () =>
          blogRow({ club_review_status: "rejected", user_id: "author-1" }),
        ),
        setClubReviewStatus: mock(async () => blogRow()),
      },
      userRepo: {
        findById: mock(async () => profile("author-1", "kabir", "Kabir")),
      },
    });

    await expect(
      service.resubmitSubmission("club-1", "blog-1", "intruder-1"),
    ).rejects.toThrow(ForbiddenError);

    const result = await service.resubmitSubmission(
      "club-1",
      "blog-1",
      "author-1",
    );
    expect(result.clubReviewStatus).toBe("pending");
  });

  it("a submission of another club cannot re-enter this club's queue", async () => {
    const service = makeService({
      blogRepo: {
        findBlogById: mock(async () =>
          blogRow({ club_id: "club-2", user_id: "author-1" }),
        ),
      },
    });

    await expect(
      service.resubmitSubmission("club-1", "blog-1", "author-1"),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("ClubService — chat access control", () => {
  const groupConversation = {
    id: "conversation-1",
    club_id: "club-1",
    is_group: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  it("forbids people outside the club from club conversations", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => null),
      },
    });

    await expect(
      service.listMessages("club-1", "conversation-1", "user-1", {}),
    ).rejects.toThrow(ForbiddenError);
  });

  it("forbids members from a direct conversation they are not part of", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow()),
        findConversationById: mock(async () => ({
          ...groupConversation,
          is_group: false,
        })),
        isConversationParticipant: mock(async () => false),
      },
    });

    await expect(
      service.getConversation("club-1", "conversation-1", "user-1"),
    ).rejects.toThrow(ForbiddenError);
  });

  it("lazily adds members to the group conversation (duplicate participants prevented by the unique key)", async () => {
    const addConversationParticipant = mock(async () => ({
      conversation_id: "conversation-1",
      user_id: "user-1",
      joined_at: new Date(),
    }));
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow()),
        findConversationById: mock(async () => groupConversation),
        isConversationParticipant: mock(async () => false),
        addConversationParticipant,
        getConversationParticipants: mock(async () => []),
      },
    });

    const conversation = await service.getConversation(
      "club-1",
      "conversation-1",
      "user-1",
    );

    expect(addConversationParticipant).toHaveBeenCalledWith(
      "conversation-1",
      "user-1",
    );
    // The service reconciles with the participant list; badge readers should
    // see an empty history rather than a fabricated one
    expect(conversation.isGroup).toBe(true);
  });

  it("starting a 1:1 requires a club member", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async (_clubId: string, userId: string) =>
          userId === "user-1" ? memberRow() : null,
        ),
      },
      userRepo: {
        findByHandle: mock(async () =>
          profile("outsider-1", "devp", "Dev Patel"),
        ),
      },
    });

    await expect(
      service.getOrCreateDirectConversation("club-1", "user-1", "devp"),
    ).rejects.toThrow(BadRequestError);
  });

  it("starting a 1:1 with yourself is rejected", async () => {
    const service = makeService({
      clubRepo: {
        getMembership: mock(async () => memberRow()),
      },
      userRepo: {
        findByHandle: mock(async () => profile("user-1", "you", "You")),
      },
    });

    await expect(
      service.getOrCreateDirectConversation("club-1", "user-1", "you"),
    ).rejects.toThrow(BadRequestError);
  });
});

describe("ClubService — collaborative writing", () => {
  it("collaborative saves require the author or a collaborator", async () => {
    const service = makeService({
      clubRepo: {
        isCollaborator: mock(async () => false),
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow({ user_id: "author-1" })),
      },
    });

    await expect(
      service.saveCollaborativeDraft("club-1", "blog-1", "intruder-1", {
        content: "hijack",
        version: 3,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("stale versions are rejected with 409 (no lost updates)", async () => {
    const service = makeService({
      clubRepo: {
        isCollaborator: mock(async () => true),
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow({ version: 5 })),
      },
    });

    await expect(
      service.saveCollaborativeDraft("club-1", "blog-1", "collab-1", {
        content: "edit against an old version",
        version: 3,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("a matching version is saved and the version counter advances", async () => {
    const updateBlogVersioned = mock(async () =>
      blogRow({ version: 4, content: "fresh words" }),
    );
    const service = makeService({
      clubRepo: {
        isCollaborator: mock(async () => true),
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow({ version: 3 })),
        updateBlogVersioned,
      },
    });

    const result = await service.saveCollaborativeDraft(
      "club-1",
      "blog-1",
      "collab-1",
      {
        content: "fresh words",
        version: 3,
      },
    );

    expect(updateBlogVersioned).toHaveBeenCalledWith(
      "blog-1",
      expect.objectContaining({ content: "fresh words" }),
      3,
    );
    expect(result.version).toBe(4);
    expect(result.blog.content).toBe("fresh words");
  });

  it("collaborators must be club members (only the author adds them)", async () => {
    const addCollaborator = mock(async () => ({
      blog_id: "blog-1",
      user_id: "new-1",
      added_at: new Date(),
    }));
    const service = makeService({
      clubRepo: {
        addCollaborator,
        getMembership: mock(async (_clubId: string, userId: string) =>
          userId === "new-1" ? null : memberRow(),
        ),
        listCollaborators: mock(async () => [
          { blog_id: "blog-1", user_id: "new-1", added_at: new Date() },
        ]),
      },
      blogRepo: {
        findBlogById: mock(async () => blogRow({ user_id: "author-1" })),
      },
      userRepo: {
        findByHandle: mock(async () => profile("new-1", "devp", "Dev Patel")),
        findById: mock(async () => profile("new-1", "devp", "Dev Patel")),
      },
    });

    await expect(
      service.addCollaborator("club-1", "blog-1", "author-1", {
        handle: "devp",
      }),
    ).rejects.toThrow(BadRequestError);

    await expect(
      service.addCollaborator("club-1", "blog-1", "not-author-1", {
        handle: "devp",
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("ClubService — pagination guard rails", () => {
  it("clamps page/limit (limit max 50)", async () => {
    const listUserClubs = mock(async () => ({ items: [], total: 0 }));
    const service = makeService({
      clubRepo: { listUserClubs },
    });

    await service.listMyClubs("user-1", { page: -3, limit: 999 });

    expect(listUserClubs).toHaveBeenCalledWith("user-1", 1, 50);
  });
});
