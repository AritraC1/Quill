export interface OnboardingData {
  avatarUrl: string | null;
  bio: string;
  genres: string[];
}

export interface GenreOption {
  id: string;
  name: string;
  description: string;
}
