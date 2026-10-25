import type { BlogModel } from "./blog.model";
import { pool } from "../../core/database/db";
import type { CreateBlogDTO, UpdateBlogDTO } from "@quill/shared";

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

    // Create a new blog
    async createNewBlog (data: CreateBlogDTO): Promise<BlogModel> {
        const query = `
            INSERT INTO blogs (title, blog_description, images)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const result = await pool.query<BlogModel>(query, [data.title, data.description, data.images]);
        return result.rows[0]!;
    }

    // Update a blog
    async updateBlog(blogId: string, data: UpdateBlogDTO): Promise<BlogModel | null> {
        const query = `
            UPDATE blogs 
            (title, blog_description, images)
            WHERE id = $1
            RETURNING *;
        `;

        const result = await pool.query<BlogModel>(query, [
            blogId,
            data.title,
            data.description,
            data.images
        ]);

        return result.rows[0] ?? null;
    }

    // Delete a blog

    // Get all Blogs

    // Get Count of Blogs
}

export default BlogRepository;