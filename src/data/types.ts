export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type Invite = {
  code: string;
  expiresAt: string | null;
};

export type InvitePreview = {
  display_name: string;
  username: string;
};

export type ErrorCode =
  | "network"
  | "bad_credentials"
  | "username_taken"
  | "invalid_username"
  | "invalid_invite"
  | "own_invite"
  | "you_blocked"
  | "friend_limit"
  | "email_rejected"
  | "confirm_on"
  | "not_authenticated"
  | "daily_limit"
  | "not_friends"
  | "no_recipients"
  | "invalid_input"
  | "not_found"
  | "image_failed"
  | "setup_missing"
  | "unknown";

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, raw?: string) {
    super(raw ?? code);
    this.code = code;
  }
}
