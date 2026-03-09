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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        // Supabase can emit INITIAL_SESSION before storage restore finishes; ignore it.
        if (event === "INITIAL_SESSION" && !initializedRef.current) return;
        applySession(newSession);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      initializedRef.current = true;
      applySession(existingSession);
    });

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
