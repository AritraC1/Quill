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

/**
 * Login is transport-layered now:
 * - tokens are delivered as httpOnly cookies (never exposed to JS)
 * - the JSON body only carries non-sensitive session metadata
 */
export interface AuthResponseDTO {
  onboardingCompleted: boolean;
}

/** Result of GET /auth/session — used by the client to restore/verify auth state on boot */
export interface SessionResponseDTO {
  authenticated: boolean;
  onboardingCompleted?: boolean;
}

export interface RefreshTokenDTO {
  refreshToken?: string; // optional — the httpOnly cookie is preferred
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
