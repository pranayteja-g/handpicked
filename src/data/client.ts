import { createClient } from "@supabase/supabase-js";

const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const PROXY_RAW = (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, "");

// If a Worker proxy URL is configured (only needed when supabase.co is blocked), use it.
const API_URL = PROXY_RAW && /^https?:\/\//.test(PROXY_RAW) ? PROXY_RAW : SB_URL;

export const configured = !!API_URL && !!SB_KEY;

export const supabase = createClient(API_URL ?? "https://missing.invalid", SB_KEY ?? "missing", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // hash router owns the URL hash
    storageKey: "handpicked-auth",
  },
});

// Synthetic login email. Never shown, never mailed (email confirmation must be OFF).
export const AUTH_EMAIL_DOMAIN =
  (import.meta.env.VITE_AUTH_EMAIL_DOMAIN as string | undefined) || "handpicked.invalid";
