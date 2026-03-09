import { useState, useEffect, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
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
    const { data } = await supabase.rpc("is_email_blocked", { check_email: email });
    return !!data;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        const blocked = await checkBlocked(newSession.user.email);
        if (blocked) {
          // Deny access: sign them out immediately and show blocked message
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setBlockedMessage("This account has been blocked. Contact support if you believe this is an error.");
          setLoading(false);
          return;
        }
      }
      setBlockedMessage(null);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (existingSession?.user) {
        const blocked = await checkBlocked(existingSession.user.email);
        if (blocked) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setBlockedMessage("This account has been blocked. Contact support if you believe this is an error.");
          setLoading(false);
          return;
        }
      }
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
