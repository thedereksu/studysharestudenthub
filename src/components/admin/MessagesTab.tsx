import { useState, useEffect, useRef } from "react";
import { MessageSquare, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AdminMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  conversation_id: string;
  sender: { id: string; name: string } | null;
  conversation: {
    id: string;
    user1_id: string;
    user2_id: string;
    user1: { id: string; name: string } | null;
    user2: { id: string; name: string } | null;
  } | null;
}

const MessagesTab = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "list_messages" },
      });
      if (error) throw error;
      setMessages(data.messages || []);
    } catch (e: any) {
      toast({
        title: "Failed to load messages",
        description: sanitizeError(e),
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to real-time inserts on the messages table
    const channel = supabase
      .channel("admin-messages-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async () => {
          // Re-fetch all messages to get the full enriched data (sender/recipient names)
          await fetchMessages();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRecipient = (msg: AdminMessage): string => {
    if (!msg.conversation) return "Unknown";
    const { user1_id, user2_id, user1, user2 } = msg.conversation;
    if (msg.sender_id === user1_id) {
      return user2?.name || user2_id.slice(0, 8) + "…";
    }
    return user1?.name || user1_id.slice(0, 8) + "…";
  };

  const getSenderName = (msg: AdminMessage): string => {
    return msg.sender?.name || msg.sender_id.slice(0, 8) + "…";
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm py-4">Loading messages…</p>;
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <MessageSquare className="w-8 h-8 opacity-40" />
        <p className="text-sm">No messages have been sent yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{messages.length}</span> message
          {messages.length !== 1 ? "s" : ""} in chronological order. Updates automatically when new messages are sent.
        </p>
        <Badge variant="secondary" className="text-xs">
          Live
        </Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date &amp; Time</TableHead>
            <TableHead>From</TableHead>
            <TableHead className="w-6"></TableHead>
            <TableHead>To</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((msg) => (
            <TableRow key={msg.id}>
              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                {new Date(msg.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="font-medium text-foreground text-sm">
                {getSenderName(msg)}
              </TableCell>
              <TableCell className="text-muted-foreground px-0">
                <ArrowRight className="w-3 h-3" />
              </TableCell>
              <TableCell className="text-foreground text-sm">
                {getRecipient(msg)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-sm">
                <span className="line-clamp-2">{msg.content}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MessagesTab;
