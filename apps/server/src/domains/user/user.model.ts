import type { BlogModel } from "../blog/blog.model";

export interface UserModel {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  fav_genre: string[] | null;
  onboarding_completed: boolean;
  handle: string | null;
  created_at: Date;
  updated_at: Date;
  handle_changed_at?: Date | null;
  blogs?: BlogModel[];
}