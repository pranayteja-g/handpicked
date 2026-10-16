// ALL backend calls live here. UI code never imports the supabase client directly.
import { AUTH_EMAIL_DOMAIN, supabase } from "./client";
import { ApiError, type ErrorCode, type Invite, type InvitePreview, type Profile } from "./types";
import { normalizeKey } from "./key";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PROFILE_COLS = "id, username, display_name, avatar_url";

export const normalizeUsername = (u: string) => u.trim().toLowerCase();
export const isValidUsername = (u: string) => USERNAME_RE.test(u);
const emailFor = (username: string) => `${username}@${AUTH_EMAIL_DOMAIN}`;

export function toError(e: { message?: string } | null | undefined): ApiError {
  const msg = e?.message ?? "";
  const known: ErrorCode[] = [
    "invalid_invite",
    "own_invite",
    "you_blocked",
    "friend_limit",
    "not_authenticated",
    "daily_limit",
    "not_friends",
    "no_recipients",
    "invalid_input",
    "not_found",
  ];
  for (const k of known) if (msg.includes(k)) return new ApiError(k, msg);
  if (/could not find the function|schema cache|does not exist|PGRST20\d/i.test(msg)) {
    return new ApiError("setup_missing", msg);
  }
  if (/failed to fetch|networkerror|load failed|network request failed|timeout/i.test(msg)) {
    return new ApiError("network", msg);
  }
  if (/invalid login credentials/i.test(msg)) return new ApiError("bad_credentials", msg);
  if (/already registered|already been registered|duplicate key|profiles_username/i.test(msg)) {
    return new ApiError("username_taken", msg);
  }
  if (/violates check constraint|not-null constraint/i.test(msg)) {
    return new ApiError("invalid_input", msg);
  }
  if (/email.*(invalid|not allowed)|invalid.*email/i.test(msg)) {
    return new ApiError("email_rejected", msg);
  }
  return new ApiError("unknown", msg);
}

export function check<T>(res: { data: T; error: { message?: string } | null }): T {
  if (res.error) throw toError(res.error);
  return res.data;
}

// ------------------------------------------------------------------ auth
export async function usernameAvailable(username: string): Promise<boolean> {
  const u = normalizeUsername(username);
  if (!isValidUsername(u)) return false;
  return check(await supabase.rpc("username_available", { p_username: u })) as boolean;
}

export async function signUp(username: string, displayName: string, key: string): Promise<void> {
  const u = normalizeUsername(username);
  if (!isValidUsername(u)) throw new ApiError("invalid_username");
  const { data, error } = await supabase.auth.signUp({
    email: emailFor(u),
    password: normalizeKey(key),
    options: { data: { username: u, display_name: displayName.trim() || u } },
  });
  if (error) throw toError(error);
  // No session = the project still requires email confirmation.
  if (!data.session) throw new ApiError("confirm_on");
}

export async function signIn(username: string, key: string): Promise<void> {
  const u = normalizeUsername(username);
  const { error } = await supabase.auth.signInWithPassword({
    email: emailFor(u),
    password: normalizeKey(key),
  });
  if (error) throw toError(error);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function changeKey(newKey: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: normalizeKey(newKey) });
  if (error) throw toError(error);
}

export async function deleteAccount(): Promise<void> {
  await removeAllMyImages();
  check(await supabase.rpc("delete_my_account"));
  await supabase.auth.signOut();
}

// ------------------------------------------------------------------ profile
export async function getMyProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const res = await supabase.from("profiles").select(PROFILE_COLS).eq("id", u.user.id).maybeSingle();
  return check(res) as Profile | null;
}

export async function updateDisplayName(name: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new ApiError("not_authenticated");
  check(
    await supabase
      .from("profiles")
      .update({ display_name: name.trim().slice(0, 40) })
      .eq("id", u.user.id),
  );
}

// ------------------------------------------------------------------ friends
export async function profilesByIds(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const out: Profile[] = [];
  // chunk so the request URL stays short
  for (let i = 0; i < unique.length; i += 80) {
    const res = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .in("id", unique.slice(i, i + 80));
    out.push(...(((check(res) as Profile[]) ?? [])));
  }
  return out.sort((a, b) => a.display_name.localeCompare(b.display_name));
}

export async function listFriends(myId: string): Promise<Profile[]> {
  const res = await supabase.from("friendships").select("user_a, user_b");
  const rows = (check(res) as { user_a: string; user_b: string }[]) ?? [];
  return profilesByIds(rows.map((r) => (r.user_a === myId ? r.user_b : r.user_a)));
}

export async function removeFriend(myId: string, otherId: string): Promise<void> {
  check(
    await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_a.eq.${myId},user_b.eq.${otherId}),and(user_a.eq.${otherId},user_b.eq.${myId})`,
      ),
  );
}

export async function blockUser(otherId: string): Promise<void> {
  check(await supabase.rpc("block_user", { p_user: otherId }));
}

export async function listBlocked(): Promise<Profile[]> {
  const res = await supabase.from("blocks").select("blocked_id");
  const rows = (check(res) as { blocked_id: string }[]) ?? [];
  return profilesByIds(rows.map((r) => r.blocked_id));
}

export async function unblockUser(otherId: string): Promise<void> {
  check(await supabase.from("blocks").delete().eq("blocked_id", otherId));
}

// ------------------------------------------------------------------ invites
export async function getActiveInvite(): Promise<Invite | null> {
  const res = await supabase
    .from("invites")
    .select("code, expires_at")
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1);
  const rows = (check(res) as { code: string; expires_at: string | null }[]) ?? [];
  const row = rows[0];
  if (!row) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { code: row.code, expiresAt: row.expires_at };
}

/** days = null -> never expires. Replaces any active invite. */
export async function createInvite(days: number | null): Promise<Invite> {
  const rows = check(await supabase.rpc("create_invite", { p_days: days })) as {
    invite_code: string;
    invite_expires_at: string | null;
  }[];
  const row = rows[0];
  return { code: row.invite_code, expiresAt: row.invite_expires_at };
}

export async function revokeInvite(): Promise<void> {
  check(await supabase.rpc("revoke_my_invite"));
}

export async function previewInvite(code: string): Promise<InvitePreview | null> {
  const rows = check(await supabase.rpc("preview_invite", { p_code: code })) as InvitePreview[];
  return rows?.[0] ?? null;
}

export async function acceptInvite(code: string): Promise<void> {
  check(await supabase.rpc("accept_invite", { p_code: code }));
}

export function inviteUrl(code: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}#/join/${code}`;
}

// Storage files are not removed by database cascades, so clear them before deleting the account.
export const IMAGE_BUCKET = "rec-images";

async function removeAllMyImages(): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const bucket = supabase.storage.from(IMAGE_BUCKET);
    const { data } = await bucket.list(u.user.id, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${u.user.id}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  } catch {
    /* best effort; a cleanup job will catch leftovers */
  }
}
