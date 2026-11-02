import type {
  ClubModel,
  ClubWithMembershipModel,
  ClubMemberModel,
  ClubMemberWithUserModel,
  ClubApplicationModel,
  ClubApplicationWithUserModel,
  ClubInvitationModel,
  ClubInvitationWithContextModel,
  ClubReviewModel,
  ClubReviewWithReviewerModel,
  ClubCollaboratorModel,
  ClubActivityModel,
  ClubActivityWithActorModel,
  ClubConversationModel,
  ClubConversationWithParticipantsModel,
  ClubConversationParticipantModel,
  ClubConversationParticipantWithUserModel,
  ClubMessageModel,
  ClubMessageWithSenderModel,
  ClubDashboardMetricsModel,
  ClubRole,
  ClubPrivacy,
  ClubApplicationStatus,
  ClubInvitationStatus,
  ClubActivityType,
} from "./club.model";
import { pool } from "../../core/database/db";
import type { PoolClient } from "pg";

interface ClubListResult {
  items: ClubWithMembershipModel[];
  total: number;
}

class ClubRepository {
  // Find a club by ID
  async findById(id: string): Promise<ClubModel | null> {
    const query = `SELECT * FROM clubs WHERE id = $1 LIMIT 1;`;
    const result = await pool.query<ClubModel>(query, [id]);
    return result.rows[0] || null;
  }

  // Find a club by ID with membership context for a viewer
  async findByIdWithMembership(
    id: string,
    viewerId: string,
  ): Promise<ClubWithMembershipModel | null> {
    const query = `
      SELECT c.*,
             cm.role,
             (SELECT COUNT(*)::INT FROM club_members WHERE club_id = c.id) AS member_count,
             (SELECT COUNT(*)::INT FROM blogs WHERE club_id = c.id AND club_review_status = 'pending') AS pending_reviews
      FROM clubs c
      LEFT JOIN club_members cm ON cm.club_id = c.id AND cm.user_id = $2
      WHERE c.id = $1
      LIMIT 1;
    `;
    const result = await pool.query<ClubWithMembershipModel>(query, [
      id,
      viewerId,
    ]);
    return result.rows[0] || null;
  }

