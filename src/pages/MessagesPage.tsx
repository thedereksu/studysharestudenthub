import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ConversationWithProfile {
  id: string;
  otherUserId: string;
  otherName: string;
  updatedAt: string;
  unreadCount: number;
}

const MessagesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("conversations")
      .select("*, profiles_user1:profiles!conversations_user1_id_fkey(*), profiles_user2:profiles!conversations_user2_id_fkey(*)")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (data) {
      const mapped = data.map((c: any) => {
        const isUser1 = c.user1_id === user.id;
        const other = isUser1 ? c.profiles_user2 : c.profiles_user1;
        return {
          id: c.id,
          otherUserId: isUser1 ? c.user2_id : c.user1_id,
          otherName: other?.name || "Anonymous",
          updatedAt: c.updated_at,
          unreadCount: isUser1 ? (c.user1_unread_count ?? 0) : (c.user2_unread_count ?? 0),
        };
      });
      setConversations(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    if (!user) return;
    const channel = supabase
      .channel("messages-page-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <div className="max-w-lg mx-auto px-4 animate-fade-in">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl text-foreground">Messages</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          No messages yet. Start a conversation by tapping a username on a listing.
        </div>
      ) : (
        <div className="space-y-2 pb-6">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/chat/${c.otherUserId}`)}
              className={`w-full flex items-center gap-3 bg-card border rounded-lg p-3 text-left hover:bg-muted transition-colors ${
                c.unreadCount > 0 ? "border-primary/50" : "border-border"
              }`}
            >
              <div className="relative w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-primary" />
                {c.unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                    {c.unreadCount > 99 ? "99+" : c.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-semibold text-foreground ${c.unreadCount > 0 ? "" : ""}`}>{c.otherName}</span>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {c.unreadCount > 0 && (
                <span className="text-xs font-semibold text-primary">{c.unreadCount} new</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
