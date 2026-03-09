import { useState, useEffect, createContext, useContext, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  blockedMessage: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  blockedMessage: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const initialSessionFromEventRef = useRef<Session | null>(null);

  const checkBlocked = async (email: string | undefined): Promise<boolean> => {
    if (!email) return false;
    const { data } = await supabase.rpc("is_email_blocked", { check_email: email });
    return !!data;
  };

  const handleBlocked = async () => {
    // Deny access: sign them out immediately and show blocked message
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setBlockedMessage("This account has been blocked. Contact support if you believe this is an error.");
    setLoading(false);
  };

  const scheduleBlockedCheck = (maybeSession: Session | null) => {
    const email = maybeSession?.user?.email;
    if (!email) return;

    // Fire-and-forget: never await inside auth callbacks.
    void (async () => {
      try {
        const blocked = await checkBlocked(email);
        if (blocked) {
          await handleBlocked();
        }
      } catch {
        // If the block-check fails, do not lock users out.
      }
    })();
  };

  const resetCorruptAuthStorage = () => {
    // If the auth blob in storage is corrupted (common in PWAs after OS restore / storage bugs),
    // supabase.auth.getSession() can reject, leaving the UI stuck in a perpetual loading state.
    // Clearing only Supabase auth-token keys is enough to recover without users manually clearing cookies.
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let mounted = true;

    const applySession = (next: Session | null) => {
      if (!mounted) return;
      setBlockedMessage(null);
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
      scheduleBlockedCheck(next);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession) => {
      // Store initial session event so we can reconcile with getSession().
      // IMPORTANT: never await inside this callback.
      if (event === "INITIAL_SESSION") {
        initialSessionFromEventRef.current = newSession;
        if (initializedRef.current) applySession(newSession);
        return;
      }

      applySession(newSession);
    });

    void (async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        initializedRef.current = true;
        const next = existingSession ?? initialSessionFromEventRef.current ?? null;
        applySession(next);
      } catch {
        // Recover from corrupted storage by clearing Supabase auth tokens and continuing as signed-out.
        initializedRef.current = true;
        resetCorruptAuthStorage();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // ignore
        }
        applySession(null);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, blockedMessage, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
