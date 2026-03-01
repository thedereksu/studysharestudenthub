import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useUnreadCount = () => {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!user) { setTotalUnread(0); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("user1_id, user2_id, user1_unread_count, user2_unread_count")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (data) {
        const total = data.reduce((sum, c) => {
          const count = c.user1_id === user.id ? (c.user1_unread_count ?? 0) : (c.user2_unread_count ?? 0);
          return sum + count;
        }, 0);
        setTotalUnread(total);
      }
    };
    fetch();

    const channel = supabase
      .channel("unread-counts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => { fetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return totalUnread;
};
