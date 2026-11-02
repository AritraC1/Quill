// Club API — the client wiring for My Clubs. Every call rides the shared
// fetchWithAuth helper (cookies + one-shot refresh on 401) and returns the
// `data` payload of the standard { success, data } envelope.
import type {
  BlogResponseDTO,
  ClubApplicationDTO,
  ClubApplicationListDTO,
  ClubCollaborativeSaveDTO,
  ClubCollaborativeSaveResultDTO,
  ClubDTO,
  ClubInvitationDTO,
  ClubInvitationListDTO,
  ClubInvitationResponseDTO,
  ClubInvitationResultDTO,
  ClubListDTO,
  ClubMemberDTO,
  ClubMemberListDTO,
  ClubMessageDTO,
  ClubMessageListDTO,
  ClubReviewDTO,
  ClubSubmissionDTO,
  ClubConversationDTO,
  ClubDashboardDTO,
  ClubLandingDTO,
  CreateClubDTO,
  UpdateClubDTO,
} from "@quill/shared";
import { fetchWithAuth } from "../../auth/api/auth.api";
import { API_ROUTES } from "../../../lib/api-routes";

interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

function query(list: PageQuery = {}): string {
  const params = new URLSearchParams();
  if (list.page) params.set("page", String(list.page));
  if (list.limit) params.set("limit", String(list.limit));
  if (list.search) params.set("search", list.search);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// POST /clubs — founder becomes admin; optionally invites handles right away
export async function createClubApi(
  payload: CreateClubDTO,
): Promise<ClubDTO> {
  return fetchWithAuth<ClubDTO>(API_ROUTES.CLUB.CREATE, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// GET /clubs/mine — "Your clubs"
export async function listMyClubsApi(list: PageQuery = {}): Promise<ClubListDTO> {
  return fetchWithAuth<ClubListDTO>(`${API_ROUTES.CLUB.MINE}${query(list)}`);
}

// GET /clubs/discover — open clubs the viewer has not joined
export async function listDiscoverClubsApi(
  list: PageQuery = {},
): Promise<ClubListDTO> {
  return fetchWithAuth<ClubListDTO>(
    `${API_ROUTES.CLUB.DISCOVER}${query(list)}`,
  );
}

// GET /clubs/:id
export async function getClubApi(clubId: string): Promise<ClubDTO> {
  return fetchWithAuth<ClubDTO>(API_ROUTES.CLUB.GET(clubId));
}

// PATCH /clubs/:id — admin only ("Save rules", profile edits)
export async function updateClubApi(
  clubId: string,
  payload: UpdateClubDTO,
): Promise<ClubDTO> {
  return fetchWithAuth<ClubDTO>(API_ROUTES.CLUB.UPDATE(clubId), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// GET /clubs/:id/members
export async function listClubMembersApi(
  clubId: string,
  list: PageQuery = {},
): Promise<ClubMemberListDTO> {
  return fetchWithAuth<ClubMemberListDTO>(
    `${API_ROUTES.CLUB.MEMBERS(clubId)}${query(list)}`,
  );
}

// PATCH /clubs/:id/members/:userId — admin promotes member ↔ moderator
export async function updateClubMemberRoleApi(
  clubId: string,
  userId: string,
  role: ClubMemberDTO["role"],
): Promise<ClubMemberDTO> {
  return fetchWithAuth<ClubMemberDTO>(API_ROUTES.CLUB.MEMBER(clubId, userId), {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// GET /clubs/:id/applications — pending join requests (admin/moderator)
export async function listClubApplicationsApi(
  clubId: string,
  list: PageQuery = {},
): Promise<ClubApplicationListDTO> {
  return fetchWithAuth<ClubApplicationListDTO>(
    `${API_ROUTES.CLUB.APPLICATIONS(clubId)}${query(list)}`,
  );
}

// POST /clubs/:id/applications — apply to an open club (note required)
export async function applyToClubApi(
  clubId: string,
  note: string,
): Promise<ClubApplicationDTO> {
  return fetchWithAuth<ClubApplicationDTO>(
    API_ROUTES.CLUB.APPLICATIONS(clubId),
    { method: "POST", body: JSON.stringify({ note }) },
  );
}

// POST /clubs/:id/applications/:applicationId/decision
export async function decideClubApplicationApi(
  clubId: string,
  applicationId: string,
  decision: "approved" | "rejected",
): Promise<ClubApplicationDTO> {
  return fetchWithAuth<ClubApplicationDTO>(
    API_ROUTES.CLUB.APPLICATION_DECISION(clubId, applicationId),
    { method: "POST", body: JSON.stringify({ decision }) },
  );
}

// POST /clubs/:id/invitations — invite by handle (admin/moderator)
export async function inviteToClubApi(
  clubId: string,
  handles: string[],
): Promise<ClubInvitationResultDTO> {
  return fetchWithAuth<ClubInvitationResultDTO>(API_ROUTES.CLUB.INVITE(clubId), {
    method: "POST",
    body: JSON.stringify({ handles }),
  });
}

// GET /clubs/invitations — the viewer's pending invitations
export async function listClubInvitationsApi(
  list: PageQuery = {},
): Promise<ClubInvitationListDTO> {
  return fetchWithAuth<ClubInvitationListDTO>(
    `${API_ROUTES.CLUB.INVITATIONS}${query(list)}`,
  );
}

// POST /clubs/invitations/:id/accept — Join (adds membership + group chat)
export async function acceptClubInvitationApi(
  invitationId: string,
): Promise<ClubInvitationResponseDTO> {
  return fetchWithAuth<ClubInvitationResponseDTO>(
    API_ROUTES.CLUB.INVITATION_ACCEPT(invitationId),
    { method: "POST", body: "{}" },
  );
}

// POST /clubs/invitations/:id/decline
export async function declineClubInvitationApi(
  invitationId: string,
): Promise<ClubInvitationResponseDTO> {
  return fetchWithAuth<ClubInvitationResponseDTO>(
    API_ROUTES.CLUB.INVITATION_DECLINE(invitationId),
    { method: "POST", body: "{}" },
  );
}

// GET /clubs/:id/submissions — the review queue (admin/moderator)
export async function listClubSubmissionsApi(
  clubId: string,
  list: PageQuery = {},
): Promise<{ items: ClubSubmissionDTO[]; total: number }> {
  return fetchWithAuth(
    `${API_ROUTES.CLUB.SUBMISSIONS(clubId)}${query(list)}`,
  );
}

// POST /clubs/:id/submissions/:blogId/review — approve / request changes / reject
export async function reviewClubSubmissionApi(
  clubId: string,
  blogId: string,
  payload: { decision: ClubReviewDTO["decision"]; note?: string },
): Promise<ClubReviewDTO> {
  return fetchWithAuth<ClubReviewDTO>(
    API_ROUTES.CLUB.SUBMISSION_REVIEW(clubId, blogId),
    { method: "POST", body: JSON.stringify(payload) },
  );
}

// POST /clubs/:id/submissions — submit a draft into the review queue
export async function createClubSubmissionApi(
  clubId: string,
  payload: { title?: string; content?: string; description?: string },
): Promise<BlogResponseDTO> {
  return fetchWithAuth<BlogResponseDTO>(API_ROUTES.CLUB.SUBMISSIONS(clubId), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// POST /clubs/:id/submissions/:blogId/resubmit — re-submit a handled draft
export async function resubmitClubSubmissionApi(
  clubId: string,
  blogId: string,
): Promise<{ blogId: string; clubReviewStatus: "pending" }> {
  return fetchWithAuth(API_ROUTES.CLUB.SUBMISSION_RESUBMIT(clubId, blogId), {
    method: "POST",
  });
}

// GET /clubs/:id/landing — public-facing blog page of a club
export async function getClubLandingApi(
  clubId: string,
  list: PageQuery = {},
): Promise<ClubLandingDTO> {
  return fetchWithAuth<ClubLandingDTO>(
    `${API_ROUTES.CLUB.LANDING(clubId)}${query(list)}`,
  );
}

// GET /clubs/:id/dashboard — admin-only persisted metrics
export async function getClubDashboardApi(
  clubId: string,
): Promise<ClubDashboardDTO> {
  return fetchWithAuth<ClubDashboardDTO>(API_ROUTES.CLUB.DASHBOARD(clubId));
}

// ---- chat ----

// GET /clubs/:id/conversations — the viewer's group + 1:1 conversations
export async function listClubConversationsApi(
  clubId: string,
): Promise<{ items: ClubConversationDTO[] }> {
  return fetchWithAuth(API_ROUTES.CLUB.CONVERSATIONS(clubId));
}

// GET /clubs/:id/conversations/:conversationId/messages — polled page
export async function listClubMessagesApi(
  clubId: string,
  conversationId: string,
  list: PageQuery = {},
): Promise<{ items: ClubMessageDTO[]; total: number }> {
  return fetchWithAuth<ClubMessageListDTO>(
    `${API_ROUTES.CLUB.MESSAGES(clubId, conversationId)}${query(list)}`,
  );
}

// POST /clubs/:id/conversations/:conversationId/messages
export async function sendClubMessageApi(
  clubId: string,
  conversationId: string,
  body: string,
): Promise<ClubMessageDTO> {
  return fetchWithAuth<ClubMessageDTO>(
    API_ROUTES.CLUB.MESSAGES(clubId, conversationId),
    { method: "POST", body: JSON.stringify({ body }) },
  );
}

// POST /clubs/:id/conversations/direct — 1:1 with a member by handle
export async function createClubDirectConversationApi(
  clubId: string,
  handle: string,
): Promise<ClubConversationDTO> {
  return fetchWithAuth<ClubConversationDTO>(
    API_ROUTES.CLUB.DIRECT_CONVERSATION(clubId),
    { method: "POST", body: JSON.stringify({ handle }) },
  );
}

// ---- collaborative drafts ----

// PUT /clubs/:id/drafts/:blogId — versioned collaborative save
export async function saveClubCollaborativeDraftApi(
  clubId: string,
  blogId: string,
  payload: ClubCollaborativeSaveDTO,
): Promise<ClubCollaborativeSaveResultDTO> {
  return fetchWithAuth<ClubCollaborativeSaveResultDTO>(
    API_ROUTES.CLUB.DRAFT_COLLAB_SAVE(clubId, blogId),
    { method: "PUT", body: JSON.stringify(payload) },
  );
}
