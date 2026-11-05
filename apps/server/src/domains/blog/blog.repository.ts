import type { BlogWithAuthorModel, BlogModel } from "./blog.model";
import type { CreateBlogDTO, UpdateBlogDTO } from "@quill/shared";
import { pool } from "../../core/database/db";

interface BlogListResult {
  items: BlogWithAuthorModel[];
  total: number;
}

class BlogRepository {
  // find a blog by id
  async findBlogById(id: string): Promise<BlogModel | null> {
    const query = `
            SELECT * FROM blogs WHERE id = $1 LIMIT 1;
        `;

    const result = await pool.query<BlogModel>(query, [id]);
    return result.rows[0] || null;
  }

  // find a blog by title
  async findBlogByTitle(title: string): Promise<BlogModel | null> {
    const query = `
            SELECT * FROM blogs WHERE title = $1 LIMIT 1;
        `;

    const result = await pool.query<BlogModel>(query, [title]);
    return result.rows[0] || null;
  }

  // find a blog with its author and the viewer's bookmark flag
  async findBlogWithAuthor(
    id: string,
    viewerId: string,
  ): Promise<BlogWithAuthorModel | null> {
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   EXISTS (
                        SELECT 1 FROM blog_bookmarks bk
                        WHERE bk.blog_id = b.id AND bk.user_id = $2
                    ) AS bookmarked
             FROM blogs b
             JOIN users u ON u.id = b.user_id
             WHERE b.id = $1
             LIMIT 1;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [id, viewerId]);
    return result.rows[0] || null;
  }

  // Create a new blog — always starts as a draft until published explicitly
  async createNewBlog(userId: string, data: CreateBlogDTO): Promise<BlogModel> {
    const query = `
            INSERT INTO blogs (user_id, title, content, blog_description, images, genres, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'draft')
            RETURNING *, blog_description AS description;
        `;

    const result = await pool.query<BlogModel>(query, [
      userId,
      data.title ?? "",
      data.content ?? "",
      data.description ?? "",
      data.images ?? null,
      data.genres ?? [],
    ]);
    return result.rows[0]!;
  }

  // Create a club member's submission — a draft attributed to the club that
  // immediately enters the club's review queue (club_review_status = 'pending')
  async createBlogInClub(
    userId: string,
    clubId: string,
    data: CreateBlogDTO,
  ): Promise<BlogModel> {
    const query = `
            INSERT INTO blogs (user_id, club_id, club_review_status, title, content, blog_description, images, genres, status)
            VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, 'draft')
            RETURNING *, blog_description AS description;
        `;

    const result = await pool.query<BlogModel>(query, [
      userId,
      clubId,
      data.title ?? "",
      data.content ?? "",
      data.description ?? "",
      data.images ?? null,
      data.genres ?? [],
    ]);
    return result.rows[0]!;
  }

  // Move a club submission through its review state (pending guard exists in
  // the service). Approvals clear the state in approveClubBlog instead.
  async setClubReviewStatus(
    blogId: string,
    status: "changes_requested" | "rejected" | "pending" | null,
  ): Promise<BlogModel | null> {
    const query = `
            UPDATE blogs
            SET club_review_status = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *, blog_description AS description;
        `;

    const result = await pool.query<BlogModel>(query, [blogId, status]);
    return result.rows[0] ?? null;
  }

  // Atomics of an approval: publishing publicly AND clearing the live review
  // state in one statement. Only a pending club draft can pass the WHERE.
  async approveClubBlog(blogId: string): Promise<BlogModel | null> {
    const query = `
            UPDATE blogs
            SET status = 'published',
                published_at = COALESCE(published_at, NOW()),
                scheduled_publish_at = NULL,
                club_review_status = NULL,
                updated_at = NOW()
            WHERE id = $1
              AND club_id IS NOT NULL
              AND club_review_status = 'pending'
              AND status <> 'published'
            RETURNING *, blog_description AS description;
        `;

    const result = await pool.query<BlogModel>(query, [blogId]);
    return result.rows[0] ?? null;
  }

  // Collaborative draft save with optimistic concurrency: the UPDATE only
  // lands when the caller saw the current version. Bumps version + 1.
  async updateBlogVersioned(
    blogId: string,
    data: UpdateBlogDTO,
    expectedVersion: number,
  ): Promise<BlogModel | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      sets.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.content !== undefined) {
      sets.push(`content = $${paramIndex++}`);
      params.push(data.content);
    }
    if (data.description !== undefined) {
      sets.push(`blog_description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.images !== undefined) {
      sets.push(`images = $${paramIndex++}`);
      params.push(data.images);
    }
    if (data.genres !== undefined) {
      sets.push(`genres = $${paramIndex++}`);
      params.push(data.genres);
    }

    if (sets.length === 0) return this.findBlogById(blogId);

    sets.push(`version = version + 1`);
    sets.push("updated_at = NOW()");

    const query = `
            UPDATE blogs
            SET ${sets.join(", ")}
            WHERE id = $${paramIndex++} AND version = $${paramIndex} AND status = 'draft'
            RETURNING *, blog_description AS description;
        `;
    params.push(blogId, expectedVersion);

    const result = await pool.query<BlogModel>(query, params);
    return result.rows[0] ?? null;
  }

  // Update a blog — partial update, omitted fields keep their current value
  async updateBlog(
    blogId: string,
    data: UpdateBlogDTO,
  ): Promise<BlogModel | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      sets.push(`title = $${paramIndex++}`);
      params.push(data.title);
    }
    if (data.content !== undefined) {
      sets.push(`content = $${paramIndex++}`);
      params.push(data.content);
    }
    if (data.description !== undefined) {
      sets.push(`blog_description = $${paramIndex++}`);
      params.push(data.description);
    }
    if (data.images !== undefined) {
      sets.push(`images = $${paramIndex++}`);
      params.push(data.images);
    }
    if (data.genres !== undefined) {
      sets.push(`genres = $${paramIndex++}`);
      params.push(data.genres);
    }

    sets.push("updated_at = NOW()");

    const query = `
            UPDATE blogs
            SET ${sets.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING *;
        `;
    params.push(blogId);

    const result = await pool.query<BlogModel>(query, params);
    return result.rows[0] ?? null;
  }

  // Publish a blog (draft -> published); keeps the first publish date.
  // Idempotent: already-published rows are left alone, so a stale delayed
  // scheduler job that fires after a manual instant publish is a no-op.
  async publishBlog(blogId: string): Promise<BlogModel | null> {
    const query = `
            UPDATE blogs
            SET status = 'published',
                published_at = COALESCE(published_at, NOW()),
                scheduled_publish_at = NULL,
                updated_at = NOW()
            WHERE id = $1 AND status <> 'published'
            RETURNING *;
        `;

    const result = await pool.query<BlogModel>(query, [blogId]);
    return result.rows[0] ?? null;
  }

  // Store a future publish datetime — the blog stays a draft until the
  // publishing worker flips it live at that moment
  async scheduleBlog(
    blogId: string,
    publishAt: Date,
  ): Promise<BlogModel | null> {
    const query = `
            UPDATE blogs
            SET scheduled_publish_at = $2,
                updated_at = NOW()
            WHERE id = $1 AND status <> 'published'
            RETURNING *;
        `;

    const result = await pool.query<BlogModel>(query, [blogId, publishAt]);
    return result.rows[0] ?? null;
  }

  // Drop a pending scheduled publish (blog remains a draft, no job runs later)
  async cancelSchedule(blogId: string): Promise<BlogModel | null> {
    const query = `
            UPDATE blogs
            SET scheduled_publish_at = NULL,
                updated_at = NOW()
            WHERE id = $1 AND scheduled_publish_at IS NOT NULL
            RETURNING *;
        `;

    const result = await pool.query<BlogModel>(query, [blogId]);
    return result.rows[0] ?? null;
  }

  // Delete a blog
  async deleteBlog(blogId: string): Promise<boolean> {
    const query = `
            DELETE FROM blogs WHERE id = $1;
        `;

    const result = await pool.query(query, [blogId]);
    return (result.rowCount ?? 0) > 0;
  }

  // Get a user's blogs, optionally filtered by status (pagination included)
  async listUserBlogs(
    userId: string,
    status: "draft" | "published",
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.user_id = $1 AND b.status = $2
            ORDER BY b.updated_at DESC, b.id
            LIMIT $3 OFFSET $4;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [
      userId,
      status,
      limit,
      offset,
    ]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Get all published blogs (the feed), with viewer bookmark flag
  // Optional `authorId` filters by author. Optional `search` does full-text search.
  async listPublishedBlogs(
    viewerId: string,
    authorId: string | null,
    page: number,
    limit: number,
    search?: string,
    preferredGenres: string[] = [],
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const values: unknown[] = [viewerId];
    let authorFilter = "";
    if (authorId) {
      values.push(authorId);
      authorFilter = `AND b.user_id = $${values.length}`;
    }
    let searchFilter = "";
    if (search) {
      values.push(`%${search.toLowerCase()}%`);
      searchFilter = `AND (LOWER(b.title) LIKE $${values.length} OR LOWER(b.content) LIKE $${values.length} OR LOWER(b.blog_description) LIKE $${values.length})`;
    }
    let genreFilter = "";
    if (preferredGenres.length > 0) {
      values.push(preferredGenres);
      genreFilter = `AND (cardinality(b.genres) = 0 OR b.genres && $${values.length}::text[])`;
    }
    values.push(limit, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   EXISTS (
                       SELECT 1 FROM blog_bookmarks bk
                       WHERE bk.blog_id = b.id AND bk.user_id = $1
                   ) AS bookmarked,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.status = 'published' ${authorFilter} ${searchFilter} ${genreFilter}
            ORDER BY b.published_at DESC
            LIMIT $${limitIndex} OFFSET $${offsetIndex};
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, values);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Get Count of Blogs (published / drafts / total)
  async countUserBlogs(userId: string): Promise<{
    published: number;
    drafts: number;
    total: number;
  }> {
    const query = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'published')::INT AS published,
                COUNT(*) FILTER (WHERE status = 'draft')::INT AS drafts,
                COUNT(*)::INT AS total
            FROM blogs
            WHERE user_id = $1;
        `;

    const result = await pool.query<{
      published: number;
      drafts: number;
      total: number;
    }>(query, [userId]);
    return result.rows[0] ?? { published: 0, drafts: 0, total: 0 };
  }

  // Bookmark a blog for a user
  async addBookmark(blogId: string, userId: string): Promise<boolean> {
    const query = `
            INSERT INTO blog_bookmarks (user_id, blog_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, blog_id) DO NOTHING;
        `;

    await pool.query(query, [userId, blogId]);
    return true;
  }

  // Remove the bookmark
  async removeBookmark(blogId: string, userId: string): Promise<boolean> {
    const query = `
            DELETE FROM blog_bookmarks WHERE user_id = $1 AND blog_id = $2;
        `;

    await pool.query(query, [userId, blogId]);
    return true;
  }

  async recordReadingProgress(
    userId: string,
    blogId: string,
    sessionId: string,
    activeSeconds: number,
    maxScrollPercent: number,
  ): Promise<void> {
    const query = `
            INSERT INTO reading_sessions (
                user_id, blog_id, session_id, active_seconds, max_scroll_percent, completed
            )
            VALUES ($1, $2, $3, $4, $5, $5 >= 90)
            ON CONFLICT (user_id, blog_id, session_id)
            DO UPDATE SET
                active_seconds = GREATEST(reading_sessions.active_seconds, EXCLUDED.active_seconds),
                max_scroll_percent = GREATEST(reading_sessions.max_scroll_percent, EXCLUDED.max_scroll_percent),
                completed = reading_sessions.completed OR EXCLUDED.completed,
                updated_at = NOW();
        `;

    await pool.query(query, [
      userId,
      blogId,
      sessionId,
      activeSeconds,
      maxScrollPercent,
    ]);
  }

  // Get all blogs a user has bookmarked (their reading list)
  async listUserBookmarks(
    userId: string,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   TRUE AS bookmarked,
                   COUNT(*) OVER() AS total_count
            FROM blog_bookmarks bk
            JOIN blogs b ON b.id = bk.blog_id
            JOIN users u ON u.id = b.user_id
            WHERE bk.user_id = $1
            ORDER BY bk.created_at DESC
            LIMIT $2 OFFSET $3;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [
      userId,
      limit,
      offset,
    ]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Get published blogs from users the viewer follows + the viewer's own blogs
  async listFollowingFeed(
    viewerId: string,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   EXISTS (
                       SELECT 1 FROM blog_bookmarks bk
                       WHERE bk.blog_id = b.id AND bk.user_id = $1
                   ) AS bookmarked,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.status = 'published'
              AND (
                  b.user_id = $1
                  OR b.user_id IN (
                      SELECT following_id FROM user_follows WHERE follower_id = $1
                  )
              )
            ORDER BY b.published_at DESC
            LIMIT $2 OFFSET $3;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [
      viewerId,
      limit,
      offset,
    ]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // Published blogs attributed to a club (the club landing page), with the
  // actual authors joined. Bookmark flag included for reuse on the client.
  async listClubPublishedBlogs(
    clubId: string,
    viewerId: string,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   EXISTS (
                       SELECT 1 FROM blog_bookmarks bk
                       WHERE bk.blog_id = b.id AND bk.user_id = $2
                   ) AS bookmarked,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.club_id = $1 AND b.status = 'published'
            ORDER BY b.published_at DESC
            LIMIT $3 OFFSET $4;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [
      clubId,
      viewerId,
      limit,
      offset,
    ]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }

  // The club's review queue: submissions pending a decision, newest edits
  // first. word_count is computed in SQL so the reviewer sees length.
  async listClubReviewQueue(
    clubId: string,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, b.blog_description AS description, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   (SELECT COUNT(*) FROM regexp_split_to_table(btrim(b.content), '\\s+') AS w WHERE w <> '')::INT
                       AS word_count,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.club_id = $1 AND b.club_review_status = 'pending'
            ORDER BY b.updated_at DESC
            LIMIT $2 OFFSET $3;
        `;

    const result = await pool.query<BlogWithAuthorModel>(query, [
      clubId,
      limit,
      offset,
    ]);
    return {
      items: result.rows,
      total: Number(result.rows[0]?.total_count ?? 0),
    };
  }
}

export default BlogRepository;
