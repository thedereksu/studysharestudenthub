import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

const BLOCKED_ACCOUNT_MESSAGE = "This account has been blocked. Contact support if you believe this is an error.";

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const checkBlocked = async (email: string | undefined): Promise<boolean> => {
    if (!email) return false;

    const { data, error } = await supabase.rpc("is_email_blocked", { check_email: email });
    if (error) {
      console.error("Block check error:", error);
      return false;
    }

    return !!data;
  };

  useEffect(() => {
    let mounted = true;

    const applySession = async (incomingSession: Session | null) => {
      if (!mounted) return;

      if (incomingSession?.user) {
        const blocked = await checkBlocked(incomingSession.user.email);
        if (!mounted) return;

        if (blocked) {
          setSession(null);
          setUser(null);
          setBlockedMessage(BLOCKED_ACCOUNT_MESSAGE);
          setLoading(false);
          void supabase.auth.signOut();
          return;
        }
      }

      setBlockedMessage(null);
      setSession(incomingSession);
      setUser(incomingSession?.user ?? null);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void applySession(existingSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ user, session, loading, blockedMessage, signOut }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
