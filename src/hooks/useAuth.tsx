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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const checkBlocked = async (email: string | undefined): Promise<boolean> => {
    if (!email) return false;

    try {
      const { data, error } = await supabase.rpc("is_email_blocked", { check_email: email });
      if (error) {
        console.error("[Auth] is_email_blocked error:", error);
        return false;
      }
      return !!data;
    } catch (error) {
      console.error("[Auth] checkBlocked exception:", error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const applySession = async (incomingSession: Session | null) => {
      if (!isMounted) return;

      if (incomingSession?.user) {
        const blocked = await checkBlocked(incomingSession.user.email);
        if (!isMounted) return;

        if (blocked) {
          await supabase.auth.signOut();
          if (!isMounted) return;

          setSession(null);
          setUser(null);
          setBlockedMessage("This account has been blocked. Contact support if you believe this is an error.");
          setLoading(false);
          return;
        }
      }

      setBlockedMessage(null);
      setSession(incomingSession);
      setUser(incomingSession?.user ?? null);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Avoid awaiting inside auth callback to prevent deadlocks.
      void applySession(newSession);
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void applySession(existingSession);
    });

    return () => {
      isMounted = false;
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
