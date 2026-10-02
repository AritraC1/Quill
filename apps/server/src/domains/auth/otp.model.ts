export interface OtpModel {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}
