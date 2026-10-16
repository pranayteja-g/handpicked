// Secret key = the account password. 20 chars of Crockford base32 = 100 bits.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // no I, L, O, U

export function generateKey(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
}

/** What the user sees: XXXXX-XXXXX-XXXXX-XXXXX */
export function formatKey(key: string): string {
  return key.match(/.{1,5}/g)?.join("-") ?? key;
}

/** Accepts pasted keys with dashes/spaces/lowercase/ambiguous chars. */
export function normalizeKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

const PENDING_KEY = "hp_pending_key";

// Held only until the user confirms they saved it (survives an accidental reload).
export function stashPendingKey(key: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, key);
  } catch {
    /* ignore */
  }
}
export function readPendingKey(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
export function clearPendingKey() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

const PENDING_INVITE = "hp_pending_invite";
export function stashPendingInvite(code: string) {
  try {
    localStorage.setItem(PENDING_INVITE, code);
  } catch {
    /* ignore */
  }
}
export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_INVITE);
  } catch {
    return null;
  }
}
export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE);
  } catch {
    /* ignore */
  }
}
