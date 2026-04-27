import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { sanitizeError } from "@/lib/errors";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface PostAIChatSidebarProps {
  materialId: string;
  materialTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const PostAIChatSidebar = ({
  materialId,
  materialTitle,
  isOpen,
  onClose,
}: PostAIChatSidebarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [extractedContext, setExtractedContext] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history and extract context on first open
  useEffect(() => {
    if (isOpen && !initialized && user) {
      loadConversation();
      extractFileContext();
      setInitialized(true);
    }
  }, [isOpen, initialized, user]);

  const loadConversation = async () => {
    try {
      const { data } = await supabase
        .from("post_ai_conversations")
        .select("messages")
        .eq("material_id", materialId)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (data?.messages) {
        setMessages(data.messages as unknown as ChatMessage[]);
      }
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const extractFileContext = async () => {
    try {
      // Fetch material files
      const { data: material } = await supabase
        .from("materials")
        .select("files, file_url, file_type, title")
        .eq("id", materialId)
        .single();

      if (!material) return;

      const files = Array.isArray(material.files) 
        ? material.files 
        : material.file_url 
          ? [{ file_url: material.file_url, file_type: material.file_type, file_name: material.title }] 
          : [];

      if (files.length === 0) return;

      // We'll try to extract text from the first few files to avoid huge payloads
      let context = "";
      for (const file of files.slice(0, 2)) {
        if (!file.file_url) continue;

        try {
          // If it's a PDF, we can try to use a basic text fetch if it's public,
          // but for true PDF parsing we'd need a library. 
          // For now, we'll pass the URLs to the backend which now has direct storage access,
          // but we'll also try to fetch metadata or small text files here.
          if (file.file_type?.includes("text") || file.file_type?.includes("plain")) {
            const response = await fetch(file.file_url);
            if (response.ok) {
              const text = await response.text();
              context += `\n[Content from ${file.file_name}]:\n${text.slice(0, 5000)}\n`;
            }
          }
        } catch (e) {
          console.warn("Frontend extraction failed for", file.file_name, e);
        }
      }

      if (context) setExtractedContext(context);
    } catch (err) {
      console.error("Context extraction error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("post-ai-chat", {
        body: {
          materialId,
          message: userMessage,
          frontendContext: extractedContext, // Pass any text we found on frontend
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get AI response");
      }

      if (data?.success) {
        // Add user message
        const newUserMessage: ChatMessage = {
          role: "user",
          content: userMessage,
          timestamp: new Date().toISOString(),
        };

        // Add assistant message
        const newAssistantMessage: ChatMessage = {
          role: "assistant",
          content: data.message,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, newUserMessage, newAssistantMessage]);
      } else {
        throw new Error(data?.error || "Unknown error");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: sanitizeError(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="relative ml-auto w-full max-w-sm bg-card border-l border-border shadow-lg flex flex-col animate-in slide-in-from-right-96">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Sparkles className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">
                Study Assistant
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {materialTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-8 h-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                Ask me anything about this material!
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-border p-4 space-y-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            size="sm"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default PostAIChatSidebar;
