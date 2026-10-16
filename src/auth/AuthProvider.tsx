import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../data/client";
import { getMyProfile } from "../data/api";
import type { Profile } from "../data/types";

type Status = "loading" | "out" | "in" | "error";

type AuthCtx = {
  status: Status;
  profile: Profile | null;
  reloadProfile: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = not yet known
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // Do not call supabase from inside this callback (can deadlock); just store the session.
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const ready = session !== undefined;
  const uid = session?.user.id ?? null;

  useEffect(() => {
    if (!ready) return;
    if (!uid) {
      setProfile(null);
      setFailed(false);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    getMyProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setFailed(!p);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
        setFailed(true);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, uid, tick]);

  const reloadProfile = useCallback(async () => {
    const p = await getMyProfile();
    setProfile(p);
  }, []);

  const status: Status = !ready || !loaded ? "loading" : !uid ? "out" : failed ? "error" : "in";

  return (
    <Ctx.Provider
      value={{
        status,
        profile,
        reloadProfile: async () => {
          if (failed) setTick((n) => n + 1);
          else await reloadProfile();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

/** For pages that only render when signed in. */
export function useMe(): Profile {
  const { profile } = useAuth();
  if (!profile) throw new Error("useMe without profile");
  return profile;
}
