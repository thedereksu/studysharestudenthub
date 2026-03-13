import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useTeacherRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setIsTeacher(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const checkRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["teacher", "admin"] as any);

      if (error) {
        setIsTeacher(false);
      } else {
        setIsTeacher((data || []).some((r: any) => r.role === "teacher" || r.role === "admin"));
      }
      setLoading(false);
    };

    void checkRole();
  }, [user, authLoading]);

  return { isTeacher, loading };
};
