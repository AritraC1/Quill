// -------------- AUTH -------------- //

export interface SignUpRequestDTO {
  name: string;
  email: string;
}

export interface RequestOtpDTO {
  email: string;
}

export interface VerifyOtpDTO {
  email: string;
  otp: string;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  onboardingCompleted?: boolean;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

// -------------- USER -------------- //

// Onboarding a new user
export interface OnboardRequestDTO {
  avatar?: string;
  bio?: string;
  favGenre: string[];
}

// Edit profile
export interface EditProfileDTO {
  avatar?: string;
  bio?: string;
  favGenre: string[];
  handle?: string;
  website?: string;
}

// -------------- BLOG -------------- //

export interface CreateBlogDTO {
  title: string;
  description: string;
  images?: string[];
}

export interface UpdateBlogDTO {
  title: string;
  description: string;
  images?: string[];
}
