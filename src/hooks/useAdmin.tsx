import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useAdmin = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    if (authLoading) {
      setLoading(true);
      return () => {
        isMounted = false;
      };
    }

    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const checkRole = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("[Admin] role check failed:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }

      setLoading(false);
    };

    void checkRole();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
};
