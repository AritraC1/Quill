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

// Onboarding
export interface OnboardRequestDTO {
  avatar?: string;
  bio?: string;
  favGenre: string[];
}