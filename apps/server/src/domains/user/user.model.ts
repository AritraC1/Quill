export interface UserModel {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  bio?: string | null;
  fav_genre: string[] | null;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}