  // Create a new club
  async create(club: {
    name: string;
    description: string;
    privacy: ClubPrivacy;
    rules: string[];
    createdBy: string;
  }): Promise<ClubModel> {
    const query = `
      INSERT INTO clubs (name, description, privacy, rules, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query<ClubModel>(query, [
      club.name,
      club.description,
      club.privacy,
      club.rules,
      club.createdBy,
    ]);
    return result.rows[0]!;
  }

  // Update club (partial)
  async update(
    clubId: string,
    data: {
      name?: string;
      description?: string;
      privacy?: ClubPrivacy;
      rules?: string[];
    },
  ): Promise<ClubModel | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      params.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.privacy !== undefined) {
      sets.push(`privacy = $${paramIndex++}`);
      params.push(data.privacy);
    }
    if (data.rules !== undefined) {
      sets.push(`rules = $${paramIndex++}`);
      params.push(data.rules);
    }

    if (sets.length === 0) return this.findById(clubId);

    sets.push("updated_at = NOW()");
    params.push(clubId);

    const query = `
      UPDATE clubs SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *;
    `;
    const result = await pool.query<ClubModel>(query, params);
    return result.rows[0] || null;
  }

  // Delete a club
  async delete(clubId: string): Promise<boolean> {
    const query = `DELETE FROM clubs WHERE id = $1;`;
    const result = await pool.query(query, [clubId]);
    return (result.rowCount ?? 0) > 0;
  }

  // List clubs for a user (My Clubs)
  async listUserClubs(
    userId: string,
    page: number,
    limit: number,
  ): Promise<ClubListResult> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT c.*,
             cm.role,
             (SELECT COUNT(*)::INT FROM club_members WHERE club_id = c.id) AS member_count,
             (SELECT COUNT(*)::INT FROM blogs WHERE club_id = c.id AND club_review_status = 'pending') AS pending_reviews,
             COUNT(*) OVER() AS total_count
      FROM clubs c
      JOIN club_members cm ON cm.club_id = c.id
      WHERE cm.user_id = $1
      ORDER BY cm.joined_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      ClubWithMembershipModel & { total_count: string }
    >(query, [userId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Discover open clubs (not a member, privacy = open)
  async listDiscoverClubs(
    viewerId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<ClubListResult> {
    const offset = (page - 1) * limit;
    const values: unknown[] = [viewerId];
    let searchFilter = "";
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      searchFilter = `AND LOWER(c.name) LIKE $${values.length}`;
    }
    values.push(limit, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const query = `
      SELECT c.*,
             NULL::TEXT AS role,
             (SELECT COUNT(*)::INT FROM club_members WHERE club_id = c.id) AS member_count,
             0 AS pending_reviews,
             COUNT(*) OVER() AS total_count
      FROM clubs c
      WHERE c.privacy = 'open'
        AND NOT EXISTS (SELECT 1 FROM club_members WHERE club_id = c.id AND user_id = $1)
        ${searchFilter}
      ORDER BY c.created_at DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex};
    `;
    const result = await pool.query<
      ClubWithMembershipModel & { total_count: string }
    >(query, values);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // List pending invitations for a user
  async listPendingInvitations(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ClubInvitationWithContextModel[]; total: number }> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT ci.*, c.name AS club_name, c.privacy AS club_privacy,
             u.name AS inviter_name, u.handle AS inviter_handle, u.avatar AS inviter_avatar,
             COUNT(*) OVER() AS total_count
      FROM club_invitations ci
      JOIN clubs c ON c.id = ci.club_id
      JOIN users u ON u.id = ci.inviter_id
      WHERE ci.invitee_id = $1 AND ci.status = 'pending'
      ORDER BY ci.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      ClubInvitationWithContextModel & { total_count: string }
    >(query, [userId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // --- Membership ---

  // Get membership for a user in a club
  async getMembership(
    clubId: string,
    userId: string,
  ): Promise<ClubMemberModel | null> {
    const query = `
      SELECT * FROM club_members WHERE club_id = $1 AND user_id = $2 LIMIT 1;
    `;
    const result = await pool.query<ClubMemberModel>(query, [clubId, userId]);
    return result.rows[0] || null;
  }

  // Create membership (creator becomes admin)
  async createMembership(
    clubId: string,
    userId: string,
    role: ClubRole = "member",
  ): Promise<ClubMemberModel> {
    const query = `
      INSERT INTO club_members (club_id, user_id, role)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query<ClubMemberModel>(query, [
      clubId,
      userId,
      role,
    ]);
    return result.rows[0]!;
  }

  // Chat Hall heartbeat — stamps the sender's presence; "online" members are
  // simply rows whose last_seen_at is fresh when the sidebar is read
  async touchPresence(clubId: string, userId: string): Promise<void> {
    await pool.query(
      `UPDATE club_members SET last_seen_at = NOW()
       WHERE club_id = $1 AND user_id = $2;`,
      [clubId, userId],
    );
  }

  // Update member role
  async updateMemberRole(
    clubId: string,
    userId: string,
    role: ClubRole,
  ): Promise<ClubMemberModel | null> {
    const query = `
      UPDATE club_members SET role = $3 WHERE club_id = $1 AND user_id = $2 RETURNING *;
    `;
    const result = await pool.query<ClubMemberModel>(query, [
      clubId,
      userId,
      role,
    ]);
    return result.rows[0] || null;
  }

  // Remove member
  async removeMember(clubId: string, userId: string): Promise<boolean> {
    const query = `DELETE FROM club_members WHERE club_id = $1 AND user_id = $2;`;
    const result = await pool.query(query, [clubId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // List club members with user profiles; last_seen_at feeds the Chat Hall
  // presence dots ("online" is computed in the service layer)
  async listMembers(
    clubId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ClubMemberWithUserModel[]; total: number }> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT cm.*, u.name AS user_name, u.handle AS user_handle, u.avatar AS user_avatar,
             COUNT(*) OVER() AS total_count
      FROM club_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.club_id = $1
      ORDER BY
        CASE cm.role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
        cm.joined_at ASC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      ClubMemberWithUserModel & { total_count: string }
    >(query, [clubId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Count admins in a club
  async countAdmins(clubId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::INT AS count FROM club_members WHERE club_id = $1 AND role = 'admin';
    `;
    const result = await pool.query<{ count: number }>(query, [clubId]);
    return result.rows[0]?.count ?? 0;
  }

  // One application by id (the review decision workflow starts here)
  async getApplication(
    applicationId: string,
  ): Promise<ClubApplicationModel | null> {
    const query = `
      SELECT * FROM club_applications WHERE id = $1 LIMIT 1;
    `;
    const result = await pool.query<ClubApplicationModel>(query, [
      applicationId,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Approve an application AND make the applicant a member in one
   * transaction: application decision, membership row (deduped), group
   * conversation participant and activity entry either all land or none do.
   * Returns false when the application was not pending for that club/user
   * (already handled, wrong club, or raced with another reviewer).
   */
  async approveApplication(data: {
    applicationId: string;
    clubId: string;
    userId: string;
    decidedBy: string;
    activity?: {
      actorId: string | null;
      type: ClubActivityType;
      detail: string;
    };
  }): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const decided = await client.query(
        `
          UPDATE club_applications
          SET status = 'approved', decided_at = NOW(), decided_by = $3
          WHERE id = $1 AND club_id = $2 AND user_id = $4 AND status = 'pending'
          RETURNING *;
        `,
        [data.applicationId, data.clubId, data.decidedBy, data.userId],
      );
      if (decided.rowCount === 0) {
        await client.query("ROLLBACK");
        return false;
      }

      this.writeMembershipWithin(
        client,
        data.clubId,
        data.userId,
        "member",
        data.activity,
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Accept an invitation AND join the club in one transaction: invitation
   * acceptance, membership (deduped), group-conversation participant and
   * activity entry land together. Returns the invitation row, or null when
   * there was no pending invitation to accept.
   */
  async acceptInvitation(data: {
    invitationId: string;
    inviteeId: string;
    activity?: {
      actorId: string | null;
      type: ClubActivityType;
      detail: string;
    };
  }): Promise<ClubInvitationModel | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const accepted = await client.query<ClubInvitationModel>(
        `
          UPDATE club_invitations
          SET status = 'accepted', responded_at = NOW()
          WHERE id = $1 AND invitee_id = $2 AND status = 'pending'
          RETURNING *;
        `,
        [data.invitationId, data.inviteeId],
      );
      const invitation = accepted.rows[0] ?? null;
      if (!invitation) {
        await client.query("ROLLBACK");
        return null;
      }

      this.writeMembershipWithin(
        client,
        invitation.club_id,
        data.inviteeId,
        "member",
        data.activity,
      );

      await client.query("COMMIT");
      return invitation;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Founding a club: admin membership + the group conversation the founder
  // speaks in, all in the same transaction as the activity entry
  async createFounderMembership(data: {
    clubId: string;
    userId: string;
    activity?: {
      actorId: string | null;
      type: ClubActivityType;
      detail: string;
    };
  }): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await this.writeMembershipWithin(
        client,
        data.clubId,
        data.userId,
        "admin",
        data.activity,
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Membership + group-conversation participant + activity, on a caller's
  // open transaction (see approveApplication / acceptInvitation).
  private async writeMembershipWithin(
    client: PoolClient,
    clubId: string,
    userId: string,
    role: ClubRole,
    activity?: {
      actorId: string | null;
      type: ClubActivityType;
      detail: string;
    },
  ): Promise<void> {
    await client.query(
      `
        INSERT INTO club_members (club_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (club_id, user_id) DO NOTHING;
      `,
      [clubId, userId, role],
    );

    // The club's group conversation — exactly one per club (partial unique
    // index). Insert-or-catch-conflict, then re-select the row.
    await client.query(
      `
        INSERT INTO club_conversations (club_id, is_group)
        VALUES ($1, TRUE)
        ON CONFLICT (club_id) WHERE is_group
        DO NOTHING;
      `,
      [clubId],
    );
    const conversation = await client.query<{ id: string }>(
      `SELECT id FROM club_conversations WHERE club_id = $1 AND is_group = TRUE LIMIT 1;`,
      [clubId],
    );
    if (conversation.rows[0]) {
      await client.query(
        `
          INSERT INTO club_conversation_participants (conversation_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT (conversation_id, user_id) DO NOTHING;
        `,
        [conversation.rows[0].id, userId],
      );
    }

    if (activity) {
      await client.query(
        `
          INSERT INTO club_activity (club_id, actor_id, type, detail)
          VALUES ($1, $2, $3, $4);
        `,
        [clubId, activity.actorId, activity.type, activity.detail],
      );
    }
  }

  // --- Applications ---

  // Create application
  async createApplication(data: {
    clubId: string;
    userId: string;
    note: string;
  }): Promise<ClubApplicationModel> {
    const query = `
      INSERT INTO club_applications (club_id, user_id, note)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query<ClubApplicationModel>(query, [
      data.clubId,
      data.userId,
      data.note,
    ]);
    return result.rows[0]!;
  }

  // Get pending application for a user in a club
  async getPendingApplication(
    clubId: string,
    userId: string,
  ): Promise<ClubApplicationModel | null> {
    const query = `
      SELECT * FROM club_applications
      WHERE club_id = $1 AND user_id = $2 AND status = 'pending'
      LIMIT 1;
    `;
    const result = await pool.query<ClubApplicationModel>(query, [
      clubId,
      userId,
    ]);
    return result.rows[0] || null;
  }

  // Decide on application (approve/reject)
  async decideApplication(
    applicationId: string,
    decidedBy: string,
    status: "approved" | "rejected",
  ): Promise<ClubApplicationModel | null> {
    const query = `
      UPDATE club_applications
      SET status = $2, decided_at = NOW(), decided_by = $3
      WHERE id = $1 AND status = 'pending'
      RETURNING *;
    `;
    const result = await pool.query<ClubApplicationModel>(query, [
      applicationId,
      status,
      decidedBy,
    ]);
    return result.rows[0] || null;
  }

  // List pending applications for a club (review queue)
  async listPendingApplications(
    clubId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ClubApplicationWithUserModel[]; total: number }> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT ca.*, u.name AS user_name, u.handle AS user_handle, u.avatar AS user_avatar,
             COUNT(*) OVER() AS total_count
      FROM club_applications ca
      JOIN users u ON u.id = ca.user_id
      WHERE ca.club_id = $1 AND ca.status = 'pending'
      ORDER BY ca.created_at ASC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      ClubApplicationWithUserModel & { total_count: string }
    >(query, [clubId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Count pending applications for a club
  async countPendingApplications(clubId: string): Promise<number> {
    const query = `
      SELECT COUNT(*)::INT AS count FROM club_applications
      WHERE club_id = $1 AND status = 'pending';
    `;
    const result = await pool.query<{ count: number }>(query, [clubId]);
    return result.rows[0]?.count ?? 0;
  }

  // --- Invitations ---

  // Create invitation
  async createInvitation(data: {
    clubId: string;
    inviterId: string;
    inviteeId: string;
  }): Promise<ClubInvitationModel> {
    const query = `
      INSERT INTO club_invitations (club_id, inviter_id, invitee_id)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query<ClubInvitationModel>(query, [
      data.clubId,
      data.inviterId,
      data.inviteeId,
    ]);
    return result.rows[0]!;
  }

  // Get pending invitation
  async getPendingInvitation(
    clubId: string,
    inviteeId: string,
  ): Promise<ClubInvitationModel | null> {
    const query = `
      SELECT * FROM club_invitations
      WHERE club_id = $1 AND invitee_id = $2 AND status = 'pending'
      LIMIT 1;
    `;
    const result = await pool.query<ClubInvitationModel>(query, [
      clubId,
      inviteeId,
    ]);
    return result.rows[0] || null;
  }

  // Respond to invitation
  async respondInvitation(
    invitationId: string,
    inviteeId: string,
    status: "accepted" | "declined",
  ): Promise<ClubInvitationModel | null> {
    const query = `
      UPDATE club_invitations
      SET status = $3, responded_at = NOW()
      WHERE id = $1 AND invitee_id = $2 AND status = 'pending'
      RETURNING *;
    `;
    const result = await pool.query<ClubInvitationModel>(query, [
      invitationId,
      inviteeId,
      status,
    ]);
    return result.rows[0] || null;
  }

  // --- Reviews ---

  // Create review record
  async createReview(data: {
    blogId: string;
    clubId: string;
    reviewerId: string;
    decision: "approved" | "changes_requested" | "rejected";
    note: string | null;
  }): Promise<ClubReviewModel> {
    const query = `
      INSERT INTO club_reviews (blog_id, club_id, reviewer_id, decision, note)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await pool.query<ClubReviewModel>(query, [
      data.blogId,
      data.clubId,
      data.reviewerId,
      data.decision,
      data.note,
    ]);
    return result.rows[0]!;
  }

  // Get reviews for a blog
  async getReviewsForBlog(
    blogId: string,
  ): Promise<ClubReviewWithReviewerModel[]> {
    const query = `
      SELECT cr.*, u.name AS reviewer_name, u.handle AS reviewer_handle, u.avatar AS reviewer_avatar
      FROM club_reviews cr
      LEFT JOIN users u ON u.id = cr.reviewer_id
      WHERE cr.blog_id = $1
      ORDER BY cr.created_at DESC;
    `;
    const result = await pool.query<ClubReviewWithReviewerModel>(query, [
      blogId,
    ]);
    return result.rows;
  }

  // --- Collaborators ---

  // Add collaborator to a blog
  async addCollaborator(
    blogId: string,
    userId: string,
  ): Promise<ClubCollaboratorModel> {
    const query = `
      INSERT INTO club_collaborators (blog_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (blog_id, user_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query<ClubCollaboratorModel>(query, [
      blogId,
      userId,
    ]);
    return result.rows[0]!;
  }

  // Remove collaborator
  async removeCollaborator(blogId: string, userId: string): Promise<boolean> {
    const query = `DELETE FROM club_collaborators WHERE blog_id = $1 AND user_id = $2;`;
    const result = await pool.query(query, [blogId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // List collaborators for a blog
  async listCollaborators(blogId: string): Promise<ClubCollaboratorModel[]> {
    const query = `SELECT * FROM club_collaborators WHERE blog_id = $1;`;
    const result = await pool.query<ClubCollaboratorModel>(query, [blogId]);
    return result.rows;
  }

  // Check if user is a collaborator
  async isCollaborator(blogId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM club_collaborators WHERE blog_id = $1 AND user_id = $2 LIMIT 1;
    `;
    const result = await pool.query(query, [blogId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // --- Activity ---

  // Log activity
  async logActivity(data: {
    clubId: string;
    actorId: string | null;
    type: ClubActivityType;
    detail: string;
  }): Promise<ClubActivityModel> {
    const query = `
      INSERT INTO club_activity (club_id, actor_id, type, detail)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const result = await pool.query<ClubActivityModel>(query, [
      data.clubId,
      data.actorId,
      data.type,
      data.detail,
    ]);
    return result.rows[0]!;
  }

  // Get recent activity for dashboard
  async getRecentActivity(
    clubId: string,
    limit = 20,
  ): Promise<ClubActivityWithActorModel[]> {
    const query = `
      SELECT ca.*, u.name AS actor_name, u.handle AS actor_handle, u.avatar AS actor_avatar
      FROM club_activity ca
      LEFT JOIN users u ON u.id = ca.actor_id
      WHERE ca.club_id = $1
      ORDER BY ca.created_at DESC
      LIMIT $2;
    `;
    const result = await pool.query<ClubActivityWithActorModel>(query, [
      clubId,
      limit,
    ]);
    return result.rows;
  }

  // --- Conversations ---

  // Get or create group conversation for a club
  async getOrCreateGroupConversation(
    clubId: string,
  ): Promise<ClubConversationModel> {
    const query = `
      INSERT INTO club_conversations (club_id, is_group)
      VALUES ($1, TRUE)
      ON CONFLICT (club_id) WHERE is_group
      DO UPDATE SET updated_at = NOW()
      RETURNING *;
    `;
    const result = await pool.query<ClubConversationModel>(query, [clubId]);
    return result.rows[0]!;
  }

  // Get group conversation for a club
  async getGroupConversation(
    clubId: string,
  ): Promise<ClubConversationModel | null> {
    const query = `
      SELECT * FROM club_conversations WHERE club_id = $1 AND is_group = TRUE LIMIT 1;
    `;
    const result = await pool.query<ClubConversationModel>(query, [clubId]);
    return result.rows[0] || null;
  }

  // One conversation scoped to a club — scoping is the club's access boundary:
  // a conversation id alone must never be addressable across clubs
  async findConversationById(
    clubId: string,
    conversationId: string,
  ): Promise<ClubConversationModel | null> {
    const query = `
      SELECT * FROM club_conversations WHERE id = $2 AND club_id = $1 LIMIT 1;
    `;
    const result = await pool.query<ClubConversationModel>(query, [
      clubId,
      conversationId,
    ]);
    return result.rows[0] || null;
  }

  // Get conversations for a user in a club (group + 1:1)
  async listUserConversationsInClub(
    clubId: string,
    userId: string,
  ): Promise<ClubConversationWithParticipantsModel[]> {
    const query = `
      SELECT cc.*, 
             json_agg(
               json_build_object(
                 'conversation_id', ccp.conversation_id,
                 'user_id', ccp.user_id,
                 'joined_at', ccp.joined_at,
                 'user_name', u.name,
                 'user_handle', u.handle,
                 'user_avatar', u.avatar
               )
             ) FILTER (WHERE ccp.user_id IS NOT NULL) AS participants
      FROM club_conversations cc
      JOIN club_conversation_participants ccp ON ccp.conversation_id = cc.id
      LEFT JOIN users u ON u.id = ccp.user_id
      WHERE cc.club_id = $1 AND ccp.user_id = $2
      GROUP BY cc.id
      ORDER BY cc.updated_at DESC;
    `;
    const result = await pool.query(query, [clubId, userId]);
    return result.rows as ClubConversationWithParticipantsModel[];
  }

  // Add participant to conversation
  async addConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ClubConversationParticipantModel> {
    const query = `
      INSERT INTO club_conversation_participants (conversation_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (conversation_id, user_id) DO NOTHING
      RETURNING *;
    `;
    const result = await pool.query<ClubConversationParticipantModel>(query, [
      conversationId,
      userId,
    ]);
    return result.rows[0]!;
  }

  // Get conversation participants
  async getConversationParticipants(
    conversationId: string,
  ): Promise<ClubConversationParticipantWithUserModel[]> {
    const query = `
      SELECT ccp.*, u.name AS user_name, u.handle AS user_handle, u.avatar AS user_avatar
      FROM club_conversation_participants ccp
      JOIN users u ON u.id = ccp.user_id
      WHERE ccp.conversation_id = $1;
    `;
    const result = await pool.query<ClubConversationParticipantWithUserModel>(
      query,
      [conversationId],
    );
    return result.rows;
  }

  // Check if user is participant in conversation
  async isConversationParticipant(
    conversationId: string,
    userId: string,
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM club_conversation_participants
      WHERE conversation_id = $1 AND user_id = $2 LIMIT 1;
    `;
    const result = await pool.query(query, [conversationId, userId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Create 1:1 conversation between two club members
  async createOrGetDirectConversation(
    clubId: string,
    userId1: string,
    userId2: string,
  ): Promise<ClubConversationModel> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find existing 1:1 conversation between these two users in this club
      const existingQuery = `
        SELECT cc.id FROM club_conversations cc
        JOIN club_conversation_participants ccp1 ON ccp1.conversation_id = cc.id
        JOIN club_conversation_participants ccp2 ON ccp2.conversation_id = cc.id
        WHERE cc.club_id = $1
          AND cc.is_group = FALSE
          AND ccp1.user_id = $2
          AND ccp2.user_id = $3
        LIMIT 1;
      `;
      const existing = await client.query<{ id: string }>(existingQuery, [
        clubId,
        userId1,
        userId2,
      ]);

      if (existing.rows[0]) {
        await client.query("COMMIT");
        return existing.rows[0] as ClubConversationModel;
      }

      // Create new conversation
      const convResult = await client.query<ClubConversationModel>(
        `INSERT INTO club_conversations (club_id, is_group) VALUES ($1, FALSE) RETURNING *;`,
        [clubId],
      );
      const conversation = convResult.rows[0]!;

      // Add both participants
      await client.query(
        `INSERT INTO club_conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3);`,
        [conversation.id, userId1, userId2],
      );

      await client.query("COMMIT");
      return conversation;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // --- Messages ---

  // Send message — body may be empty when an image is attached (the DB CHECK
  // allows either); attachment_url is the relative /uploads/… path
  async sendMessage(data: {
    conversationId: string;
    senderId: string;
    body: string;
    attachmentUrl?: string | null;
  }): Promise<ClubMessageModel> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const msgResult = await client.query<ClubMessageModel>(
        `INSERT INTO club_messages (conversation_id, sender_id, body, attachment_url)
         VALUES ($1, $2, $3, $4) RETURNING *;`,
        [
          data.conversationId,
          data.senderId,
          data.body,
          data.attachmentUrl ?? null,
        ],
      );

      // Update conversation updated_at
      await client.query(
        `UPDATE club_conversations SET updated_at = NOW() WHERE id = $1;`,
        [data.conversationId],
      );

      await client.query("COMMIT");
      return msgResult.rows[0]!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // One message by id (with sender profile) — used to check mod rights on delete
  async getMessageById(
    messageId: string,
  ): Promise<ClubMessageWithSenderModel | null> {
    const query = `
      SELECT cm.*, u.name AS sender_name, u.handle AS sender_handle, u.avatar AS sender_avatar
      FROM club_messages cm
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.id = $1
      LIMIT 1;
    `;
    const result = await pool.query<ClubMessageWithSenderModel>(query, [
      messageId,
    ]);
    return result.rows[0] || null;
  }

  // Soft-delete a message: content is blanked but the row stays so the club's
  // moderation history is never lost
  async deleteMessage(messageId: string, deletedBy: string): Promise<boolean> {
    const query = `
      UPDATE club_messages
      SET body = '', attachment_url = NULL,
          deleted_at = NOW(), deleted_by = $2
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const result = await pool.query(query, [messageId, deletedBy]);
    return (result.rowCount ?? 0) > 0;
  }

  // Get messages for a conversation
  async getMessages(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ClubMessageWithSenderModel[]; total: number }> {
    const offset = (page - 1) * limit;
    const query = `
      SELECT cm.*, u.name AS sender_name, u.handle AS sender_handle, u.avatar AS sender_avatar,
             COUNT(*) OVER() AS total_count
      FROM club_messages cm
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.conversation_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await pool.query<
      ClubMessageWithSenderModel & { total_count: string }
    >(query, [conversationId, limit, offset]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // --- Dashboard metrics ---

  async getDashboardMetrics(
    clubId: string,
  ): Promise<ClubDashboardMetricsModel> {
    const [membersResult, publishedResult, pendingResult, activityResult] =
      await Promise.all([
        pool.query<{ count: number }>(
          `SELECT COUNT(*)::INT AS count FROM club_members WHERE club_id = $1;`,
          [clubId],
        ),
        pool.query<{ count: number }>(
          `SELECT COUNT(*)::INT AS count FROM blogs WHERE club_id = $1 AND status = 'published';`,
          [clubId],
        ),
        pool.query<{ count: number }>(
          `SELECT COUNT(*)::INT AS count FROM blogs WHERE club_id = $1 AND club_review_status = 'pending';`,
          [clubId],
        ),
        this.getRecentActivity(clubId, 20),
      ]);

    return {
      total_members: membersResult.rows[0]?.count ?? 0,
      published_posts: publishedResult.rows[0]?.count ?? 0,
      pending_reviews: pendingResult.rows[0]?.count ?? 0,
      recent_activity: activityResult,
    };
  }
}

export default ClubRepository;
