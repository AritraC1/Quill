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
            SELECT b.*, u.name AS author_name, u.handle AS author_handle,
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
            INSERT INTO blogs (user_id, title, content, blog_description, images, status)
            VALUES ($1, $2, $3, $4, $5, 'draft')
            RETURNING *;
        `;

    const result = await pool.query<BlogModel>(query, [
      userId,
      data.title ?? "",
      data.content ?? "",
      data.description ?? "",
      data.images ?? null,
    ]);
    return result.rows[0]!;
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
            SELECT b.*, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.user_id = $1 AND b.status = $2
            ORDER BY b.updated_at DESC
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
  async listPublishedBlogs(
    viewerId: string,
    authorId: string | null,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const values: unknown[] = [viewerId];
    let authorFilter = "";
    if (authorId) {
      values.push(authorId);
      authorFilter = `AND b.user_id = $${values.length}`;
    }
    values.push(limit, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const query = `
            SELECT b.*, u.name AS author_name, u.handle AS author_handle,
                   u.avatar AS author_avatar,
                   EXISTS (
                       SELECT 1 FROM blog_bookmarks bk
                       WHERE bk.blog_id = b.id AND bk.user_id = $1
                   ) AS bookmarked,
                   COUNT(*) OVER() AS total_count
            FROM blogs b
            JOIN users u ON u.id = b.user_id
            WHERE b.status = 'published' ${authorFilter}
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

  // Get all blogs a user has bookmarked (their reading list)
  async listUserBookmarks(
    userId: string,
    page: number,
    limit: number,
  ): Promise<BlogListResult> {
    const offset = (page - 1) * limit;
    const query = `
            SELECT b.*, u.name AS author_name, u.handle AS author_handle,
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
}

export default BlogRepository;
