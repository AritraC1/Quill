// Club domain models — typed row shapes returned by Postgres queries

export type ClubPrivacy = "open" | "invite";
export type ClubRole = "admin" | "moderator" | "member";
export type ClubApplicationStatus = "pending" | "approved" | "rejected";
export type ClubInvitationStatus = "pending" | "accepted" | "declined";
export type ClubReviewDecision = "approved" | "changes_requested" | "rejected";
export type ClubActivityType =
  | "member_joined"
  | "submission"
  | "review_decision"
  | "post_published"
  | "role_changed"
  | "application";

// Core club row
export interface ClubModel {
  id: string;
  name: string;
  description: string;
  privacy: ClubPrivacy;
  rules: string[]; // TEXT[] in Postgres
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// Club with membership context for the current viewer
export interface ClubWithMembershipModel extends ClubModel {
  role: ClubRole | null; // null = not a member
  member_count: number;
  pending_reviews: number;
}

// Membership row
export interface ClubMemberModel {
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: Date;
  /** Chat Hall heartbeat timestamp; null = never opened the club chat */
  last_seen_at: Date | null;
}

// Membership with user profile for lists
export interface ClubMemberWithUserModel extends ClubMemberModel {
  user_name: string;
  user_handle: string | null;
  user_avatar: string | null;
}

// Join application row
export interface ClubApplicationModel {
  id: string;
  club_id: string;
  user_id: string;
  note: string;
  status: ClubApplicationStatus;
  created_at: Date;
  decided_at: Date | null;
  decided_by: string | null;
}

// Application with user profile for review queue
export interface ClubApplicationWithUserModel extends ClubApplicationModel {
  user_name: string;
  user_handle: string | null;
  user_avatar: string | null;
}

// Invitation row
export interface ClubInvitationModel {
  id: string;
  club_id: string;
  inviter_id: string;
  invitee_id: string;
  status: ClubInvitationStatus;
  created_at: Date;
  responded_at: Date | null;
}

// Invitation with club and inviter info for the invitee
export interface ClubInvitationWithContextModel extends ClubInvitationModel {
  club_name: string;
  club_privacy: ClubPrivacy;
  inviter_name: string;
  inviter_handle: string | null;
  inviter_avatar: string | null;
}

// Review history row
export interface ClubReviewModel {
  id: string;
  blog_id: string;
  club_id: string;
  reviewer_id: string | null;
  decision: ClubReviewDecision;
  note: string | null;
  created_at: Date;
}

// Review with reviewer profile
export interface ClubReviewWithReviewerModel extends ClubReviewModel {
  reviewer_name: string | null;
  reviewer_handle: string | null;
  reviewer_avatar: string | null;
}

// Collaborator row
export interface ClubCollaboratorModel {
  blog_id: string;
  user_id: string;
  added_at: Date;
}

// Activity row
export interface ClubActivityModel {
  id: string;
  club_id: string;
  actor_id: string | null;
  type: ClubActivityType;
  detail: string;
  created_at: Date;
}

// Activity with actor profile
export interface ClubActivityWithActorModel extends ClubActivityModel {
  actor_name: string | null;
  actor_handle: string | null;
  actor_avatar: string | null;
}

// Conversation row
export interface ClubConversationModel {
  id: string;
  club_id: string;
  is_group: boolean;
  created_at: Date;
  updated_at: Date;
}

// Conversation with participants
export interface ClubConversationWithParticipantsModel extends ClubConversationModel {
  participants: ClubConversationParticipantModel[];
}

// Participant row
export interface ClubConversationParticipantModel {
  conversation_id: string;
  user_id: string;
  joined_at: Date;
}

// Participant with user profile
export interface ClubConversationParticipantWithUserModel extends ClubConversationParticipantModel {
  user_name: string;
  user_handle: string | null;
  user_avatar: string | null;
}

// Message row
export interface ClubMessageModel {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  /** Relative /uploads/… path of an attached image (same storage as avatars) */
  attachment_url: string | null;
  /** Soft deletion — admins/moderators (or the sender) remove from view,
   * the row stays so moderation history is preserved */
  deleted_at: Date | null;
  deleted_by: string | null;
  created_at: Date;
}

// Message with sender profile
export interface ClubMessageWithSenderModel extends ClubMessageModel {
  sender_name: string;
  sender_handle: string | null;
  sender_avatar: string | null;
}

// Dashboard metrics
export interface ClubDashboardMetricsModel {
  total_members: number;
  published_posts: number;
  pending_reviews: number;
  recent_activity: ClubActivityWithActorModel[];
}
