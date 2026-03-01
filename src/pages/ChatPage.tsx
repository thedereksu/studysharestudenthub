import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import type { Message, Profile } from "@/lib/types";

const ChatPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<{ id: string; user1_id: string; user2_id: string } | null>(null);

  // Find or create conversation
  useEffect(() => {
    if (!user || !userId) return;

    const init = async () => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setOtherProfile(profileData as Profile | null);

      const { data: convos } = await supabase
        .from("conversations")
        .select("*")
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${user.id})`);

      if (convos && convos.length > 0) {
        setConversationId(convos[0].id);
        conversationRef.current = convos[0] as any;
      }
    };
    init();
  }, [user, userId]);

  // Mark as read when opening conversation
  useEffect(() => {
    if (!conversationId || !user) return;

    const markRead = async () => {
      const { data: conv } = await supabase
        .from("conversations")
        .select("user1_id, user2_id")
        .eq("id", conversationId)
        .single();

      if (!conv) return;

      const isUser1 = conv.user1_id === user.id;
      await supabase
        .from("conversations")
        .update(isUser1 ? { user1_unread_count: 0 } : { user2_unread_count: 0 })
        .eq("id", conversationId);
    };
    markRead();
  }, [conversationId, user]);

  // Fetch messages when conversation is found
  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) || []);
    };
    fetchMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Mark read immediately if we're viewing
          if (user) {
            const conv = conversationRef.current;
            if (conv) {
              const isUser1 = conv.user1_id === user.id;
              supabase
                .from("conversations")
                .update(isUser1 ? { user1_unread_count: 0 } : { user2_unread_count: 0 })
                .eq("id", conversationId)
                .then(() => {});
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !userId) return;
    setSending(true);

    try {
      let convId = conversationId;

      if (!convId) {
        const { data: newConvo, error: convError } = await supabase
          .from("conversations")
          .insert({ user1_id: user.id, user2_id: userId })
          .select()
          .single();
        if (convError) throw convError;
        convId = newConvo.id;
        setConversationId(convId);
        conversationRef.current = newConvo as any;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        content: newMessage.trim(),
      });
      if (error) throw error;

      setNewMessage("");
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center text-muted-foreground">
        Sign in to send messages.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <button onClick={() => navigate("/messages")} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {otherProfile?.name || "Chat"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === user.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
                <div className={`text-[10px] mt-0.5 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-border bg-card flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending} className="rounded-full">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPage;
